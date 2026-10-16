/**
 * Entry point. Reads the environment (see config.ts) and listens.
 *
 * TLS: the server speaks plain ws. In production it must run behind a proxy that terminates
 * TLS (Fly.io in front of this process), so clients connect over wss://. Set TRUST_PROXY=1
 * only there, so per-IP limits read Fly-Client-IP instead of the proxy's address. Set
 * ALLOWED_ORIGINS to the deployed web origin(s); with it unset every upgrade is refused.
 */
import { loadConfig } from "./config";
import { createServer } from "./server";

const config = loadConfig(process.env);
const server = createServer({
  port: config.port,
  host: config.host,
  allowedOrigins: config.allowedOrigins,
  trustProxy: config.trustProxy,
});
const port = await server.listen();
console.log(JSON.stringify({ event: "listening", port, origins: config.allowedOrigins.length }));

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.once(signal, () => {
    void server.close().then(() => process.exit(0));
  });
}
