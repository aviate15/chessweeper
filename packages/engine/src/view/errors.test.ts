// 3.5 (no mine under a piece), 3.6 (moves rejected once the game is over): the error boundary.
import { describe, expect, it } from "vitest";
import { START_FEN } from "../chess/fen";
import { legalMoves } from "../chess/movegen";
import { moveToUci } from "../chess/move";
import { GameOverError, IllegalMoveError } from "../mines/resolve";
import { createSeededRng } from "../mines/rng";
import { gameFromScenario } from "../mines/scenario";
import { play } from "../mines/test-utils";
import { toSafeError, tryResolveMove } from "./errors";

const rng = createSeededRng(1);

describe("toSafeError", () => {
  it("maps illegal moves and game over to fixed codes", () => {
    expect(toSafeError(new IllegalMoveError())).toEqual({
      code: "illegal-move",
      message: "Illegal move",
    });
    expect(toSafeError(new GameOverError())).toEqual({
      code: "game-over",
      message: "The game is over",
    });
  });

  // 3.5: the internal invariant error mentions mines and must never be forwarded.
  it("hides the text of unknown errors", () => {
    const leaky = new Error("Invariant violated: a mine under a piece at e4");
    const safe = toSafeError(leaky);
    expect(safe).toEqual({ code: "internal", message: "Internal error" });
    expect(JSON.stringify(safe)).not.toMatch(/mine|e4|invariant/i);
  });

  it("handles non-Error throws", () => {
    expect(toSafeError("boom").code).toBe("internal");
    expect(toSafeError(null).code).toBe("internal");
    expect(toSafeError({ mines: [1, 2] }).message).toBe("Internal error");
  });
});

describe("tryResolveMove", () => {
  it("returns the resolution for a legal move", () => {
    const game = gameFromScenario({ fen: START_FEN });
    const move = legalMoves(game.position).find((m) => moveToUci(m) === "e2e4");
    if (move === undefined) throw new Error("e2e4 missing");
    const result = tryResolveMove(game, move, rng);
    expect(result.ok).toBe(true);
  });

  it("turns an illegal move into a safe error instead of throwing", () => {
    const game = gameFromScenario({ fen: START_FEN });
    const legal = legalMoves(game.position)[0];
    if (legal === undefined) throw new Error("no moves");
    const result = tryResolveMove(game, { ...legal, to: 63 }, rng);
    expect(result).toEqual({ ok: false, error: { code: "illegal-move", message: "Illegal move" } });
  });

  // 3.6: moves are rejected once the game is over.
  it("rejects moves after the game is over", () => {
    const over = play(gameFromScenario({ fen: "6k1/5ppp/8/8/8/8/8/R5K1 w - - 0 1" }), "a1a8").state;
    const move = {
      from: 0,
      to: 1,
      piece: "k",
      captured: null,
      captureSquare: null,
      promotion: null,
      castle: null,
      enPassant: false,
      doublePush: false,
    } as const;
    expect(tryResolveMove(over, move, rng)).toEqual({
      ok: false,
      error: { code: "game-over", message: "The game is over" },
    });
  });

  // 3.5: a corrupted state that would throw the internal invariant surfaces only generically.
  it("never leaks the invariant error", () => {
    // A mine under the captured piece's square: impossible in a real game (3.5).
    const game = gameFromScenario({ fen: "4k3/8/8/3p4/4P3/8/8/4K3 w - - 0 1" });
    const corrupt = { ...game, hidden: { ...game.hidden, mines: new Set([35]) } };
    const move = legalMoves(corrupt.position).find((m) => moveToUci(m) === "e4d5");
    if (move === undefined) throw new Error("e4d5 missing");
    const result = tryResolveMove(corrupt, move, rng);
    expect(result).toEqual({ ok: false, error: { code: "internal", message: "Internal error" } });
  });
});
