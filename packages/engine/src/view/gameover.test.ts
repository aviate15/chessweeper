// 3.6 game end: the final mine layout is produced only once the game has ended.
import { describe, expect, it } from "vitest";
import { START_FEN } from "../chess/fen";
import { gameFromScenario } from "../mines/scenario";
import { createGame } from "../mines/setup";
import { createSeededRng } from "../mines/rng";
import { play, sq } from "../mines/test-utils";
import { toGameOverView } from "./gameover";
import { toPublicView } from "./public";

describe("toGameOverView", () => {
  it("is null for a fresh game", () => {
    expect(toGameOverView(createGame({ rng: createSeededRng(1) }), "w")).toBeNull();
  });

  it("is null while the game goes on, even after an explosion", () => {
    const game = gameFromScenario({ fen: "4k3/8/8/8/8/8/8/1N2K3 w - - 0 1", mines: ["c3"] });
    expect(toGameOverView(play(game, "b1c3").state, null)).toBeNull();
  });

  // 3.4: a pending check-exception chain is not the end of the game.
  it("is null while a check-exception chain is pending", () => {
    const game = gameFromScenario({ fen: "b3k3/8/8/8/8/8/8/4R2K b - - 0 1", mines: ["e4"] });
    const { state } = play(game, "a8e4");
    expect(state.public.checkException).toBe("b");
    expect(toGameOverView(state, "b")).toBeNull();
  });

  // 3.6: king death ends the game and reveals every live mine.
  it("is available after a king loses its last life", () => {
    const game = gameFromScenario({
      fen: "4k3/8/8/8/8/8/8/4K3 w - - 0 1",
      mines: ["e2", "a5", "h7"],
      lives: { w: 1, b: 3 },
    });
    const { state } = play(game, "e1e2");
    const over = toGameOverView(state, "w");
    expect(over).not.toBeNull();
    expect(over?.view.status).toEqual({ kind: "over", result: "b", reason: "king-lives" });
    expect(over?.mines).toEqual([sq("a5"), sq("h7")].sort((a, b) => a - b)); // e2 was consumed
    expect(over?.view).toEqual(toPublicView(state, "w"));
  });

  // 3.6: checkmate.
  it("is available after checkmate", () => {
    const game = gameFromScenario({ fen: "6k1/5ppp/8/8/8/8/8/R5K1 w - - 0 1", mines: ["c4"] });
    const over = toGameOverView(play(game, "a1a8").state, null);
    expect(over?.view.status).toEqual({ kind: "over", result: "w", reason: "checkmate" });
    expect(over?.mines).toEqual([sq("c4")]);
  });

  // 3.6: stalemate is a draw.
  it("is available after stalemate", () => {
    const game = gameFromScenario({ fen: "7k/8/5K2/6Q1/8/8/8/8 w - - 0 1" });
    const over = toGameOverView(play(game, "g5g6").state, null);
    expect(over?.view.status).toEqual({ kind: "over", result: "draw", reason: "stalemate" });
    expect(over?.mines).toEqual([]);
  });

  it("never appears for the start position", () => {
    expect(toGameOverView(gameFromScenario({ fen: START_FEN, mines: ["e4"] }), null)).toBeNull();
  });
});
