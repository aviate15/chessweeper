import { describe, expect, it } from "vitest";
import { START_FEN } from "../chess/fen";
import { toGameOverView } from "../view/gameover";
import { toPublicView } from "../view/public";
import { tryEndGame } from "../view/errors";
import { endGame } from "./endgame";
import { GameOverError, resolveMove } from "./resolve";
import { createSeededRng } from "./rng";
import { gameFromScenario } from "./scenario";

const fresh = () => gameFromScenario({ fen: START_FEN, noCaptureCount: 4 });

describe("endGame", () => {
  // 3.6 resign: the resigning side loses.
  it("resignation loses for the resigning side", () => {
    for (const by of ["w", "b"] as const) {
      const { state, events } = endGame(fresh(), { reason: "resignation", by });
      const winner = by === "w" ? "b" : "w";
      expect(state.public.status).toEqual({
        kind: "over",
        result: winner,
        reason: "resignation",
      });
      expect(events).toEqual([{ type: "GameOver", result: winner, reason: "resignation" }]);
    }
  });

  // 3.6 draw by agreement
  it("agreement is a draw", () => {
    const { state } = endGame(fresh(), { reason: "agreement", by: "b" });
    expect(state.public.status).toEqual({ kind: "over", result: "draw", reason: "agreement" });
  });

  // 3.6 abandonment: the absent side loses.
  it("abandonment loses for the absent side", () => {
    const { state } = endGame(fresh(), { reason: "abandonment", by: "b" });
    expect(state.public.status).toEqual({ kind: "over", result: "w", reason: "abandonment" });
  });

  // 3.6 public log entry for the side that ended it
  it("appends a public log entry and shows in the public view", () => {
    const { state } = endGame(fresh(), { reason: "resignation", by: "w" });
    expect(state.public.log).toEqual([
      { color: "w", events: [{ type: "GameOver", result: "b", reason: "resignation" }] },
    ]);
    const view = toPublicView(state, null);
    expect(view.status).toEqual({ kind: "over", result: "b", reason: "resignation" });
    expect(view.log).toHaveLength(1);
    expect(view.fallen).toEqual({ w: [], b: [] });
  });

  // 3.6 no counter change, no reshuffle
  it("leaves the counter and mines untouched", () => {
    const before = fresh();
    const { state } = endGame(before, { reason: "resignation", by: "w" });
    expect(state.public.noCaptureCount).toBe(4);
    expect(state.hidden.mines).toBe(before.hidden.mines);
    expect(state.position).toBe(before.position);
  });

  // 3.6 a pending check-exception chain is cleared
  it("clears a pending check exception", () => {
    const pending = gameFromScenario({ fen: START_FEN, checkException: "w" });
    const { state } = endGame(pending, { reason: "resignation", by: "w" });
    expect(state.public.checkException).toBeNull();
    expect(state.hidden.chainCaptured).toBe(false);
  });

  // 3.6 moves and endings are rejected once the game is over
  it("is rejected after the game is over", () => {
    const { state } = endGame(fresh(), { reason: "agreement", by: "w" });
    expect(() => endGame(state, { reason: "resignation", by: "b" })).toThrow(GameOverError);
    const result = tryEndGame(state, { reason: "resignation", by: "b" });
    expect(result).toEqual({
      ok: false,
      error: { code: "game-over", message: "The game is over" },
    });
  });

  it("tryEndGame succeeds on a running game", () => {
    const result = tryEndGame(fresh(), { reason: "resignation", by: "w" });
    expect(result.ok).toBe(true);
  });

  // 3.6 log entry colour is the side that agreed or was absent
  it("logs agreement and abandonment under the named side", () => {
    expect(endGame(fresh(), { reason: "agreement", by: "b" }).state.public.log[0]?.color).toBe("b");
    expect(endGame(fresh(), { reason: "abandonment", by: "w" }).state.public.log[0]?.color).toBe(
      "w",
    );
  });

  // 3.6 final mine layout is revealed once the game ends, however it ended
  it("reveals the final mine layout after a non-move ending", () => {
    const state = gameFromScenario({ fen: START_FEN, mines: ["e4", "d5"] });
    expect(toGameOverView(state, null)).toBeNull();
    const ended = endGame(state, { reason: "resignation", by: "w" }).state;
    expect(toGameOverView(ended, null)?.mines).toHaveLength(2);
  });

  // 3.6 moves are rejected after a non-move ending
  it("rejects moves after a non-move ending", () => {
    const { state } = endGame(fresh(), { reason: "resignation", by: "b" });
    const move = {
      from: 12,
      to: 28,
      piece: "p",
      captured: null,
      captureSquare: null,
      promotion: null,
      castle: null,
      enPassant: false,
      doublePush: true,
    } as const;
    expect(() => resolveMove(state, move, createSeededRng(1))).toThrow(GameOverError);
  });

  // 3.4, 3.6 resigning mid-chain as the other side also clears the chain
  it("clears a pending chain when the other side ends the game", () => {
    const pending = gameFromScenario({ fen: START_FEN, checkException: "w" });
    const { state } = endGame(pending, { reason: "abandonment", by: "b" });
    expect(state.public.checkException).toBeNull();
  });
});
