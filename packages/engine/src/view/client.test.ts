// 3.8 step 1: legality ignores hidden mines, so a PublicView is enough to list legal moves.
import { describe, expect, it } from "vitest";
import { START_FEN } from "../chess/fen";
import { moveToUci } from "../chess/move";
import { legalMoves } from "../chess/movegen";
import { gameFromScenario } from "../mines/scenario";
import { play, sq } from "../mines/test-utils";
import {
  destinationsFrom,
  isCrater,
  legalMovesFromView,
  numberAt,
  positionFromView,
} from "./client";
import { toPublicView } from "./public";

describe("client helpers", () => {
  it("rebuilds the engine position from a view", () => {
    const game = gameFromScenario({ fen: START_FEN, mines: ["e4"] });
    expect(positionFromView(toPublicView(game, null))).toEqual(game.position);
  });

  it("lists the same legal moves as the engine, mines or not", () => {
    const withMines = gameFromScenario({ fen: START_FEN, mines: ["e4", "e3", "a3"] });
    const without = gameFromScenario({ fen: START_FEN });
    const expected = legalMoves(withMines.position).map(moveToUci).sort();
    expect(legalMovesFromView(toPublicView(withMines, "w")).map(moveToUci).sort()).toEqual(
      expected,
    );
    expect(legalMovesFromView(toPublicView(without, "w")).map(moveToUci).sort()).toEqual(expected);
  });

  // 3.4: during a chain the follow-up must resolve the check.
  it("lists only check-resolving moves during a check-exception chain", () => {
    const game = gameFromScenario({ fen: "b3k3/8/8/8/8/8/8/4R2K b - - 0 1", mines: ["e4"] });
    const view = toPublicView(play(game, "a8e4").state, "b");
    expect(legalMovesFromView(view).map(moveToUci).sort()).toEqual([
      "e8d7",
      "e8d8",
      "e8f7",
      "e8f8",
    ]);
  });

  // 3.6: moves are rejected once the game is over.
  it("lists no moves once the game is over", () => {
    const game = gameFromScenario({ fen: "6k1/5ppp/8/8/8/8/8/R5K1 w - - 0 1" });
    expect(legalMovesFromView(toPublicView(play(game, "a1a8").state, null))).toEqual([]);
  });

  it("gives destinations for a piece", () => {
    const view = toPublicView(gameFromScenario({ fen: START_FEN }), "w");
    expect(destinationsFrom(view, sq("g1")).sort((a, b) => a - b)).toEqual(
      [sq("f3"), sq("h3")].sort((a, b) => a - b),
    );
  });

  it("reads numbers and craters", () => {
    const game = gameFromScenario({
      fen: "4k3/8/8/8/8/8/8/1N2K3 w - - 0 1",
      mines: ["c3", "a5"],
      revealed: ["b4"],
    });
    const view = toPublicView(play(game, "b1c3").state, null);
    expect(numberAt(view, sq("b4"))).toBe(1); // a5 is still live, c3 consumed
    expect(numberAt(view, sq("h8"))).toBeNull();
    expect(isCrater(view, sq("c3"))).toBe(true);
    expect(isCrater(view, sq("a5"))).toBe(false);
  });
});
