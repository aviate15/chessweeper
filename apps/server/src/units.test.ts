import { describe, expect, it } from "vitest";
import { CODE_ALPHABET } from "@chessweeper/protocol";
import type { IncomingMessage } from "node:http";
import { loadConfig } from "./config";
import { clientIp } from "./ip";
import { createCryptoRng, newInviteCode, newSeatToken, tokensEqual } from "./crypto";
import { DEFAULT_LIMITS, TokenBucket } from "./limits";
import { createLogger } from "./log";

describe("crypto", () => {
  it("makes unambiguous 6-character codes", () => {
    for (let i = 0; i < 200; i++) {
      const code = newInviteCode();
      expect(code).toHaveLength(6);
      for (const ch of code) expect(CODE_ALPHABET).toContain(ch);
    }
    expect(CODE_ALPHABET).not.toMatch(/[ILO01]/);
  });

  it("makes 32-byte base64url tokens that differ and compare in constant time", () => {
    const a = newSeatToken();
    const b = newSeatToken();
    expect(a).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(a).not.toBe(b);
    expect(tokensEqual(a, a)).toBe(true);
    expect(tokensEqual(a, b)).toBe(false);
    expect(tokensEqual(a, "short")).toBe(false);
  });

  it("crypto rng stays in range", () => {
    const rng = createCryptoRng();
    for (let i = 0; i < 100; i++) {
      const n = rng.nextInt(7);
      expect(n).toBeGreaterThanOrEqual(0);
      expect(n).toBeLessThan(7);
    }
    expect(rng.nextInt(1)).toBe(0);
  });
});

describe("loadConfig", () => {
  it("adds the dev origin only in development", () => {
    expect(loadConfig({ ALLOWED_ORIGINS: "https://a.test" }).allowedOrigins).toEqual([
      "https://a.test",
    ]);
    expect(loadConfig({ NODE_ENV: "production" }).allowedOrigins).toEqual([]);
    expect(loadConfig({ NODE_ENV: "development" }).allowedOrigins).toEqual([
      "http://localhost:5173",
    ]);
  });

  it("drops wildcards and trims", () => {
    expect(loadConfig({ ALLOWED_ORIGINS: " https://a.test , * ," }).allowedOrigins).toEqual([
      "https://a.test",
    ]);
  });

  it("reads TRUST_PROXY and PORT, defaulting to untrusted", () => {
    expect(loadConfig({}).trustProxy).toBe("none");
    expect(loadConfig({ TRUST_PROXY: "1" }).trustProxy).toBe("fly");
    expect(loadConfig({ TRUST_PROXY: "true" }).trustProxy).toBe("fly");
    expect(loadConfig({ TRUST_PROXY: "fly" }).trustProxy).toBe("fly");
    expect(loadConfig({ TRUST_PROXY: "cloudflare" }).trustProxy).toBe("cloudflare");
    expect(loadConfig({ TRUST_PROXY: "yes" }).trustProxy).toBe("none");
    expect(loadConfig({}).staticDir).toBeNull();
    expect(loadConfig({ STATIC_DIR: "apps/web/dist" }).staticDir).toBe("apps/web/dist");
    expect(loadConfig({ PORT: "9000" }).port).toBe(9000);
    expect(() => loadConfig({ PORT: "abc" })).toThrow();
  });
});

describe("loadConfig limits", () => {
  it("leaves limits unset by default and parses each env var", () => {
    expect(loadConfig({}).limits).toEqual({});
    expect(
      loadConfig({
        MAX_ROOMS_PER_IP: "50",
        MAX_CONNS_PER_IP: "200",
        MAX_ROOMS: "500",
        FINISHED_ROOM_MS: "30000",
      }).limits,
    ).toEqual({
      maxRoomsPerIp: 50,
      maxConnectionsPerIp: 200,
      maxRooms: 500,
      finishedRoomMs: 30000,
    });
    expect(loadConfig({ MAX_ROOMS_PER_IP: " " }).limits).toEqual({});
  });

  it("rejects values that are not positive integers", () => {
    for (const bad of ["0", "-1", "1.5", "abc"]) {
      expect(() => loadConfig({ MAX_ROOMS_PER_IP: bad })).toThrow("Invalid MAX_ROOMS_PER_IP");
    }
    expect(() => loadConfig({ FINISHED_ROOM_MS: "0" })).toThrow();
  });

  it("defaults are generous for shared IPs", () => {
    expect(DEFAULT_LIMITS.maxRoomsPerIp).toBeGreaterThanOrEqual(30);
    expect(DEFAULT_LIMITS.maxConnectionsPerIp).toBeGreaterThanOrEqual(100);
  });
});

describe("clientIp", () => {
  const req = (peer: string, headers: Record<string, string>) =>
    ({ socket: { remoteAddress: peer }, headers }) as unknown as IncomingMessage;

  it("cloudflare mode believes CF-Connecting-IP only from a loopback peer", () => {
    const h = { "cf-connecting-ip": "203.0.113.5" };
    expect(clientIp(req("127.0.0.1", h), "cloudflare")).toBe("203.0.113.5");
    expect(clientIp(req("::1", h), "cloudflare")).toBe("203.0.113.5");
    expect(clientIp(req("::ffff:127.0.0.1", h), "cloudflare")).toBe("203.0.113.5");
    expect(clientIp(req("192.168.1.9", h), "cloudflare")).toBe("192.168.1.9");
    expect(clientIp(req("127.0.0.1", { "cf-connecting-ip": "x" }), "cloudflare")).toBe("127.0.0.1");
  });

  it("other modes ignore it", () => {
    const h = { "cf-connecting-ip": "203.0.113.5", "fly-client-ip": "198.51.100.1" };
    expect(clientIp(req("127.0.0.1", h), "none")).toBe("127.0.0.1");
    expect(clientIp(req("127.0.0.1", h), false)).toBe("127.0.0.1");
    expect(clientIp(req("127.0.0.1", h), true)).toBe("198.51.100.1");
    expect(clientIp(req("127.0.0.1", h), "fly")).toBe("198.51.100.1");
  });
});

describe("logger", () => {
  it("redacts secret-looking fields", () => {
    const lines: string[] = [];
    createLogger((l) => lines.push(l)).info("x", { token: "abc", code: "ZZZZZZ", ip: "1.2.3.4" });
    expect(lines[0]).not.toContain("abc");
    expect(lines[0]).not.toContain("ZZZZZZ");
    expect(lines[0]).not.toContain("1.2.3.4");
  });
});

describe("TokenBucket", () => {
  it("allows a burst, then refills with time", () => {
    const bucket = new TokenBucket(2, 1, 0);
    expect(bucket.take(0)).toBe(true);
    expect(bucket.take(0)).toBe(true);
    expect(bucket.take(0)).toBe(false);
    expect(bucket.take(500)).toBe(false);
    expect(bucket.take(1000)).toBe(true);
  });
});
