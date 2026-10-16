import { isIP } from "node:net";
import type { IncomingMessage } from "node:http";

/**
 * The client IP used for per-IP limits. Headers are never trusted by default: only when
 * `trustProxy` is on (the server sits behind Fly's proxy) is `Fly-Client-IP` read, and only
 * if it is a valid IP. Otherwise, or if the header is missing or bad, the socket address is used.
 */
export function clientIp(req: IncomingMessage, trustProxy: boolean): string {
  if (trustProxy) {
    const header = req.headers["fly-client-ip"];
    if (typeof header === "string" && isIP(header) !== 0) return header;
  }
  return req.socket.remoteAddress ?? "unknown";
}
