import { createServer as createHttpServer, type IncomingMessage } from "node:http";
import type { Duplex } from "node:stream";
import type { AddressInfo } from "node:net";
import { WebSocket, WebSocketServer, type RawData } from "ws";
import {
  createGame,
  legalMoves,
  projectEvents,
  toGameOverView,
  toPublicView,
  toSafeError,
  tryEndGame,
  tryResolveMove,
  IllegalMoveError,
  type Color,
  type GameState,
  type Resolution,
  type Rng,
  type SafeError,
} from "@chessweeper/engine";
import {
  ERROR_MESSAGES,
  parseClientMessage,
  type ClientMessage,
  type ErrorCode,
  type ServerMessage,
} from "@chessweeper/protocol";
import { realClock, type Clock } from "./clock";
import { createCryptoRng, newInviteCode, newSeatToken, tokensEqual } from "./crypto";
import { clientIp } from "./ip";
import { DEFAULT_LIMITS, TokenBucket, type Limits } from "./limits";
import { createLogger, type Logger } from "./log";

export interface ServerOptions {
  /** 0 picks an ephemeral port (tests). */
  readonly port: number;
  readonly host?: string;
  /** Game RNG: mine placement, relocation and reshuffles. Defaults to a crypto RNG. */
  readonly rng?: Rng;
  readonly clock?: Clock;
  /** Exact Origin values allowed to upgrade. Empty means nobody (fail closed). */
  readonly allowedOrigins: readonly string[];
  readonly limits?: Partial<Limits>;
  /** Read Fly-Client-IP for per-IP limits. Off unless the server sits behind a trusted proxy. */
  readonly trustProxy?: boolean;
  readonly logger?: Logger;
}

export interface RunningServer {
  listen(): Promise<number>;
  close(): Promise<void>;
  roomCount(): number;
}

interface Conn {
  readonly ws: WebSocket;
  readonly ip: string;
  readonly bucket: TokenBucket;
  room: Room | null;
  seat: Color | null;
}

interface SeatState {
  readonly token: string;
  conn: Conn | null;
  /** The grace period has passed: the opponent may claim the win (3.6). */
  claimable: boolean;
  graceTimer: unknown;
}

interface Room {
  readonly code: string;
  readonly ownerIp: string;
  state: GameState;
  /** Counts accepted state changes; a move must quote the current value. */
  seq: number;
  readonly seats: { w: SeatState; b: SeatState | null };
  /** Side with a pending draw offer (3.6). At most one. */
  drawOffer: Color | null;
  /** An offerer may not offer again until they have made a move. */
  readonly mustMove: { w: boolean; b: boolean };
  expiry: unknown;
  /** The game is over and the short removal timer is running. */
  finishing: boolean;
}

const other = (c: Color): Color => (c === "w" ? "b" : "w");

/** Engine errors only ever carry codes that are also wire codes. */
const wireCode = (e: SafeError): ErrorCode => e.code;

