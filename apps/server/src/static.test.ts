import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { loadStaticSite, type StaticSite } from "./static";
import { startHarness } from "./testkit";

let dir = "";
let site: StaticSite;

beforeAll(() => {
  dir = mkdtempSync(join(tmpdir(), "cw-static-"));
  mkdirSync(join(dir, "assets"));
  mkdirSync(join(dir, "test-results"));
  writeFileSync(join(dir, "index.html"), '<div id="root"></div>');
  writeFileSync(join(dir, "assets", "app-abc.js"), "console.log(1)");
  writeFileSync(join(dir, "assets", "f.woff2"), "font");
  writeFileSync(join(dir, "test-results", "x.json"), "{}");
  writeFileSync(join(dir, "..secret.txt"), "nope");
  site = loadStaticSite(dir);
});
afterAll(() => {
  rmSync(dir, { recursive: true, force: true });
});

const get = (url: string, method = "GET") => site.respond(method, url);

describe("static site", () => {
  it("serves index at / and for join links, and falls back to it for app routes", () => {
    for (const url of ["/", "/?join=ABCDEF", "/sprites", "/some/deep/route"]) {
      const r = get(url);
      expect(r.status).toBe(200);
      expect(r.headers["Content-Type"]).toContain("text/html");
      expect(r.body.toString()).toContain('id="root"');
      expect(r.headers["Cache-Control"]).toBe("no-cache");
    }
  });

  it("serves assets with MIME types and immutable caching", () => {
    const js = get("/assets/app-abc.js");
    expect(js.headers["Content-Type"]).toContain("text/javascript");
    expect(js.headers["Cache-Control"]).toContain("immutable");
    expect(get("/assets/f.woff2").headers["Content-Type"]).toBe("font/woff2");
  });

  it("sets security headers everywhere", () => {
    for (const r of [get("/"), get("/assets/app-abc.js"), get("/nope.js")]) {
      expect(r.headers["X-Content-Type-Options"]).toBe("nosniff");
      expect(r.headers["Content-Security-Policy"]).toContain("connect-src 'self'");
      expect(r.headers["X-Frame-Options"]).toBe("DENY");
    }
  });

  it("404s a missing file with an extension instead of returning HTML", () => {
    expect(get("/assets/missing.js").status).toBe(404);
  });

  it("skips test-results and never reaches outside the directory", () => {
    expect(get("/test-results/x.json").status).toBe(404);
    for (const url of [
      "/../package.json",
      "/%2e%2e/package.json",
      "/..%2fpackage.json",
      "/assets/../../package.json",
      "/%00",
      "/%E0%A4%A",
    ]) {
      const r = get(url);
      expect(r.body.toString()).not.toContain('"name"');
      expect(r.body.toString()).not.toBe("nope");
    }
  });

  it("only allows GET and HEAD; HEAD has no body", () => {
    expect(get("/", "POST").status).toBe(405);
    const head = get("/", "HEAD");
    expect(head.status).toBe(200);
    expect(head.body.length).toBe(0);
    expect(head.headers["Content-Length"]).not.toBe("0");
  });

  it("refuses a directory with no index.html", () => {
    const empty = mkdtempSync(join(tmpdir(), "cw-empty-"));
    expect(() => loadStaticSite(empty)).toThrow("index.html");
    rmSync(empty, { recursive: true });
  });
});

describe("static site over HTTP", () => {
  it("is served by the game server next to /healthz, and POST is refused", async () => {
    const hh = await startHarness({ staticSite: site });
    try {
      const base = hh.url.replace("ws:", "http:");
      expect(await (await fetch(`${base}/healthz`)).text()).toBe("ok");
      const page = await fetch(`${base}/?join=ABCDEF`);
      expect(page.status).toBe(200);
      expect(await page.text()).toContain('id="root"');
      expect((await fetch(`${base}/`, { method: "POST" })).status).toBe(405);
      expect((await fetch(`${base}/assets/missing.js`)).status).toBe(404);
    } finally {
      await hh.stop();
    }
  });
});
