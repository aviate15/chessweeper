// Shared helpers for server tests. Not exported from the package index.
import { WebSocket } from "ws";
import { createSeededRng, type GameSettings, type Rng } from "@chessweeper/engine";
import { serverMessageSchema, type ServerMessage } from "@chessweeper/protocol";
import type { Clock } from "./clock";
import { createLogger } from "./log";
import type { ProxyMode } from "./ip";
import type { Limits } from "./limits";
import type { StaticSite } from "./static";
import { createServer, type RunningServer } from "./server";

export const ORIGIN = "http://app.test";

/** A clock whose time only moves when a test says so. */
export class FakeClock implements Clock {
  private t = 0;
  private nextId = 1;
  private readonly timers = new Map<number, { at: number; fn: () => void }>();

  now(): number {
    return this.t;
  }
  setTimeout(fn: () => void, ms: number): unknown {
    const id = this.nextId++;
    this.timers.set(id, { at: this.t + ms, fn });
    return id;
  }
  clearTimeout(handle: unknown): void {
    if (typeof handle === "number") this.timers.delete(handle);
  }
  /** Moves time forward, firing due timers in order. */
  advance(ms: number): void {
    const target = this.t + ms;
    for (;;) {
      let nextId: number | null = null;
      for (const [id, timer] of this.timers) {
        if (
          timer.at <= target &&
          (nextId === null || timer.at < (this.timers.get(nextId)?.at ?? Infinity))
        ) {
          nextId = id;
        }
      }
      if (nextId === null) break;
      const timer = this.timers.get(nextId);
      this.timers.delete(nextId);
      if (timer !== undefined) {
        this.t = Math.max(this.t, timer.at);
        timer.fn();
      }
    }
    this.t = target;
  }
}

export interface Harness {
  readonly server: RunningServer;
  readonly url: string;
  readonly clock: FakeClock;
  readonly logs: string[];
  /** Resolves once a log line containing `text` has been written (event driven). */
  logged(text: string, count?: number): Promise<void>;
  readonly clients: TestClient[];
  connect(opts?: { origin?: string | null; headers?: Record<string, string> }): Promise<TestClient>;
  stop(): Promise<void>;
}

export async function startHarness(
  opts: {
    rng?: Rng;
    limits?: Partial<Limits>;
    trustProxy?: boolean | ProxyMode;
    staticSite?: StaticSite;
    allowedOrigins?: string[];
  } = {},
): Promise<Harness> {
  const clock = new FakeClock();
  const logs: string[] = [];
  const logWaiters: { text: string; count: number; resolve: () => void }[] = [];
  const server = createServer({
    port: 0,
    host: "127.0.0.1",
    rng: opts.rng ?? createSeededRng(1),
    clock,
    allowedOrigins: opts.allowedOrigins ?? [ORIGIN],
    // The fake clock never refills buckets, so give ordinary tests a roomy burst.
    limits: { messageBurst: 10_000, ...opts.limits },
    trustProxy: opts.trustProxy ?? false,
    ...(opts.staticSite === undefined ? {} : { staticSite: opts.staticSite }),
    logger: createLogger((line) => {
      logs.push(line);
      for (const w of logWaiters) {
        if (logs.filter((l) => l.includes(w.text)).length >= w.count) w.resolve();
      }
    }),
  });
  const port = await server.listen();
  const url = `ws://127.0.0.1:${String(port)}`;
  const clients: TestClient[] = [];
  return {
    server,
    url,
    clock,
    logs,
    logged: (text, count = 1) =>
      logs.filter((l) => l.includes(text)).length >= count
        ? Promise.resolve()
        : new Promise<void>((resolve) => {
            logWaiters.push({ text, count, resolve });
          }),
    clients,
    async connect(o = {}) {
      const client = await TestClient.connect(
        url,
        o.origin === undefined ? ORIGIN : o.origin,
        o.headers,
      );
      clients.push(client);
      return client;
    },
    async stop() {
      for (const c of clients) c.ws.terminate();
      await server.close();
    },
  };
}

export type Msg<T extends ServerMessage["type"]> = Extract<ServerMessage, { type: T }>;

/** Test client. Every received frame is validated against the strict outgoing schema. */
export class TestClient {
  readonly frames: string[] = [];
  private readonly queue: ServerMessage[] = [];
  private waiter: (() => void) | null = null;
  closeCode: number | null = null;
  readonly closed: Promise<number>;

  private constructor(readonly ws: WebSocket) {
    ws.on("message", (data) => {
      const raw = (data as Buffer).toString("utf8");
      this.frames.push(raw);
      const parsed = serverMessageSchema.safeParse(JSON.parse(raw));
      if (!parsed.success) throw new Error(`Frame failed the strict schema: ${raw.slice(0, 200)}`);
      this.queue.push(parsed.data);
      this.waiter?.();
    });
    this.closed = new Promise<number>((resolve) => {
      ws.on("close", (code) => {
        this.closeCode = code;
        this.waiter?.();
        resolve(code);
      });
    });
  }

  static connect(
    url: string,
    origin: string | null,
    headers?: Record<string, string>,
  ): Promise<TestClient> {
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(url, {
        ...(origin === null ? {} : { origin }),
        ...(headers === undefined ? {} : { headers }),
      });
      const client = new TestClient(ws);
      ws.once("open", () => {
        resolve(client);
      });
      ws.once("unexpected-response", (_req, res) => {
        reject(new Error(`status ${String(res.statusCode)}`));
      });
      ws.once("error", (e) => {
        reject(e);
      });
    });
  }

  send(message: unknown): void {
    this.ws.send(JSON.stringify(message));
  }

  sendRaw(raw: string): void {
    this.ws.send(raw);
  }

  /** Waits for (and removes) the first queued message matching the predicate. */
  async next<T extends ServerMessage["type"]>(
    type: T,
    pred: (m: Msg<T>) => boolean = () => true,
  ): Promise<Msg<T>> {
    for (;;) {
      const idx = this.queue.findIndex((m) => m.type === type && pred(m as Msg<T>));
      if (idx >= 0) return this.queue.splice(idx, 1)[0] as Msg<T>;
      if (this.closeCode !== null)
        throw new Error(`closed (${String(this.closeCode)}) waiting for ${type}`);
      await new Promise<void>((resolve) => {
        this.waiter = resolve;
      });
    }
  }

  /** Round-trips a ping so that everything the server sent earlier is in the queue. */
  async sync(): Promise<ServerMessage[]> {
    this.send({ type: "ping" });
    await this.next("pong");
    return this.queue.splice(0);
  }

  async create(settings?: GameSettings): Promise<Msg<"joined">> {
    this.send({ type: "create_room", ...(settings === undefined ? {} : { settings }) });
    return this.next("joined");
  }

  async join(code: string, token?: string): Promise<Msg<"joined">> {
    this.send({ type: "join_room", code, ...(token === undefined ? {} : { token }) });
    return this.next("joined");
  }

  close(): Promise<number> {
    this.ws.close();
    return this.closed;
  }
}

/** Opens two clients in one room: White created it, Black joined. */
export async function twoPlayers(h: Harness, settings?: GameSettings) {
  const a = await h.connect();
  const ja = await a.create(settings);
  const b = await h.connect();
  const jb = await b.join(ja.code);
  await a.next("opponent", (m) => m.state === "connected");
  return { a, b, ja, jb };
}
