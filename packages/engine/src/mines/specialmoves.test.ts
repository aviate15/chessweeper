// 3.5: castling, en passant and promotion follow standard chess rules; landing on a mine
// makes the piece pay the price like any other landing.
import { describe, expect, it } from "vitest";
import { gameFromScenario } from "./scenario";
import { eventTypes, play, sq } from "./test-utils";

const CASTLE = "r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1";

describe("castling on mines", () => {
  it("is plain castling when both landing squares are safe, revealing both", () => {
    const { state } = play(gameFromScenario({ fen: CASTLE }), "e1g1");
    expect(state.position.board[sq("g1")]?.type).toBe("k");
    expect(state.position.board[sq("f1")]?.type).toBe("r");
    expect(state.public.revealed.has(sq("g1"))).toBe(true);
    expect(state.public.revealed.has(sq("f1"))).toBe(true);
  });

  // 3.5, 3.6: a king landing on a mine loses a life, the mine is consumed, and it stays.
  it("costs the king a life on a mined g1 and still completes the castle", () => {
    const { state, events } = play(gameFromScenario({ fen: CASTLE, mines: ["g1"] }), "e1g1");
    expect(state.position.board[sq("g1")]?.type).toBe("k");
    expect(state.position.board[sq("f1")]?.type).toBe("r");
    expect(state.public.lives).toEqual({ w: 2, b: 3 });
    expect(state.public.craters.has(sq("g1"))).toBe(true);
    expect(eventTypes(events)).toEqual([
      "MoveMade",
      "MineTriggered",
      "LifeLost",
      "NumberRevealed",
      "NumberRevealed",
      "TurnPassed",
    ]);
  });

  // 3.5: a rook landing on a mine is destroyed; the king is unharmed.
  it("destroys the rook on a mined f1 and leaves the king on g1", () => {
    const { state } = play(gameFromScenario({ fen: CASTLE, mines: ["f1"] }), "e1g1");
    expect(state.position.board[sq("g1")]?.type).toBe("k");
    expect(state.position.board[sq("f1")]).toBeNull();
    expect(state.position.board[sq("h1")]).toBeNull();
    expect(state.public.craters.has(sq("f1"))).toBe(true);
    expect(state.public.lives.w).toBe(3);
  });

  it("destroys a queenside rook on a mined d1", () => {
    const { state } = play(gameFromScenario({ fen: CASTLE, mines: ["d1"] }), "e1c1");
    expect(state.position.board[sq("c1")]?.type).toBe("k");
    expect(state.position.board[sq("d1")]).toBeNull();
    expect(state.position.board[sq("a1")]).toBeNull();
  });

  it("applies both prices when both squares are mined", () => {
    const { state } = play(gameFromScenario({ fen: CASTLE, mines: ["g1", "f1"] }), "e1g1");
    expect(state.public.lives.w).toBe(2);
    expect(state.position.board[sq("g1")]?.type).toBe("k");
    expect(state.position.board[sq("f1")]).toBeNull();
  });

  // 3.6: the king's landing resolves first; if it ends the game nothing else resolves.
  it("does not resolve the rook landing once the king has lost its last life", () => {
    const game = gameFromScenario({ fen: CASTLE, mines: ["g1", "f1"], lives: { w: 1, b: 3 } });
    const { state } = play(game, "e1g1");
    expect(state.public.lives.w).toBe(0);
    expect(state.hidden.mines.has(sq("f1"))).toBe(true);
    expect(state.position.board[sq("f1")]?.type).toBe("r");
  });

  // 3.4: castling rights are lost even when the castle ends in an explosion.
  it("drops castling rights after an explosion", () => {
    const { state } = play(gameFromScenario({ fen: CASTLE, mines: ["f1"] }), "e1g1");
    expect(state.position.castling).toMatchObject({ wK: false, wQ: false, bK: true, bQ: true });
  });
});

describe("en passant on mines", () => {
  const FEN = "4k3/8/8/3pP3/8/8/8/4K3 w - d6 0 2";

  it("reveals the landing square when it is safe", () => {
    const { state } = play(gameFromScenario({ fen: FEN }), "e5d6");
    expect(state.position.board[sq("d6")]?.type).toBe("p");
    expect(state.position.board[sq("d5")]).toBeNull();
    expect(state.public.revealed.has(sq("d6"))).toBe(true);
  });

  // 3.5: the capturer is destroyed on a mined landing square; the captured pawn is still removed.
  it("destroys the capturing pawn but still removes the captured pawn", () => {
    const { state } = play(gameFromScenario({ fen: FEN, mines: ["d6"] }), "e5d6");
    expect(state.position.board[sq("e5")]).toBeNull();
    expect(state.position.board[sq("d6")]).toBeNull();
    expect(state.position.board[sq("d5")]).toBeNull();
    expect(state.public.craters.has(sq("d6"))).toBe(true);
    expect(state.position.enPassant).toBeNull();
    expect(state.position.turn).toBe("b");
  });
});

describe("promotion on mines", () => {
  const FEN = "4k3/P7/8/8/8/8/8/4K3 w - - 0 1";

  it("promotes and reveals the square when it is safe", () => {
    const { state } = play(gameFromScenario({ fen: FEN }), "a7a8q");
    expect(state.position.board[sq("a8")]).toEqual({ color: "w", type: "q" });
    expect(state.public.revealed.has(sq("a8"))).toBe(true);
  });

  // 3.5: a mined promotion square destroys the pawn with no promotion.
  it("destroys the pawn on a mined promotion square without promoting", () => {
    const { state, events } = play(gameFromScenario({ fen: FEN, mines: ["a8"] }), "a7a8q");
    expect(state.position.board[sq("a8")]).toBeNull();
    expect(state.position.board[sq("a7")]).toBeNull();
    expect(state.public.craters.has(sq("a8"))).toBe(true);
    expect(events).toContainEqual({
      type: "PieceDestroyed",
      square: sq("a8"),
      piece: { color: "w", type: "p" },
    });
  });
});
