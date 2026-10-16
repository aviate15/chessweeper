import { describe, expect, it } from "vitest";
import { resolveServerUrl } from "./config";

describe("resolveServerUrl", () => {
  it("uses VITE_SERVER_URL when set, even with a location", () => {
    expect(
      resolveServerUrl({
        VITE_SERVER_URL: "wss://play.example",
        DEV: false,
        location: { protocol: "https:", host: "other.test" },
      }),
    ).toBe("wss://play.example");
  });

  it("defaults to the local server in dev", () => {
    expect(resolveServerUrl({ DEV: true })).toBe("ws://localhost:8080");
    expect(resolveServerUrl({ VITE_SERVER_URL: "  ", DEV: true })).toBe("ws://localhost:8080");
  });

  it("in production with nothing set, connects to the page's own host", () => {
    expect(
      resolveServerUrl({
        DEV: false,
        location: { protocol: "https:", host: "x.trycloudflare.com" },
      }),
    ).toBe("wss://x.trycloudflare.com/ws");
    expect(
      resolveServerUrl({ DEV: false, location: { protocol: "http:", host: "localhost:8080" } }),
    ).toBe("ws://localhost:8080/ws");
  });

  it("is unavailable without a usable location", () => {
    expect(resolveServerUrl({ DEV: false })).toBeNull();
    expect(resolveServerUrl({ DEV: false, location: { protocol: "file:", host: "" } })).toBeNull();
  });
});
