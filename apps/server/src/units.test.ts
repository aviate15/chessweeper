import { describe, expect, it } from "vitest";
import { CODE_ALPHABET } from "@chessweeper/protocol";
import { loadConfig } from "./config";
import { createCryptoRng, newInviteCode, newSeatToken, tokensEqual } from "./crypto";
import { TokenBucket } from "./limits";
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
    expect(loadConfig({}).trustProxy).toBe(false);
    expect(loadConfig({ TRUST_PROXY: "1" }).trustProxy).toBe(true);
    expect(loadConfig({ TRUST_PROXY: "true" }).trustProxy).toBe(true);
    expect(loadConfig({ TRUST_PROXY: "yes" }).trustProxy).toBe(false);
    expect(loadConfig({ PORT: "9000" }).port).toBe(9000);
    expect(() => loadConfig({ PORT: "abc" })).toThrow();
  });
});

describe("logger", () => {
  it("redacts secret-looking fields", () => {
    const lines: string[] = [];
    createLogger((l) => lines.push(l)).info("x", { token: "abc", code: "ZZZZZZ", ip: "1.2.3.4" });
    expect(lines[0]).not.toContain("abc");
    expect(lines[0]).not.toContain("ZZZZZZ");
    expect(lines[0]).toContain("1.2.3.4");
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
