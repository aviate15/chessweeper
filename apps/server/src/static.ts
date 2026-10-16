import { readdirSync, readFileSync, statSync } from "node:fs";
import { extname, join } from "node:path";

export interface StaticResponse {
  readonly status: 200 | 404 | 405;
  readonly headers: Readonly<Record<string, string>>;
  readonly body: Buffer;
}

export interface StaticSite {
  readonly fileCount: number;
  /** `method` and the raw request URL in, a response out. Never touches the disk. */
  respond(method: string | undefined, url: string | undefined): StaticResponse;
}

const TYPES: Readonly<Record<string, string>> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".txt": "text/plain; charset=utf-8",
};

const SECURITY: Readonly<Record<string, string>> = {
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "no-referrer",
  "X-Frame-Options": "DENY",
  "Content-Security-Policy":
    "default-src 'self'; connect-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; font-src 'self' data:; frame-ancestors 'none'; base-uri 'self'; form-action 'none'",
};

/** Folders inside the build output that are not part of the site. */
const SKIP = new Set(["test-results"]);

function walk(root: string, rel: string, out: Map<string, Buffer>): void {
  for (const name of readdirSync(join(root, rel))) {
    const relPath = rel === "" ? name : `${rel}/${name}`;
    if (SKIP.has(relPath)) continue;
    const full = join(root, relPath);
    if (statSync(full).isDirectory()) walk(root, relPath, out);
    else out.set(`/${relPath}`, readFileSync(full));
  }
}

/**
 * Loads the built web app into memory once. Requests are answered from an exact-key lookup,
 * so a request path can never reach the file system (no traversal by construction).
 * Unknown paths with a file extension are 404; everything else gets index.html (SPA fallback).
 */
export function loadStaticSite(dir: string): StaticSite {
  const files = new Map<string, Buffer>();
  walk(dir, "", files);
  const index = files.get("/index.html");
  if (index === undefined) throw new Error("STATIC_DIR has no index.html");

  const notFound: StaticResponse = {
    status: 404,
    headers: { ...SECURITY, "Content-Type": "text/plain", "Content-Length": "0" },
    body: Buffer.alloc(0),
  };

  return {
    fileCount: files.size,
    respond(method, url) {
      if (method !== "GET" && method !== "HEAD") {
        return {
          status: 405,
          headers: { ...SECURITY, Allow: "GET, HEAD", "Content-Length": "0" },
          body: Buffer.alloc(0),
        };
      }
      let path = (url ?? "/").split("?")[0] ?? "/";
      try {
        path = decodeURIComponent(path);
      } catch {
        return notFound;
      }
      let key = path;
      let body = files.get(key);
      if (body === undefined) {
        if (extname(path) !== "") return notFound;
        key = "/index.html";
        body = index;
      }
      const type = TYPES[extname(key)] ?? "application/octet-stream";
      const cache = key.startsWith("/assets/") ? "public, max-age=31536000, immutable" : "no-cache";
      return {
        status: 200,
        headers: {
          ...SECURITY,
          "Content-Type": type,
          "Content-Length": String(body.length),
          "Cache-Control": cache,
        },
        body: method === "HEAD" ? Buffer.alloc(0) : body,
      };
    },
  };
}