export function createServer(options: ServerOptions): RunningServer {
  const limits: Limits = { ...DEFAULT_LIMITS, ...options.limits };
  const clock = options.clock ?? realClock;
  const rng = options.rng ?? createCryptoRng();
  const trustProxy = options.trustProxy ?? false;
  const logger =
    options.logger ??
    createLogger((line) => {
      console.log(line);
    });
  const origins = new Set(options.allowedOrigins);

  const rooms = new Map<string, Room>();
  const roomsPerIp = new Map<string, number>();
  const connsPerIp = new Map<string, number>();
  const conns = new Set<Conn>();

  // The one place a frame leaves the server. Every server to client message goes through here.
  function send(conn: Conn, message: ServerMessage): void {
    if (conn.ws.readyState === WebSocket.OPEN) conn.ws.send(JSON.stringify(message));
  }

  function sendError(conn: Conn, code: ErrorCode): void {
    send(conn, { type: "error", code, message: ERROR_MESSAGES[code] });
  }

  function sendSafeError(conn: Conn, error: SafeError): void {
    send(conn, { type: "error", code: wireCode(error), message: error.message });
  }

  const connOf = (room: Room, color: Color): Conn | null => room.seats[color]?.conn ?? null;

  function toSeat(room: Room, color: Color, message: ServerMessage): void {
    const conn = connOf(room, color);
    if (conn !== null) send(conn, message);
  }

  // ---- room lifetime ----

  function scheduleExpiry(room: Room): void {
    // Once the game is over the removal time is fixed: later activity must not extend it.
    if (room.finishing) return;
    if (room.expiry !== undefined) clock.clearTimeout(room.expiry);
    const anyone = connOf(room, "w") !== null || connOf(room, "b") !== null;
    const over = room.state.public.status.kind === "over";
    room.expiry = clock.setTimeout(
      () => {
        closeRoom(room);
      },
      over ? limits.finishedRoomMs : anyone ? limits.idleRoomMs : limits.emptyRoomMs,
    );
  }

  function closeRoom(room: Room): void {
    if (rooms.get(room.code) !== room) return;
    clock.clearTimeout(room.expiry);
    for (const color of ["w", "b"] as const) {
      const seat = room.seats[color];
      if (seat === null) continue;
      clock.clearTimeout(seat.graceTimer);
      const conn = seat.conn;
      if (conn !== null) {
        conn.room = null;
        conn.seat = null;
        conn.ws.close(1001);
      }
    }
    rooms.delete(room.code);
    const remaining = (roomsPerIp.get(room.ownerIp) ?? 1) - 1;
    if (remaining <= 0) roomsPerIp.delete(room.ownerIp);
    else roomsPerIp.set(room.ownerIp, remaining);
    logger.info("room_closed");
  }

  // ---- state changes ----

  function broadcastUpdate(room: Room, resolution: Resolution): void {
    for (const color of ["w", "b"] as const) {
      toSeat(room, color, {
        type: "update",
        seq: room.seq,
        events: projectEvents(resolution.events),
        view: toPublicView(room.state, color),
      });
    }
    if (room.state.public.status.kind === "over") {
      for (const color of ["w", "b"] as const) {
        const seat = room.seats[color];
        if (seat !== null) clock.clearTimeout(seat.graceTimer);
        const over = toGameOverView(room.state, color);
        if (over !== null) toSeat(room, color, { type: "game_over", over });
      }
      // Free the room shortly after the game ends, once both have had time to load the result.
      if (!room.finishing) {
        scheduleExpiry(room);
        room.finishing = true;
      }
    }
  }

  function applyEnding(room: Room, conn: Conn, result: ReturnType<typeof tryEndGame>): void {
    if (!result.ok) {
      sendSafeError(conn, result.error);
      return;
    }
    room.state = result.resolution.state;
    room.seq += 1;
    room.drawOffer = null;
    broadcastUpdate(room, result.resolution);
  }

  function lapseDraw(room: Room): void {
    if (room.drawOffer === null) return;
    room.drawOffer = null;
    toSeat(room, "w", { type: "draw", state: "lapsed" });
    toSeat(room, "b", { type: "draw", state: "lapsed" });
  }

  // ---- seats ----

  function attach(room: Room, color: Color, conn: Conn, isReconnect: boolean): void {
    const seat = room.seats[color];
    if (seat === null) return;
    const wasAway = seat.conn === null;
    const old = seat.conn;
    if (old !== null && old !== conn) {
      // A newer connection takes over the seat; the old one is dropped without a disconnect.
      old.room = null;
      old.seat = null;
      old.ws.close(1000);
    }
    clock.clearTimeout(seat.graceTimer);
    seat.claimable = false;
    seat.conn = conn;
    conn.room = room;
    conn.seat = color;

    send(conn, { type: "joined", code: room.code, seat: color, token: seat.token });
    send(conn, { type: "snapshot", seq: room.seq, view: toPublicView(room.state, color) });
    const over = toGameOverView(room.state, color);
    if (over !== null) send(conn, { type: "game_over", over });

    const opp = room.seats[other(color)];
    if (opp !== null) {
      send(conn, {
        type: "opponent",
        state: opp.conn !== null ? "connected" : opp.claimable ? "claimable" : "disconnected",
      });
      if (wasAway) toSeat(room, other(color), { type: "opponent", state: "connected" });
    }
    if (isReconnect && room.drawOffer === other(color))
      send(conn, { type: "draw", state: "offered" });
    scheduleExpiry(room);
  }

  function detach(conn: Conn): void {
    const room = conn.room;
    const color = conn.seat;
    conn.room = null;
    conn.seat = null;
    if (room === null || color === null) return;
    const seat = room.seats[color];
    if (seat?.conn !== conn) return;
    seat.conn = null;
    logger.info("seat_disconnected");
    scheduleExpiry(room);
    if (room.state.public.status.kind === "over") return;
    toSeat(room, other(color), { type: "opponent", state: "disconnected" });
    // 3.6: 60 s grace to reconnect, then the opponent may claim the win.
    seat.graceTimer = clock.setTimeout(() => {
      seat.claimable = true;
      toSeat(room, other(color), { type: "opponent", state: "claimable" });
    }, limits.graceMs);
  }

  // ---- message handlers ----

  function handleCreate(conn: Conn): void {
    if (conn.room !== null) {
      sendError(conn, "forbidden");
      return;
    }
    if (rooms.size >= limits.maxRooms || (roomsPerIp.get(conn.ip) ?? 0) >= limits.maxRoomsPerIp) {
      sendError(conn, "rate-limited");
      return;
    }
    let code = newInviteCode();
    while (rooms.has(code)) code = newInviteCode();
    const room: Room = {
      code,
      ownerIp: conn.ip,
      state: createGame({ rng }),
      seq: 0,
      seats: {
        w: { token: newSeatToken(), conn: null, claimable: false, graceTimer: undefined },
        b: null,
      },
      drawOffer: null,
      mustMove: { w: false, b: false },
      expiry: undefined,
      finishing: false,
    };
    rooms.set(code, room);
    roomsPerIp.set(conn.ip, (roomsPerIp.get(conn.ip) ?? 0) + 1);
    logger.info("room_created");
    attach(room, "w", conn, false);
  }

  function handleJoin(conn: Conn, code: string, token: string | undefined): void {
    if (conn.room !== null) {
      sendError(conn, "forbidden");
      return;
    }
    const room = rooms.get(code);
    if (room === undefined) {
      sendError(conn, "room-not-found");
      return;
    }
    if (token !== undefined) {
      // A valid token is a reconnect to that seat; anything else fails closed.
      for (const color of ["w", "b"] as const) {
        const seat = room.seats[color];
        if (seat !== null && tokensEqual(seat.token, token)) {
          logger.info("seat_reconnected");
          attach(room, color, conn, true);
          return;
        }
      }
      sendError(conn, "forbidden");
      return;
    }
    if (room.seats.b !== null) {
      sendError(conn, "room-full");
      return;
    }
    room.seats.b = { token: newSeatToken(), conn: null, claimable: false, graceTimer: undefined };
    logger.info("room_joined");
    attach(room, "b", conn, false);
  }

  function handleMove(
    conn: Conn,
    room: Room,
    seat: Color,
    msg: Extract<ClientMessage, { type: "move" }>,
  ): void {
    if (room.state.public.status.kind === "over") {
      sendError(conn, "game-over");
      return;
    }
    if (room.state.position.turn !== seat) {
      sendError(conn, "not-your-turn");
      return;
    }
    if (msg.seq !== room.seq) {
      sendError(conn, "stale-seq");
      return;
    }
    const move = legalMoves(room.state.position).find(
      (m) => m.from === msg.from && m.to === msg.to && m.promotion === (msg.promo ?? null),
    );
    if (move === undefined) {
      sendSafeError(conn, toSafeError(new IllegalMoveError()));
      return;
    }
    const result = tryResolveMove(room.state, move, rng);
    if (!result.ok) {
      sendSafeError(conn, result.error);
      return;
    }
    room.state = result.resolution.state;
    room.seq += 1;
    room.mustMove[seat] = false;
    lapseDraw(room); // 3.6: a pending offer lapses when any move is made
    broadcastUpdate(room, result.resolution);
  }

  function handleDrawOffer(conn: Conn, room: Room, seat: Color): void {
    if (room.state.public.status.kind === "over") {
      sendError(conn, "game-over");
      return;
    }
    if (room.drawOffer !== null || room.mustMove[seat]) {
      sendError(conn, "forbidden");
      return;
    }
    room.drawOffer = seat;
    room.mustMove[seat] = true;
    toSeat(room, other(seat), { type: "draw", state: "offered" });
  }

  function handleDrawReply(conn: Conn, room: Room, seat: Color, accept: boolean): void {
    if (room.state.public.status.kind === "over") {
      sendError(conn, "game-over");
      return;
    }
    const offerer = room.drawOffer;
    if (offerer === null || offerer === seat) {
      sendError(conn, "forbidden");
      return;
    }
    if (accept) {
      applyEnding(room, conn, tryEndGame(room.state, { reason: "agreement", by: seat }));
    } else {
      room.drawOffer = null;
      toSeat(room, offerer, { type: "draw", state: "declined" });
    }
  }

  function handleClaim(conn: Conn, room: Room, seat: Color): void {
    if (room.state.public.status.kind === "over") {
      sendError(conn, "game-over");
      return;
    }
    const absent = other(seat);
    if (room.seats[absent]?.claimable !== true) {
      sendError(conn, "forbidden");
      return;
    }
    applyEnding(room, conn, tryEndGame(room.state, { reason: "abandonment", by: absent }));
  }

  function dispatch(conn: Conn, msg: ClientMessage): void {
    switch (msg.type) {
      case "ping": {
        send(conn, { type: "pong" });
        return;
      }
      case "create_room": {
        handleCreate(conn);
        return;
      }
      case "join_room": {
        handleJoin(conn, msg.code, msg.token);
        return;
      }
      default:
    }
    const room = conn.room;
    const seat = conn.seat;
    if (room === null || seat === null) {
      sendError(conn, "forbidden");
      return;
    }
    scheduleExpiry(room);
    switch (msg.type) {
      case "move": {
        handleMove(conn, room, seat, msg);
        return;
      }
      case "resign":
        if (room.state.public.status.kind === "over") {
          sendError(conn, "game-over");
          return;
        }
        {
          applyEnding(room, conn, tryEndGame(room.state, { reason: "resignation", by: seat }));
          return;
        }
      case "draw_offer": {
        handleDrawOffer(conn, room, seat);
        return;
      }
      case "draw_reply": {
        handleDrawReply(conn, room, seat, msg.accept);
        return;
      }
      case "claim_win": {
        handleClaim(conn, room, seat);
        return;
      }
    }
  }

  function rawToString(data: RawData): string {
    if (Array.isArray(data)) return Buffer.concat(data).toString("utf8");
    if (data instanceof ArrayBuffer) return Buffer.from(data).toString("utf8");
    return data.toString("utf8");
  }

  function onMessage(conn: Conn, data: RawData, isBinary: boolean): void {
    if (!conn.bucket.take(clock.now())) {
      sendError(conn, "rate-limited");
      conn.ws.close(1008);
      return;
    }
    try {
      if (isBinary) {
        sendError(conn, "bad-message");
        return;
      }
      const parsed = parseClientMessage(rawToString(data));
      if (!parsed.ok) {
        sendError(conn, "bad-message");
        return;
      }
      dispatch(conn, parsed.message);
    } catch {
      // Never echo input or error text: a generic error only.
      logger.info("handler_error");
      sendError(conn, "internal");
    }
  }

  // ---- transport ----

  const wss = new WebSocketServer({ noServer: true, maxPayload: limits.maxPayloadBytes });

  const http = createHttpServer((req, res) => {
    const ok = req.url === "/healthz" && (req.method === "GET" || req.method === "HEAD");
    res.writeHead(ok ? 200 : 404, {
      "Content-Type": "text/plain",
      "Content-Length": ok ? 2 : 0,
      "Cache-Control": "no-store",
    });
    res.end(ok && req.method === "GET" ? "ok" : "");
  });

  function reject(socket: Duplex, status: string): void {
    socket.write(`HTTP/1.1 ${status}\r\nConnection: close\r\nContent-Length: 0\r\n\r\n`);
    socket.destroy();
  }

  http.on("upgrade", (req: IncomingMessage, socket: Duplex, head: Buffer) => {
    socket.on("error", () => undefined);
    const origin = req.headers.origin;
    if (typeof origin !== "string" || !origins.has(origin)) {
      logger.info("upgrade_rejected", { why: "origin" });
      reject(socket, "403 Forbidden");
      return;
    }
    const ip = clientIp(req, trustProxy);
    if ((connsPerIp.get(ip) ?? 0) >= limits.maxConnectionsPerIp) {
      logger.info("upgrade_rejected", { why: "ip-cap" });
      reject(socket, "429 Too Many Requests");
      return;
    }
    wss.handleUpgrade(req, socket, head, (ws) => {
      connsPerIp.set(ip, (connsPerIp.get(ip) ?? 0) + 1);
      const conn: Conn = {
        ws,
        ip,
        bucket: new TokenBucket(limits.messageBurst, limits.messagesPerSecond, clock.now()),
        room: null,
        seat: null,
      };
      conns.add(conn);
      ws.on("message", (data, isBinary) => {
        onMessage(conn, data, isBinary);
      });
      ws.on("error", () => undefined);
      ws.on("close", () => {
        conns.delete(conn);
        const n = (connsPerIp.get(ip) ?? 1) - 1;
        if (n <= 0) connsPerIp.delete(ip);
        else connsPerIp.set(ip, n);
        detach(conn);
      });
    });
  });

  return {
    listen() {
      return new Promise<number>((resolve, reject2) => {
        http.once("error", reject2);
        http.listen(options.port, options.host ?? "127.0.0.1", () => {
          http.off("error", reject2);
          resolve((http.address() as AddressInfo).port);
        });
      });
    },
    close() {
      for (const room of [...rooms.values()]) closeRoom(room);
      for (const conn of conns) conn.ws.terminate();
      wss.close();
      return new Promise<void>((resolve) => {
        http.close(() => {
          resolve();
        });
        http.closeAllConnections();
      });
    },
    roomCount: () => rooms.size,
  };
}
