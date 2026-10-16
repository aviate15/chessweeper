import { isIP } from "node:net";
import type { IncomingMessage } from "node:http";

/** Which proxy, if any, sits in front of the server and may be believed about client IPs. */
export type ProxyMode = "none" | "fly" | "cloudflare";

const LOOPBACK = new Set(["127.0.0.1", "::1", "::ffff:127.0.0.1"]);

/**
 * The client IP used for per-IP limits. Headers are never trusted by default.
 * - `fly`: `Fly-Client-IP` is read (the server sits behind Fly's proxy).
 * - `cloudflare`: `CF-Connecting-IP` is read, but only when the TCP peer is loopback, i.e. a
 *   local cloudflared. Anything else on the network cannot set it.
 * In both modes the header must be a valid IP; otherwise the socket address is used.
 */
export function clientIp(req: IncomingMessage, proxy: ProxyMode | boolean): string {
  const mode: ProxyMode = proxy === true ? "fly" : proxy === false ? "none" : proxy;
  const peer = req.socket.remoteAddress ?? "unknown";
  if (mode === "fly") {
    const header = req.headers["fly-client-ip"];
    if (typeof header === "string" && isIP(header) !== 0) return header;
  } else if (mode === "cloudflare" && LOOPBACK.has(peer)) {
    const header = req.headers["cf-connecting-ip"];
    if (typeof header === "string" && isIP(header) !== 0) return header;
  }
  return peer;
}
