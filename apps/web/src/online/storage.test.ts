import { afterEach, describe, expect, it, vi } from "vitest";
import {
  clearGame,
  loadCurrent,
  loadFlags,
  loadSeat,
  saveCurrent,
  saveFlags,
  saveSeat,
} from "./storage";

afterEach(() => {
  localStorage.clear();
  vi.restoreAllMocks();
});

describe("online storage", () => {
  it("round-trips the current game, seat and flags", () => {
    saveCurrent("ABCDEF");
    saveSeat("ABCDEF", "b", "tok_en-1");
    saveFlags("ABCDEF", "b", new Set([3, 40]), 7);
    expect(loadCurrent()).toBe("ABCDEF");
    expect(loadSeat("ABCDEF")).toEqual({ seat: "b", token: "tok_en-1" });
    expect(loadFlags("ABCDEF", "b")).toEqual({ squares: [3, 40], logLength: 7 });
  });

  it("keys flags per game and seat", () => {
    saveFlags("ABCDEF", "w", new Set([1]), 2);
    saveFlags("ABCDEF", "b", new Set([2]), 3);
    saveFlags("XYZ234", "w", new Set([9]), 4);
    expect(loadFlags("ABCDEF", "w")?.squares).toEqual([1]);
    expect(loadFlags("ABCDEF", "b")?.squares).toEqual([2]);
    expect(loadFlags("XYZ234", "w")?.squares).toEqual([9]);
    expect(loadFlags("XYZ234", "b")).toBeNull();
  });

  it("rejects malformed stored values", () => {
    localStorage.setItem("chessweeper.online.current", JSON.stringify({ code: "bad" }));
    localStorage.setItem(
      "chessweeper.online.seat.ABCDEF",
      JSON.stringify({ seat: "x", token: "t" }),
    );
    localStorage.setItem(
      "chessweeper.online.seat.XYZ234",
      JSON.stringify({ seat: "w", token: "has space" }),
    );
    localStorage.setItem("chessweeper.online.flags.ABCDEF.w", "{not json");
    expect(loadCurrent()).toBeNull();
    expect(loadSeat("ABCDEF")).toBeNull();
    expect(loadSeat("XYZ234")).toBeNull();
    expect(loadFlags("ABCDEF", "w")).toBeNull();
  });

  it("drops out-of-range squares from stored flags", () => {
    localStorage.setItem(
      "chessweeper.online.flags.ABCDEF.w",
      JSON.stringify({ squares: [5, 64, -1, 1.5, "7"], logLength: 1 }),
    );
    expect(loadFlags("ABCDEF", "w")?.squares).toEqual([5]);
  });

  it("clearGame forgets the seat, both seats' flags and the resume pointer", () => {
    saveCurrent("ABCDEF");
    saveSeat("ABCDEF", "w", "t");
    saveFlags("ABCDEF", "w", new Set([1]), 1);
    saveFlags("ABCDEF", "b", new Set([1]), 1);
    saveSeat("XYZ234", "w", "t2");
    clearGame("ABCDEF");
    expect(loadCurrent()).toBeNull();
    expect(loadSeat("ABCDEF")).toBeNull();
    expect(loadFlags("ABCDEF", "w")).toBeNull();
    expect(loadFlags("ABCDEF", "b")).toBeNull();
    expect(loadSeat("XYZ234")).not.toBeNull();
  });

  it("keeps the resume pointer of another game when clearing one", () => {
    saveCurrent("XYZ234");
    clearGame("ABCDEF");
    expect(loadCurrent()).toBe("XYZ234");
  });

  it("never throws when storage is unavailable", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    expect(() => {
      saveCurrent("ABCDEF");
      saveSeat("ABCDEF", "w", "t");
      saveFlags("ABCDEF", "w", new Set(), 0);
      clearGame("ABCDEF");
    }).not.toThrow();
    expect(loadCurrent()).toBeNull();
    expect(loadSeat("ABCDEF")).toBeNull();
    expect(loadFlags("ABCDEF", "w")).toBeNull();
  });
});
