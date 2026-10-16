import { describe, expect, it } from "vitest";
import { moveToUci } from "../chess/move";
import { legalMoves } from "../chess/movegen";
import { parseSquare } from "../chess/square";
import { gameFromScenario, type Scenario } from "./scenario";
import { IllegalMoveError, NotYetSupportedError, resolveMove } from "./resolve";
import type { GameState } from "./state";

function sq(name: string): number {
  const square = parseSquare(name);
  if (square === null) throw new Error(name);
  return square;
}

/** Plays a UCI move through resolveMove. */
function play(game: GameState, uci: string) {
  const move = legalMoves(game.position).find((m) => moveToUci(m) === uci);
  if (move === undefined) throw new Error(`${uci} is not legal here`);
  return resolveMove(game, move);
}

const types = (events: readonly { type: string }[]) => events.map((e) => e.type);
const scenario = (s: Scenario) => gameFromScenario(s);

// A white rook on a4 with both kings far away.
const ROOK = "4k3/8/8/8/R7/8/8/4K3 w - - 0 1";

describe("landing on a safe square", () => {
  // 3.2: a surviving piece reveals the number of its square.
  it("reveals the number of adjacent mines", () => {
    const { state, events } = play(scenario({ fen: ROOK, mines: ["b6", "b2"] }), "a4a5");
    expect(state.public.revealed.has(sq("a5"))).toBe(true);
    expect(events).toContainEqual({ type: "NumberRevealed", square: sq("a5"), number: 1 });
    expect(state.position.turn).toBe("b");
  });

  // 3.2: no zero flood-fill.
  it("reveals only the landing square even for a 0", () => {
    const { state } = play(scenario({ fen: ROOK }), "a4a5");
    expect([...state.public.revealed]).toEqual([sq("a5")]);
  });

  // 3.2: a revealed number persists after the piece leaves.
  it("keeps a number visible after the piece moves on", () => {
    const first = play(scenario({ fen: ROOK }), "a4a5").state;
    const second = play(first, "e8d8").state;
    const third = play(second, "a5b5").state;
    expect(third.public.revealed.has(sq("a5"))).toBe(true);
    expect(third.public.revealed.has(sq("b5"))).toBe(true);
  });

  // 3.2: only landing triggers mines; sliders passing over a mine do nothing.
  it("lets a slider pass over a mine unharmed", () => {
    const { state } = play(scenario({ fen: ROOK, mines: ["d4"] }), "a4h4");
    expect(state.hidden.mines.has(sq("d4"))).toBe(true);
    expect(state.position.board[sq("h4")]?.type).toBe("r");
    expect(state.public.revealed.has(sq("d4"))).toBe(false);
  });

  // 3.5: a capture never hits a mine; it reveals its square like any landing.
  it("reveals the square of a capture and reports the captured piece", () => {
    const { state, events } = play(
      scenario({ fen: "4k3/8/8/8/R6p/8/8/4K3 w - - 0 1", mines: ["g5"] }),
      "a4h4",
    );
    expect(events).toContainEqual({ type: "PieceCaptured", square: sq("h4"), piece: "p" });
    expect(state.public.revealed.has(sq("h4"))).toBe(true);
    expect(state.public.noCaptureCount).toBe(0); // counter logic arrives with the reshuffle
  });

  // 3.4: a crater is safe to land on afterwards, and (decision) shows its number.
  it("lands safely on a crater and reveals its number", () => {
    const { state } = play(scenario({ fen: ROOK, mines: ["d5"], craters: ["d4"] }), "a4d4");
    expect(state.position.board[sq("d4")]?.type).toBe("r");
    expect(state.public.craters.has(sq("d4"))).toBe(true);
    expect(state.public.revealed.has(sq("d4"))).toBe(true);
  });
});

describe("a non-king piece on a mine", () => {
  // 3.4: destroyed, mine consumed, crater left, move wasted, turn passes.
  it("is destroyed, consumes the mine, leaves a crater and passes the turn", () => {
    const { state, events } = play(scenario({ fen: ROOK, mines: ["d4"] }), "a4d4");
    expect(state.position.board[sq("a4")]).toBeNull();
    expect(state.position.board[sq("d4")]).toBeNull();
    expect(state.hidden.mines.has(sq("d4"))).toBe(false);
    expect(state.public.craters.has(sq("d4"))).toBe(true);
    expect(state.public.revealed.has(sq("d4"))).toBe(false);
    expect(state.position.turn).toBe("b");
    expect(types(events)).toEqual(["MoveMade", "MineTriggered", "PieceDestroyed", "TurnPassed"]);
  });

  // 3.2: revealed numbers are live.
  it("lowers the numbers of revealed neighbours", () => {
    const game = scenario({ fen: ROOK, mines: ["d4", "f6"], revealed: ["e5"] });
    const { state, events } = play(game, "a4d4");
    expect(events).toContainEqual({
      type: "NumbersChanged",
      updates: [{ square: sq("e5"), number: 1 }],
    });
    expect(state.public.revealed.has(sq("e5"))).toBe(true);
  });

  // 3.4: castling rights are lost even when the rook's move ends in an explosion.
  it("still costs castling rights", () => {
    const fen = "r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1";
    const { state } = play(scenario({ fen, mines: ["h5"] }), "h1h5");
    expect(state.position.castling).toMatchObject({ wK: false, wQ: true });
  });

  // 3.4: a double-pushed pawn destroyed on a mine sets no en passant target.
  it("sets no en passant target when a double-pushed pawn explodes", () => {
    const fen = "4k3/8/8/8/8/8/4P3/4K3 w - - 0 1";
    expect(play(scenario({ fen }), "e2e4").state.position.enPassant).toBe(sq("e3"));
    expect(play(scenario({ fen, mines: ["e4"] }), "e2e4").state.position.enPassant).toBeNull();
  });
});

