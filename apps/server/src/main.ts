/**
 * Entry point. Reads the environment (see config.ts) and listens.
 *
 * Production: `pnpm --filter @chessweeper/server build` bundles this file to dist/main.js and
 * `start` runs it. See docs/DEPLOY.md.
 *
 * TLS: the server speaks plain ws. In production it must run behind a proxy that terminates
 * TLS (Fly.io in front of this process), so clients connect over wss://. Set TRUST_PROXY=1
 * only there, so per-IP limits read Fly-Client-IP instead of the proxy's address. Set
 * ALLOWED_ORIGINS to the deployed web origin(s); with it unset every upgrade is refused.
 */
import { loadConfig } from "./config";
import { createServer } from "./server";
import { loadStaticSite } from "./static";

const config = loadConfig(process.env);
const staticSite = config.staticDir === null ? undefined : loadStaticSite(config.staticDir);
const server = createServer({
  port: config.port,
  host: config.host,
  allowedOrigins: config.allowedOrigins,
  trustProxy: config.trustProxy,
  limits: config.limits,
  ...(staticSite === undefined ? {} : { staticSite }),
});
const port = await server.listen();
// Numbers only: never the origin list or any other environment value.
console.log(
  JSON.stringify({
    event: "listening",
    port,
    origins: config.allowedOrigins.length,
    proxy: config.trustProxy,
    static: staticSite?.fileCount ?? 0,
    ...config.limits,
  }),
);

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.once(signal, () => {
    void server.close().then(() => process.exit(0));
  });
}
