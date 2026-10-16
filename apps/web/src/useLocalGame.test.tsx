import { act, renderHook } from "@testing-library/react";
import { createSeededRng, legalMovesFromView } from "@chessweeper/engine";
import { describe, expect, it } from "vitest";
import { useLocalGame } from "./useLocalGame";

describe("useLocalGame", () => {
  it("clears both colours' private flags when mines are reshuffled (3.3, 3.7)", () => {
    const { result } = renderHook(() => useLocalGame({ rng: createSeededRng(7) }));
    let sawReshuffle = false;
    for (let turn = 0; turn < 80 && !sawReshuffle; turn++) {
      if (result.current.view.status.kind === "over") break;
      if (!result.current.flags.has(20)) {
        act(() => {
          result.current.toggleFlag(20);
        });
      }
      expect(result.current.flags.has(20)).toBe(true);
      // Prefer quiet moves so the no-capture counter reaches the reshuffle interval.
      const moves = legalMovesFromView(result.current.view);
      const move = moves.find((m) => m.captured === null) ?? moves[0];
      if (!move) break;
      act(() => {
        result.current.play(move);
      });
      const last = result.current.view.log[result.current.view.log.length - 1];
      if (last?.events.some((e) => e.type === "Reshuffled")) {
        sawReshuffle = true;
        expect(result.current.flags.size).toBe(0);
        act(() => {
          result.current.dismissHandoff();
        });
        expect(result.current.flags.size).toBe(0);
      }
    }
    expect(sawReshuffle).toBe(true);
  });

  it("keeps flags separate per colour and hands off after a normal turn", () => {
    const { result } = renderHook(() => useLocalGame({ rng: createSeededRng(3) }));
    act(() => {
      result.current.toggleFlag(20);
    });
    expect(result.current.flags.has(20)).toBe(true);
    const move = legalMovesFromView(result.current.view).find((m) => m.piece === "p");
    if (!move) throw new Error("no pawn move");
    act(() => {
      result.current.play(move);
    });
    // Whatever happened, it is now Black's turn (a pawn move off ranks 1-2 may be a mine hit) and
    // White's flag is not visible to Black.
    expect(result.current.view.turn).toBe("b");
    expect(result.current.handoffTo).toBe("b");
    expect(result.current.flags.has(20)).toBe(false);
  });

  it("applies draw-offer rules and ends the game by agreement", () => {
    const { result } = renderHook(() => useLocalGame({ rng: createSeededRng(5) }));
    act(() => {
      result.current.offerDraw();
    });
    expect(result.current.offers.pending).toBe("w");
    act(() => {
      result.current.declineDraw();
    });
    expect(result.current.offers.pending).toBeNull();
    // White cannot re-offer until they have moved.
    act(() => {
      result.current.offerDraw();
    });
    expect(result.current.offers.pending).toBeNull();
    const first = legalMovesFromView(result.current.view)[0];
    if (!first) throw new Error("no move");
    act(() => {
      result.current.play(first);
    });
    act(() => {
      result.current.dismissHandoff();
    });
    act(() => {
      result.current.offerDraw();
    });
    expect(result.current.offers.pending).toBe("b");
    act(() => {
      result.current.acceptDraw();
    });
    const status = result.current.view.status;
    expect(status).toEqual({ kind: "over", result: "draw", reason: "agreement" });
    expect(result.current.gameOver?.mines.length).toBeGreaterThan(0);
  });

  it("a move lapses a pending offer", () => {
    const { result } = renderHook(() => useLocalGame({ rng: createSeededRng(5) }));
    act(() => {
      result.current.offerDraw();
    });
    const first = legalMovesFromView(result.current.view)[0];
    if (!first) throw new Error("no move");
    act(() => {
      result.current.play(first);
    });
    expect(result.current.offers.pending).toBeNull();
  });

  it("resigns through the engine", () => {
    const { result } = renderHook(() => useLocalGame({ rng: createSeededRng(5) }));
    act(() => {
      result.current.resign();
    });
    expect(result.current.view.status).toEqual({
      kind: "over",
      result: "b",
      reason: "resignation",
    });
  });

  it("exposes the latest projected events and a turn id that moves with every change", () => {
    const { result } = renderHook(() => useLocalGame({ rng: createSeededRng(5) }));
    expect(result.current.lastEvents).toEqual([]);
    const start = result.current.turnId;
    const move = legalMovesFromView(result.current.view)[0];
    if (!move) throw new Error("no move");
    act(() => {
      result.current.play(move);
    });
    expect(result.current.turnId).toBe(start + 1);
    expect(result.current.lastEvents.some((e) => e.type === "MoveMade")).toBe(true);
    act(() => {
      result.current.dismissHandoff();
      result.current.resign();
    });
    expect(result.current.turnId).toBe(start + 2);
    expect(result.current.lastEvents.some((e) => e.type === "GameOver")).toBe(true);
    act(() => {
      result.current.newGame();
    });
    expect(result.current.turnId).toBe(start + 3);
    expect(result.current.lastEvents).toEqual([]);
  });
});
