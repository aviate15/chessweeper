import {
  clientMessageSchema,
  serverMessageSchema,
  type ClientMessage,
  type ErrorCode,
  type ServerMessage,
} from "@chessweeper/protocol";
import type { GameSettings, Square } from "@chessweeper/engine";
import type { FatalReason } from "./errors";

/** The slice of the browser WebSocket the client uses, so tests can supply a fake. */
export interface SocketLike {
  readonly readyState: number;
  send(data: string): void;
  close(code?: number): void;
  onopen: (() => void) | null;
  onmessage: ((event: { readonly data: unknown }) => void) | null;
  onclose: ((event: { readonly code: number }) => void) | null;
  onerror: (() => void) | null;
}

export type SocketFactory = (url: string) => SocketLike;

export interface Timers {
  setTimeout(fn: () => void, ms: number): unknown;
  clearTimeout(handle: unknown): void;
  setInterval(fn: () => void, ms: number): unknown;
  clearInterval(handle: unknown): void;
}

export const browserTimers: Timers = {
  setTimeout: (fn, ms) => globalThis.setTimeout(fn, ms),
  clearTimeout: (h) => {
    globalThis.clearTimeout(h as number);
  },
  setInterval: (fn, ms) => globalThis.setInterval(fn, ms),
  clearInterval: (h) => {
    globalThis.clearInterval(h as number);
  },
};

/** WebSocket.OPEN, spelled out so fakes need no global. */
export const SOCKET_OPEN = 1;

export type ConnectionState = "connecting" | "open" | "reconnecting" | "closed";

export type ClientEvent =
  | { readonly type: "connection"; readonly state: ConnectionState }
  | (ServerMessage & { readonly type: "joined" | "snapshot" | "update" | "game_over" })
  | (ServerMessage & { readonly type: "opponent" | "draw" | "placement" })
  /** A server error, or `protocol` when a frame failed validation. */
  | { readonly type: "error"; readonly code: ErrorCode | "protocol" }
  | { readonly type: "fatal"; readonly reason: FatalReason };

export type ClientListener = (event: ClientEvent) => void;

/** Reconnect delays in ms; the last value repeats. */
export const BACKOFF_MS: readonly number[] = [500, 1000, 2000, 4000, 8000, 10_000];
export const PING_INTERVAL_MS = 25_000;

export interface OnlineClientOptions {
  readonly url: string;
  readonly createSocket: SocketFactory;
  readonly timers?: Timers;
}

/**
 * Talks the wire protocol to the server. No React, no engine state: it validates every frame
 * in both directions, tracks the move sequence number and reconnects with the seat token.
 */
export class OnlineClient {
  private readonly url: string;
  private readonly createSocket: SocketFactory;
  private readonly timers: Timers;
  private readonly listeners = new Set<ClientListener>();

  private socket: SocketLike | null = null;
  private code: string | null = null;
  private token: string | null = null;
  private seq: number | null = null;
  private connection: ConnectionState = "closed";
  /** First message sent on open: create a room, or join one (with a token on a resume). */
  private opening: ClientMessage | null = null;
  /** True once this socket has been confirmed with `joined`. */
  private joinedOnThisSocket = false;
  private attempt = 0;
  private retryTimer: unknown;
  private pingTimer: unknown;
  private stopped = false;
  private finished = false;

  constructor(options: OnlineClientOptions) {
    this.url = options.url;
    this.createSocket = options.createSocket;
    this.timers = options.timers ?? browserTimers;
  }

