/**
 * `pnpm play`: serve the game and the built web app from this machine and, unless --local,
 * expose it with a free Cloudflare quick tunnel (cloudflared, no account) so friends can join.
 * See docs/PLAY_ONLINE.md.
 *
 *   pnpm play              # tunnel + server, prints the public URL
 *   pnpm play --local      # no tunnel, http://localhost:<port> only
 *   pnpm play --verbose    # also show cloudflared's own log
 *
 * Order matters: cloudflared starts first so its random URL is known, and the server is then
 * started with exactly that origin allowed (exact-match allowlist, nothing loosened).
 */
import { spawn, spawnSync, type ChildProcess } from "node:child_process";
import { existsSync } from "node:fs";
import { createServer as createNetServer } from "node:net";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../../../", import.meta.url));
const args = new Set(process.argv.slice(2));
const local = args.has("--local");
const verbose = args.has("--verbose");
const port = Number(process.env.PLAY_PORT ?? "8080");
const children: ChildProcess[] = [];
let stopping = false;

function stop(code: number): never {
  if (!stopping) {
    stopping = true;
    for (const child of children) child.kill("SIGTERM");
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
    const res = await fetch(`${base}/healthz`, { signal: AbortSignal.timeout(3000) });
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

function startTunnel(): Promise<string> {
  return new Promise((resolve, reject) => {
    const tunnel = spawn(
      "cloudflared",
      ["tunnel", "--no-autoupdate", "--url", `http://127.0.0.1:${String(port)}`],
      { stdio: ["ignore", "pipe", "pipe"] },
    );
    children.push(tunnel);
    const timer = setTimeout(() => {
      reject(new Error("cloudflared did not report a public URL within 30 seconds."));
    }, 30_000);
    let found = false;
    const onData = (chunk: Buffer): void => {
      const text = chunk.toString("utf8");
      if (verbose) process.stderr.write(text);
      const match = /https:\/\/[a-z0-9-]+\.trycloudflare\.com/.exec(text);
      if (match !== null && !found) {
        found = true;
        clearTimeout(timer);
        resolve(match[0]);
      }
    };
    tunnel.stdout.on("data", onData);
    tunnel.stderr.on("data", onData);
    tunnel.once("exit", (code) => {
      if (!found) {
        clearTimeout(timer);
        reject(new Error(`cloudflared exited early (code ${String(code)}). Run with --verbose.`));
      } else {
        fail("cloudflared stopped, so the public link no longer works.");
      }
    });
  });
}

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

  let publicUrl: string | null = null;
  if (!local) {
    if (spawnSync("cloudflared", ["--version"], { stdio: "ignore" }).status !== 0) {
      fail("cloudflared is not installed. Run: brew install cloudflared");
    }
    console.log("Starting the tunnel...");
    try {
      publicUrl = await startTunnel();
    } catch (e) {
      fail(e instanceof Error ? e.message : "Could not start the tunnel.");
    }
  }

  const localUrl = `http://localhost:${String(port)}`;
  const origins = [localUrl, `http://127.0.0.1:${String(port)}`];
  if (publicUrl !== null) origins.unshift(publicUrl);

  const server = spawn("node", [`${root}apps/server/dist/main.js`], {
    stdio: "inherit",
    env: {
      ...process.env,
      NODE_ENV: "production",
      HOST: "127.0.0.1",
      PORT: String(port),
      STATIC_DIR: `${root}apps/web/dist`,
      TRUST_PROXY: local ? "none" : "cloudflare",
      ALLOWED_ORIGINS: origins.join(","),
      MAX_ROOMS: process.env.MAX_ROOMS ?? "200",
    },
  });
  children.push(server);
  server.once("exit", (code) => {
    fail(`The game server stopped (code ${String(code)}).`);
  });

  if (!(await waitHealthy(localUrl, 15))) fail("The game server did not start.");

  if (publicUrl !== null) {
    console.log("Waiting for the public link to come up (new tunnels take a few seconds)...");
    if (!(await waitHealthy(publicUrl, 60))) {
      fail(
        [
          "The public link never came up, so friends could not reach you.",
          "cloudflared needs outbound access to Cloudflare on port 7844 (UDP, or TCP as a fallback).",
          "Some networks block it (campus, work, hotel wifi, VPNs, firewalls). Try another network",
          "or a phone hotspot. Run `pnpm play --verbose` to see cloudflared's own log.",
          "You can still play on this machine with `pnpm play --local`.",
        ].join("\n"),
      );
    }
  }

  const link = publicUrl ?? localUrl;
  if (process.platform === "darwin") {
    spawnSync("pbcopy", { input: link });
    // Keep the laptop awake (idle sleep) for as long as this command runs.
    children.push(spawn("caffeinate", ["-i", "-w", String(process.pid)], { stdio: "ignore" }));
  }

  const line = "=".repeat(64);
  console.log(`\n${line}`);
  console.log("Chessweeper is up.\n");
  console.log(
    `  ${local ? "Local link" : "Public link"}: ${link}${process.platform === "darwin" ? "   (copied)" : ""}`,
  );
  if (publicUrl !== null) console.log(`  On this machine:  ${localUrl}`);
  console.log("\nHow to play:");
  console.log("  1. Open the link, then Game > Online... > Create game.");
  console.log("  2. Click Copy link and send it to your friend (or give them the code).");
  console.log("  3. Your friend opens it and the game starts.\n");
  console.log("Keep this window open. Press Ctrl+C to stop. Closing the lid puts the laptop to");
  console.log("sleep and ends the games. The link changes every time you run this.");
  console.log(`${line}\n`);
}

await main();
