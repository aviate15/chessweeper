/**
 * `pnpm play`: serve the game and the built web app from this machine and, unless --local,
 * expose it through a free public tunnel so friends can join. See docs/PLAY_ONLINE.md.
 *
 *   pnpm play                       # try tunnels in order until one works
 *   pnpm play --tunnel pinggy       # only one: cloudflared | pinggy | localhost.run | ngrok
 *   pnpm play --local               # no tunnel, http://localhost:<port> only
 *   pnpm play --verbose             # also show the tunnel tools' own output
 *
 * For each tunnel: start it, read its public URL, start the server allowing exactly that origin
 * (exact-match allowlist, nothing loosened), then check the public /healthz. If the link does
 * not work (for example the network blocks that tunnel), stop it and try the next one.
 */
import { spawn, spawnSync, type ChildProcess } from "node:child_process";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { createServer as createNetServer } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { pickTunnels, tunnelChoice, type TunnelContext, type TunnelProvider } from "../src/tunnels";

const root = fileURLToPath(new URL("../../../", import.meta.url));
const argv = process.argv.slice(2);
const local = argv.includes("--local");
const verbose = argv.includes("--verbose");
const port = Number(process.env.PLAY_PORT ?? "8080");
const ngrokDomain = process.env.NGROK_DOMAIN?.trim() ?? "";

const forever: ChildProcess[] = [];
let attempt: ChildProcess[] = [];
let sshDir: string | null = null;
let stopping = false;
let running = false;

function killAll(list: ChildProcess[]): void {
  for (const child of list) child.kill("SIGTERM");
}

function stop(code: number): never {
  if (!stopping) {
    stopping = true;
    killAll(attempt);
    killAll(forever);
    if (sshDir !== null) rmSync(sshDir, { recursive: true, force: true });
    console.log("\nStopped. The public link is dead and live games are gone.");
  }
  process.exit(code);
}

function fail(message: string): never {
  console.error(`\n${message}\n`);
  return stop(1);
}

function portIsFree(): Promise<boolean> {
  return new Promise((resolve) => {
    const probe = createNetServer();
    probe.once("error", () => {
      resolve(false);
    });
    // No host: binds the wildcard address, so a listener on any interface counts as "busy".
    probe.listen(port, () => {
      probe.close(() => {
        resolve(true);
      });
    });
  });
}

async function healthy(base: string): Promise<boolean> {
  try {
    const res = await fetch(`${base}/healthz`, {
      signal: AbortSignal.timeout(4000),
      headers: { "ngrok-skip-browser-warning": "1" },
    });
    return res.ok && (await res.text()) === "ok";
  } catch {
    return false;
  }
}

async function waitHealthy(base: string, seconds: number): Promise<boolean> {
  const deadline = Date.now() + seconds * 1000;
  while (Date.now() < deadline) {
    if (await healthy(base)) return true;
    await new Promise((r) => setTimeout(r, 1000));
  }
  return false;
}

function hasBinary(bin: string): boolean {
  return spawnSync("sh", ["-c", `command -v ${bin}`], { stdio: "ignore" }).status === 0;
}

/**
 * True when ngrok has an authtoken. `ngrok config check` only reports through its exit code;
 * its output is discarded so the config (and any token) is never read, printed or logged.
 */
function ngrokConfigured(): boolean {
  return spawnSync("ngrok", ["config", "check"], { stdio: "ignore" }).status === 0;
}

/** A throwaway SSH key and known_hosts for the SSH tunnels; removed on exit. */
function makeSshDir(): string {
  if (sshDir !== null) return sshDir;
  const dir = mkdtempSync(join(tmpdir(), "chessweeper-ssh-"));
  const made = spawnSync("ssh-keygen", ["-q", "-t", "ed25519", "-N", "", "-f", join(dir, "key")], {
    stdio: "ignore",
  });
  if (made.status !== 0) {
    rmSync(dir, { recursive: true, force: true });
    throw new Error("could not create a temporary SSH key");
  }
  sshDir = dir;
  return dir;
}

/** Starts one tunnel and resolves with its public URL, or rejects with the reason. */
function startTunnel(provider: TunnelProvider, ctx: TunnelContext): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn(provider.bin, [...provider.args(ctx)], {
      stdio: ["ignore", "pipe", "pipe"],
    });
    attempt.push(child);
    let found = false;
    const timer = setTimeout(() => {
      reject(new Error("no public URL within 30 seconds"));
    }, 30_000);
    const onData = (chunk: Buffer): void => {
      const text = chunk.toString("utf8");
      if (verbose) process.stderr.write(text);
      const url = provider.findUrl(text);
      if (url !== null) {
        found = true;
        clearTimeout(timer);
        resolve(url);
      }
    };
    child.stdout.on("data", onData);
    child.stderr.on("data", onData);
    const { apiUrl, urlFromApi } = provider;
    if (apiUrl !== undefined && urlFromApi !== undefined) {
      const poll = async (): Promise<void> => {
        while (!found) {
          try {
            const res = await fetch(apiUrl, { signal: AbortSignal.timeout(2000) });
            const url = res.ok ? urlFromApi(await res.json()) : null;
            if (url !== null) {
              found = true;
              clearTimeout(timer);
              resolve(url);
              return;
            }
          } catch {
            // The agent API is not up yet.
          }
          await new Promise((r) => setTimeout(r, 500));
        }
      };
      void poll();
    }
    child.once("error", (e) => {
      clearTimeout(timer);
      reject(e);
    });
    child.once("exit", (code) => {
      clearTimeout(timer);
      if (!found) reject(new Error(`exited early (code ${String(code)})`));
      else if (running)
        fail(`The ${provider.label} tunnel stopped, so the public link no longer works.`);
    });
  });
}