  subscribe(listener: ClientListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  get state(): ConnectionState {
    return this.connection;
  }

  // ---- entry points ----

  create(settings?: GameSettings): void {
    this.start(
      settings === undefined ? { type: "create_room" } : { type: "create_room", settings },
    );
  }

  /** Joins a room. With a stored token this is a resume of an existing seat. */
  join(code: string, token?: string): void {
    this.code = code;
    if (token !== undefined) this.token = token;
    this.start(
      token === undefined ? { type: "join_room", code } : { type: "join_room", code, token },
    );
  }

  /** Stops for good: no reconnects, the socket is closed. */
  close(): void {
    this.stopped = true;
    this.teardownSocket();
    this.timers.clearTimeout(this.retryTimer);
    this.retryTimer = undefined;
    this.setConnection("closed");
  }

  // ---- outbound ----

  /** Returns false when the move could not be sent (not connected, or no view yet). */
  move(from: Square, to: Square, promo?: "n" | "b" | "r" | "q"): boolean {
    if (this.seq === null) return false;
    const base = { type: "move", seq: this.seq, from, to } as const;
    return this.send(promo === undefined ? base : { ...base, promo });
  }

  /** Manual mine mode (3.10): put one of my mines on a square (private until the round ends). */
  place(sq: Square): boolean {
    return this.send({ type: "place", sq });
  }

  unplace(sq: Square): boolean {
    return this.send({ type: "unplace", sq });
  }

  /** Done placing; the server random-fills anything below my quota. */
  placementDone(): boolean {
    return this.send({ type: "placement_done" });
  }

  resign(): boolean {
    return this.send({ type: "resign" });
  }

  offerDraw(): boolean {
    return this.send({ type: "draw_offer" });
  }

  replyDraw(accept: boolean): boolean {
    return this.send({ type: "draw_reply", accept });
  }

  claimWin(): boolean {
    return this.send({ type: "claim_win" });
  }

  /** Validates, then sends. A message that fails the schema is never put on the wire. */
  private send(message: ClientMessage): boolean {
    const socket = this.socket;
    if (socket?.readyState !== SOCKET_OPEN) return false;
    if (!clientMessageSchema.safeParse(message).success) return false;
    socket.send(JSON.stringify(message));
    return true;
  }

  // ---- connection lifecycle ----

  private start(opening: ClientMessage): void {
    this.stopped = false;
    this.finished = false;
    this.opening = opening;
    this.attempt = 0;
    this.open("connecting");
  }

  private open(state: ConnectionState): void {
    this.setConnection(state);
    this.joinedOnThisSocket = false;
    const socket = this.createSocket(this.url);
    this.socket = socket;
    socket.onopen = () => {
      if (this.socket !== socket) return;
      this.setConnection("open");
      this.startPing();
      if (this.opening !== null) this.sendRaw(socket, this.opening);
    };
    socket.onmessage = (event) => {
      if (this.socket !== socket) return;
      this.onFrame(event.data);
    };
    socket.onclose = (event) => {
      if (this.socket !== socket) return;
      this.onClosed(event.code);
    };
    socket.onerror = () => undefined;
  }

  private sendRaw(socket: SocketLike, message: ClientMessage): void {
    if (clientMessageSchema.safeParse(message).success) socket.send(JSON.stringify(message));
  }

  private teardownSocket(): void {
    this.timers.clearInterval(this.pingTimer);
    this.pingTimer = undefined;
    const socket = this.socket;
    this.socket = null;
    if (socket !== null) {
      socket.onopen = null;
      socket.onmessage = null;
      socket.onclose = null;
      socket.onerror = null;
      socket.close();
    }
  }

  private startPing(): void {
    this.timers.clearInterval(this.pingTimer);
    this.pingTimer = this.timers.setInterval(() => {
      this.send({ type: "ping" });
    }, PING_INTERVAL_MS);
  }

  private onClosed(code: number): void {
    this.timers.clearInterval(this.pingTimer);
    this.pingTimer = undefined;
    this.socket = null;
    if (this.stopped || this.finished) {
      this.setConnection("closed");
      return;
    }
    if (code === 1000) {
      this.fatal("taken-over");
      return;
    }
    if (code === 1001) {
      this.fatal("room-closed");
      return;
    }
    // Without a token there is no seat to resume, and a retry could create a second room.
    if (this.token === null || this.code === null) {
      this.fatal("connect-failed");
      return;
    }
    this.scheduleReconnect();
  }

  private scheduleReconnect(): void {
    this.setConnection("reconnecting");
    const delay = BACKOFF_MS[Math.min(this.attempt, BACKOFF_MS.length - 1)] ?? 10_000;
    this.attempt += 1;
    this.retryTimer = this.timers.setTimeout(() => {
      this.retryTimer = undefined;
      if (this.stopped || this.code === null || this.token === null) return;
      this.opening = { type: "join_room", code: this.code, token: this.token };
      this.open("reconnecting");
    }, delay);
  }

  private fatal(reason: FatalReason): void {
    this.stopped = true;
    this.teardownSocket();
    this.timers.clearTimeout(this.retryTimer);
    this.retryTimer = undefined;
    this.setConnection("closed");
    this.emit({ type: "fatal", reason });
  }

  // ---- inbound ----

  private onFrame(data: unknown): void {
    if (typeof data !== "string") {
      this.emit({ type: "error", code: "protocol" });
      return;
    }
    let json: unknown;
    try {
      json = JSON.parse(data);
    } catch {
      this.emit({ type: "error", code: "protocol" });
      return;
    }
    const parsed = serverMessageSchema.safeParse(json);
    if (!parsed.success) {
      this.emit({ type: "error", code: "protocol" });
      return;
    }
    this.onMessage(parsed.data);
  }

  private onMessage(message: ServerMessage): void {
    switch (message.type) {
      case "joined":
        this.code = message.code;
        this.token = message.token;
        this.joinedOnThisSocket = true;
        this.attempt = 0;
        this.emit(message);
        return;
      case "snapshot":
      case "update":
        this.seq = message.seq;
        this.emit(message);
        return;
      case "game_over":
        // The game is decided: no reason to keep reconnecting afterwards.
        this.finished = true;
        this.emit(message);
        return;
      case "opponent":
      case "draw":
      case "placement":
        this.emit(message);
        return;
      case "error":
        this.onServerError(message.code);
        return;
      case "pong":
        return;
    }
  }

  private onServerError(code: ErrorCode): void {
    if (!this.joinedOnThisSocket && this.token !== null) {
      // A failed resume: the room is gone or the token is no longer valid.
      if (code === "room-not-found" || code === "forbidden") {
        this.fatal("game-gone");
        return;
      }
    }
    if (code === "stale-seq") {
      // Our view is behind. Drop the socket and rejoin to get a fresh snapshot.
      this.emit({ type: "error", code });
      if (this.token !== null && this.code !== null) {
        this.teardownSocket();
        this.attempt = 0;
        this.scheduleReconnect();
      }
      return;
    }
    this.emit({ type: "error", code });
  }

  // ---- plumbing ----

  private setConnection(state: ConnectionState): void {
    if (this.connection === state) return;
    this.connection = state;
    this.emit({ type: "connection", state });
  }

  private emit(event: ClientEvent): void {
    for (const listener of [...this.listeners]) listener(event);
  }
}