describe("a king on a mine", () => {
  // 3.6: loses 1 life, mine consumed, the king stays.
  it("loses one life, consumes the mine and stays on the square", () => {
    const fen = "4k3/8/8/8/8/8/8/4K3 w - - 0 1";
    const { state, events } = play(scenario({ fen, mines: ["e2"] }), "e1e2");
    expect(state.position.board[sq("e2")]).toEqual({ color: "w", type: "k" });
    expect(state.public.lives).toEqual({ w: 2, b: 3 });
    expect(state.hidden.mines.has(sq("e2"))).toBe(false);
    expect(state.public.craters.has(sq("e2"))).toBe(true);
    expect(state.public.revealed.has(sq("e2"))).toBe(true); // survived, so it reveals
    expect(types(events)).toEqual([
      "MoveMade",
      "MineTriggered",
      "LifeLost",
      "NumberRevealed",
      "TurnPassed",
    ]);
    expect(events).toContainEqual({ type: "LifeLost", color: "w", square: sq("e2"), livesLeft: 2 });
  });

  it("keeps counting down on repeated hits", () => {
    const fen = "4k3/8/8/8/8/8/8/4K3 w - - 0 1";
    const game = scenario({ fen, mines: ["e2"], lives: { w: 2, b: 3 } });
    expect(play(game, "e1e2").state.public.lives.w).toBe(1);
  });

  // 3.4: a king that moves loses castling rights even if the move costs a life.
  it("still loses castling rights", () => {
    const fen = "r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1";
    const { state } = play(scenario({ fen, mines: ["e2"] }), "e1e2");
    expect(state.position.castling).toMatchObject({ wK: false, wQ: false, bK: true });
  });
});

describe("king edge cases", () => {
  const fen = "4k3/8/8/8/8/8/8/4K3 w - - 0 1";

  // 3.6: a mined escape square is still a legal move; the king just pays a life.
  it("may step onto a mined square (legality ignores mines, 3.8 step 1)", () => {
    const game = scenario({ fen, mines: ["d1", "d2", "e2", "f2", "f1"] });
    expect(legalMoves(game.position).map(moveToUci).sort()).toEqual([
      "e1d1",
      "e1d2",
      "e1e2",
      "e1f1",
      "e1f2",
    ]);
  });

  // 3.2, 3.4: a king landing on an existing crater is safe and reveals its number.
  it("lands safely on an existing crater and reveals it", () => {
    const { state } = play(scenario({ fen, craters: ["e2"], mines: ["d3"] }), "e1e2");
    expect(state.public.lives).toEqual({ w: 3, b: 3 });
    expect(state.public.revealed.has(sq("e2"))).toBe(true);
  });
});

describe("guard rails for later milestones", () => {
  const kingsOnly = "4k3/8/8/8/8/8/8/4K3 w - - 0 1";

  it("rejects moves that are not legal chess moves", () => {
    const start = scenario({ fen: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1" });
    const e2e4 = legalMoves(start.position).find((m) => moveToUci(m) === "e2e4");
    if (e2e4 === undefined) throw new Error("setup");
    expect(() => resolveMove(scenario({ fen: kingsOnly }), e2e4)).toThrow(IllegalMoveError);
  });

  it.each([
    ["castling", "r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1", "e1g1"],
    ["en passant", "4k3/8/8/3pP3/8/8/8/4K3 w - d6 0 2", "e5d6"],
    ["promotion", "4k3/P7/8/8/8/8/8/4K3 w - - 0 1", "a7a8q"],
  ])("refuses %s until special moves on mines land in M6", (_name, fen, uci) => {
    expect(() => play(scenario({ fen }), uci)).toThrow(NotYetSupportedError);
  });

  it("refuses an explosion that exposes the mover's king (check exception is M6)", () => {
    // Bishop a1 blocks the rook's check by going to e5, which is mined.
    const fen = "4r2k/8/8/8/8/8/8/B3K3 w - - 0 1";
    expect(() => play(scenario({ fen, mines: ["e5"] }), "a1e5")).toThrow(NotYetSupportedError);
  });

  it("refuses to continue once a king has no lives (game end is M6)", () => {
    const game = scenario({ fen: kingsOnly, lives: { w: 0, b: 3 } });
    expect(() => play(game, "e1e2")).toThrow(NotYetSupportedError);
  });
});
