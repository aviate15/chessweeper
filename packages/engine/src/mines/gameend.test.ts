// 3.6 game end and the 3.8 turn flow: king death, checkmate, stalemate, precedence.
import { describe, expect, it } from "vitest";
import { isInCheck } from "../chess/attacks";
import { GameOverError, resolveMove } from "./resolve";
import { gameFromScenario } from "./scenario";
import { eventTypes, play } from "./test-utils";
import { legalMoves } from "../chess/movegen";

describe("king death", () => {
  const KINGS = "4k3/8/8/8/8/8/8/4K3 w - - 0 1";

  // 3.6: a king that loses its last life loses.
  it("ends the game when a king loses its last life", () => {
    const game = gameFromScenario({ fen: KINGS, mines: ["e2"], lives: { w: 1, b: 3 } });
    const { state, events } = play(game, "e1e2");
    expect(state.public.lives.w).toBe(0);
    expect(state.public.status).toEqual({ kind: "over", result: "b", reason: "king-lives" });
    expect(events.at(-1)).toEqual({ type: "GameOver", result: "b", reason: "king-lives" });
    expect(eventTypes(events)).not.toContain("TurnPassed");
  });

  it("plays on while the king still has lives", () => {
    const game = gameFromScenario({ fen: KINGS, mines: ["e2"], lives: { w: 2, b: 3 } });
    expect(play(game, "e1e2").state.public.status.kind).toBe("ongoing");
  });

  // 3.6: no insufficient-material draw, so bare kings keep playing.
  it("does not draw bare kings", () => {
    expect(play(gameFromScenario({ fen: KINGS }), "e1e2").state.public.status.kind).toBe("ongoing");
  });

  // 3.6 precedence: landings resolve first. The king steps off the rank onto a mine,
  // discovering a rook mate; if that was its last life the mover loses instead.
  describe("precedence", () => {
    const FEN = "R1K3k1/5ppp/8/8/8/8/8/8 w - - 0 1";

    it("mates the opponent when the king survives the mine", () => {
      const { state } = play(gameFromScenario({ fen: FEN, mines: ["c7"] }), "c8c7");
      expect(state.public.lives.w).toBe(2);
      expect(state.public.status).toEqual({ kind: "over", result: "w", reason: "checkmate" });
    });

    it("loses for the mover when the same move costs the king its last life", () => {
      const game = gameFromScenario({ fen: FEN, mines: ["c7"], lives: { w: 1, b: 3 } });
      const { state } = play(game, "c8c7");
      expect(state.public.status).toEqual({ kind: "over", result: "b", reason: "king-lives" });
    });
  });
});

describe("checkmate and stalemate", () => {
  // 3.6: standard chess rules, ignoring mines.
  it("detects checkmate after a normal move", () => {
    const { state, events } = play(
      gameFromScenario({ fen: "6k1/5ppp/8/8/8/8/8/R5K1 w - - 0 1" }),
      "a1a8",
    );
    expect(state.public.status).toEqual({ kind: "over", result: "w", reason: "checkmate" });
    expect(eventTypes(events).slice(-2)).toEqual(["TurnPassed", "GameOver"]);
  });

  // 3.6: stalemate is a draw.
  it("detects stalemate as a draw", () => {
    const { state } = play(gameFromScenario({ fen: "7k/8/6K1/8/8/8/8/5Q2 w - - 0 1" }), "f1f7");
    expect(state.public.status).toEqual({ kind: "over", result: "draw", reason: "stalemate" });
  });

  // 3.4, 3.8 step 7: a piece uncovers an attack on the enemy king and then explodes. The
  // explosion does not undo the discovered check: the enemy is in check, and checkmated
  // if it has no escape.
  describe("discovered attack by a piece that then explodes", () => {
    it("leaves the enemy king in check", () => {
      // The bishop on e4 shields the black king from the rook on e1, then dies on d5.
      const fen = "4k3/8/8/8/4B3/8/8/4R1K1 w - - 0 1";
      const { state } = play(gameFromScenario({ fen, mines: ["d5"] }), "e4d5");
      expect(state.position.board[3 * 8 + 4]).toBeNull(); // bishop left e4
      expect(state.position.turn).toBe("b");
      expect(isInCheck(state.position, "b")).toBe(true);
      expect(state.public.status.kind).toBe("ongoing");
      expect(state.public.checkException).toBeNull();
    });

    it("is checkmate when the enemy king has no escape", () => {
      // The bishop on c8 shields the rook on a8 from the boxed-in king on g8, then dies on d7.
      const fen = "R1B3k1/5ppp/8/8/8/8/8/4K3 w - - 0 1";
      const { state } = play(gameFromScenario({ fen, mines: ["d7"] }), "c8d7");
      expect(state.public.status).toEqual({ kind: "over", result: "w", reason: "checkmate" });
      expect(state.position.turn).toBe("b");
    });
  });
});

describe("after the game is over", () => {
  // 3.6: moves are rejected.
  it("rejects further moves", () => {
    const fen = "4k3/8/8/8/8/8/8/R3K3 w - - 0 1";
    const over = gameFromScenario({
      fen,
      status: { kind: "over", result: "draw", reason: "stalemate" },
    });
    const move = legalMoves(over.position)[0];
    if (move === undefined) throw new Error("setup");
    expect(() => resolveMove(over, move)).toThrow(GameOverError);
  });
});
