import { describe, expect, it } from "vitest";
import { resolveServerUrl } from "./config";

describe("resolveServerUrl", () => {
  it("uses VITE_SERVER_URL when set", () => {
    expect(resolveServerUrl({ VITE_SERVER_URL: "wss://play.example", DEV: false })).toBe(
      "wss://play.example",
    );
  });
  it("defaults to the local server in dev only", () => {
    expect(resolveServerUrl({ DEV: true })).toBe("ws://localhost:8080");
    expect(resolveServerUrl({ VITE_SERVER_URL: "  ", DEV: true })).toBe("ws://localhost:8080");
    expect(resolveServerUrl({ DEV: false })).toBeNull();
  });
});
