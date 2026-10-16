/**
 * Post-deploy smoke check. Needs no credentials; talks to the public URLs only.
 *
 *   pnpm --filter @chessweeper/server smoke -- --server https://chessweeper-server.fly.dev \
 *     --web https://your-app.vercel.app [--wait-close]
 *
 * Plays a throwaway game (create, join, resign) over the real WebSocket path. Exit code 1 if
 * any check fails. --wait-close also waits for the server to free the finished room (~2 min).
 * --skip-headers skips the Vercel header checks (for a local `vite preview`, which sets none).
 */
import { WebSocket } from "ws";

interface Args {
  server: string;
  web: string | null;
  waitClose: boolean;
  skipHeaders: boolean;
}

function parseArgs(argv: readonly string[]): Args {
  let server: string | null = null;
  let web: string | null = null;
  let waitClose = false;
  let skipHeaders = false;
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--server") server = argv[++i] ?? null;
    else if (arg === "--web") web = argv[++i] ?? null;
    else if (arg === "--wait-close") waitClose = true;
    else if (arg === "--skip-headers") skipHeaders = true;
  }
  if (server === null) {
    console.error(
      "usage: smoke --server https://<fly-app>.fly.dev [--web https://<vercel>] [--wait-close] [--skip-headers]",
    );
    process.exit(2);
  }
  return {
    server: server.replace(/\/+$/, ""),
    web: web?.replace(/\/+$/, "") ?? null,
    waitClose,
    skipHeaders,
  };
}

let failures = 0;
function report(name: string, ok: boolean, detail = ""): void {
  if (!ok) failures += 1;
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail === "" ? "" : `  (${detail})`}`);
}

async function check(name: string, fn: () => Promise<string | undefined>): Promise<void> {
  try {
    const detail = await fn();
    report(name, true, detail ?? "");
  } catch (e) {
    report(name, false, e instanceof Error ? e.message : "error");
  }
}

function must(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

interface Client {
  readonly ws: WebSocket;
  readonly frames: string[];
  next(type: string, ms?: number): Promise<Record<string, unknown>>;
  closed: Promise<number>;
}

function open(wsUrl: string, origin: string): Promise<Client> {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(wsUrl, { headers: { Origin: origin } });
    const frames: string[] = [];
    const queue: Record<string, unknown>[] = [];
    let wake: (() => void) | null = null;
    const closed = new Promise<number>((res) => {
      ws.on("close", (code) => {
        res(code);
      });
    });
    ws.on("message", (data) => {
      const text = (data as Buffer).toString("utf8");
      frames.push(text);
      queue.push(JSON.parse(text) as Record<string, unknown>);
      wake?.();
    });
    ws.once("unexpected-response", (_req, res) => {
      reject(new Error(`status ${String(res.statusCode)}`));
    });
    ws.once("error", (e) => {
      reject(e);
    });
    ws.once("open", () => {
      resolve({
        ws,
        frames,
        closed,
        async next(type, ms = 10_000) {
          const deadline = Date.now() + ms;
          for (;;) {
            const i = queue.findIndex((m) => m.type === type);
            if (i >= 0) return queue.splice(i, 1)[0] ?? {};
            const left = deadline - Date.now();
            if (left <= 0) throw new Error(`timeout waiting for ${type}`);
            await new Promise<void>((res) => {
              const t = setTimeout(res, left);
              wake = () => {
                clearTimeout(t);
                res();
              };
            });
            wake = null;
          }
        },
      });
    });
  });
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const wsUrl = args.server.replace(/^http/, "ws");
  const origin = args.web ?? "https://smoke-test.invalid";

  await check("server /healthz is 200 ok", async () => {
    const res = await fetch(`${args.server}/healthz`);
    must(res.status === 200, `status ${String(res.status)}`);
    must((await res.text()) === "ok", "body is not ok");
    return undefined;
  });

  await check("server 404s unknown paths", async () => {
    const res = await fetch(`${args.server}/nope`);
    must(res.status === 404, `status ${String(res.status)}`);
    return undefined;
  });

  if (args.web !== null) {
    const web = args.web;
    await check("web / serves the app, with security headers", async () => {
      const res = await fetch(`${web}/`);
      must(res.status === 200, `status ${String(res.status)}`);
      must(res.headers.get("content-type")?.includes("text/html") === true, "not html");
      if (args.skipHeaders) return "headers skipped";
      must(res.headers.get("x-content-type-options") === "nosniff", "missing nosniff");
      const csp = res.headers.get("content-security-policy") ?? "";
      must(csp.includes("default-src 'self'"), "missing CSP");
      must(csp.includes(new URL(wsUrl).host), "CSP does not allow the game server");
      return undefined;
    });

    await check("web /?join=ABCDEF falls back to the app (SPA rewrite)", async () => {
      const res = await fetch(`${web}/?join=ABCDEF`);
      must(res.status === 200, `status ${String(res.status)}`);
      must((await res.text()).includes('id="root"'), "not the app shell");
      return undefined;
    });

    await check("web bundle points at the game server", async () => {
      const html = await (await fetch(`${web}/`)).text();
      const m = /src="\.?\/?(assets\/index-[^"]+\.js)"/.exec(html);
      must(m !== null, "main script not found");
      const js = await (await fetch(`${web}/${m?.[1] ?? ""}`)).text();
      must(
        js.includes(wsUrl),
        `bundle does not contain ${wsUrl} (VITE_SERVER_URL wrong at build time?)`,
      );
      return undefined;
    });
  } else {
    console.log("SKIP  web checks (no --web given)");
  }

  await check("WebSocket from a foreign Origin is refused", async () => {
    try {
      const c = await open(wsUrl, "https://evil.invalid");
      c.ws.terminate();
    } catch (e) {
      must((e as Error).message.includes("403"), (e as Error).message);
      return undefined;
    }
    throw new Error("upgrade was accepted");
  });

  const finished: { closed: Promise<number> | null } = { closed: null };
  await check("two players can create, join and resign; no mines in snapshots", async () => {
    const a = await open(wsUrl, origin);
    a.ws.send(JSON.stringify({ type: "create_room" }));
    const ja = await a.next("joined");
    await a.next("snapshot");
    const b = await open(wsUrl, origin);
    b.ws.send(JSON.stringify({ type: "join_room", code: ja.code }));
    const jb = await b.next("joined");
    await b.next("snapshot");
    must(ja.seat === "w" && jb.seat === "b", "unexpected seats");
    a.ws.send(JSON.stringify({ type: "resign" }));
    await a.next("game_over");
    await b.next("game_over");
    for (const client of [a, b]) {
      const end = client.frames.findIndex((f) => f.includes('"type":"game_over"'));
      for (const frame of client.frames.slice(0, end)) {
        must(!frame.includes('"mines"') && !frame.includes("hidden"), "hidden state in a frame");
      }
    }
    finished.closed = a.closed;
    return undefined;
  });

  if (args.waitClose && finished.closed !== null) {
    const closed = finished.closed;
    await check("finished room is freed (socket closed with 1001)", async () => {
      const code = await Promise.race([
        closed,
        new Promise<number>((res) => {
          setTimeout(() => {
            res(-1);
          }, 180_000);
        }),
      ]);
      must(code === 1001, `close code ${String(code)}`);
      return undefined;
    });
  }

  console.log(failures === 0 ? "\nAll checks passed." : `\n${String(failures)} check(s) failed.`);
  process.exit(failures === 0 ? 0 : 1);
}

await main();