function startServer(origins: string[], cloudflareHeaders: boolean): ChildProcess {
  const server = spawn("node", [`${root}apps/server/dist/main.js`], {
    stdio: "inherit",
    env: {
      ...process.env,
      NODE_ENV: "production",
      HOST: "127.0.0.1",
      PORT: String(port),
      STATIC_DIR: `${root}apps/web/dist`,
      // Only Cloudflare adds CF-Connecting-IP. Other tunnels are not trusted for client IPs, so
      // their visitors share the per-IP limits (the socket address is the local tunnel client).
      TRUST_PROXY: cloudflareHeaders ? "cloudflare" : "none",
      ALLOWED_ORIGINS: origins.join(","),
      MAX_ROOMS: process.env.MAX_ROOMS ?? "200",
    },
  });
  attempt.push(server);
  server.once("exit", (code) => {
    if (running && !stopping) fail(`The game server stopped (code ${String(code)}).`);
  });
  return server;
}

function banner(link: string, note: string | null): void {
  const line = "=".repeat(64);
  const mac = process.platform === "darwin";
  console.log(`\n${line}`);
  console.log("Chessweeper is up.\n");
  console.log(`  ${local ? "Local link" : "Public link"}: ${link}${mac ? "   (copied)" : ""}`);
  if (!local) console.log(`  On this machine:  http://localhost:${String(port)}`);
  console.log("\nHow to play:");
  console.log("  1. Open the link, then Game > Online... > Create game.");
  console.log("  2. Click Copy link and send it to your friend (or give them the code).");
  console.log("  3. Your friend opens it and the game starts.\n");
  if (note !== null) console.log(`Note: ${note}\n`);
  console.log("Keep this window open. Press Ctrl+C to stop. Closing the lid puts the laptop to");
  console.log("sleep and ends the games. The link changes every time you run this.");
  console.log(`${line}\n`);
}

const NOTES: Readonly<Record<string, string>> = {
  pinggy: "Pinggy's free tunnels end after 60 minutes. Restart to get a new link.",
  "localhost.run": "localhost.run's free links change after a few hours.",
  ngrok:
    "Friends may see an ngrok warning page once; they click Visit Site. ngrok free tunnels have no time limit.",
};

async function main(): Promise<void> {
  process.on("SIGINT", () => {
    stop(0);
  });
  process.on("SIGTERM", () => {
    stop(0);
  });

  if (
    !existsSync(`${root}apps/web/dist/index.html`) ||
    !existsSync(`${root}apps/server/dist/main.js`)
  ) {
    fail("Build output missing. Run it as `pnpm play` (it builds first).");
  }
  if (!Number.isInteger(port) || port < 1 || port > 65535) fail("PLAY_PORT is not a valid port.");
  if (!(await portIsFree())) {
    fail(`Port ${String(port)} is busy. Stop whatever uses it or set PLAY_PORT=<other port>.`);
  }

  const localUrl = `http://localhost:${String(port)}`;
  const localOrigins = [localUrl, `http://127.0.0.1:${String(port)}`];

  let link = localUrl;
  let note: string | null = null;

  if (local) {
    startServer(localOrigins, false);
    if (!(await waitHealthy(localUrl, 15))) fail("The game server did not start.");
  } else {
    const choice = tunnelChoice(argv);
    const providers = pickTunnels(choice);
    if (providers === null) {
      fail("Unknown --tunnel. Use auto, cloudflared, pinggy, localhost.run or ngrok.");
    }
    const tried: string[] = [];
    let ok = false;
    for (const provider of providers) {
      if (!hasBinary(provider.bin)) {
        tried.push(`${provider.id}: ${provider.bin} is not installed`);
        continue;
      }
      if (provider.id === "ngrok" && !ngrokConfigured()) {
        tried.push(
          "ngrok: not configured (run `ngrok config add-authtoken <token>`, docs/PLAY_ONLINE.md)",
        );
        continue;
      }
      process.stdout.write(`Trying ${provider.label}... `);
      attempt = [];
      try {
        const ctx: TunnelContext = {
          port,
          sshDir: provider.bin === "ssh" ? makeSshDir() : "",
          ngrokDomain: ngrokDomain === "" ? null : ngrokDomain,
        };
        const url = await startTunnel(provider, ctx);
        startServer([url, ...localOrigins], provider.cloudflareHeaders);
        if (!(await waitHealthy(localUrl, 15))) throw new Error("the game server did not start");
        if (!(await waitHealthy(url, 30))) throw new Error("the public link did not answer");
        console.log("works.");
        forever.push(...attempt);
        link = url;
        note = NOTES[provider.id] ?? null;
        ok = true;
        break;
      } catch (e) {
        const reason = e instanceof Error ? e.message : "failed";
        console.log(`no (${reason}).`);
        tried.push(`${provider.id}: ${reason}`);
        killAll(attempt);
        attempt = [];
        await new Promise((r) => setTimeout(r, 500));
      }
    }
    if (!ok) {
      fail(
        [
          "No public tunnel worked, so friends could not reach you:",
          ...tried.map((t) => `  - ${t}`),
          "",
          "Your network probably blocks these. Try another network or a phone hotspot,",
          "set up ngrok (docs/PLAY_ONLINE.md), run with --verbose to see the tools' output,",
          "or play on this machine with `pnpm play --local`.",
        ].join("\n"),
      );
    }
  }

  running = true;
  if (process.platform === "darwin") {
    spawnSync("pbcopy", { input: link });
    // Keep the laptop awake (idle sleep) for as long as this command runs.
    forever.push(spawn("caffeinate", ["-i", "-w", String(process.pid)], { stdio: "ignore" }));
  }
  banner(link, note);
}

await main();
