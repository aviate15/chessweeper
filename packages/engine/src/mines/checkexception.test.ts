// 3.4 check exception: when a piece is destroyed on a mine and that leaves the mover's own
// king in check, the same side moves again in the same turn.
import { describe, expect, it } from "vitest";
import { isInCheck } from "../chess/attacks";
import { moveToUci } from "../chess/move";
import { legalMoves } from "../chess/movegen";
import { gameFromScenario } from "./scenario";
import { eventTypes, play, sq } from "./test-utils";

// Black king e8 is in check from the white rook e1. The black bishop can block on e4.
const BLOCK = "b3k3/8/8/8/8/8/8/4R2K b - - 0 1";

describe("check exception", () => {
  it("lets the same side move again when a blocker explodes", () => {
    const { state, events } = play(gameFromScenario({ fen: BLOCK, mines: ["e4"] }), "a8e4");
    expect(state.position.board[sq("e4")]).toBeNull();
    expect(state.position.turn).toBe("b");
    expect(state.public.checkException).toBe("b");
    expect(isInCheck(state.position, "b")).toBe(true);
    expect(state.public.status.kind).toBe("ongoing");
    expect(eventTypes(events)).toEqual([
      "MoveMade",
      "MineTriggered",
      "PieceDestroyed",
      "CheckExceptionTriggered",
    ]);
  });

  it("requires the follow-up move to resolve the check", () => {
    const { state } = play(gameFromScenario({ fen: BLOCK, mines: ["e4"] }), "a8e4");
    expect(() => play(state, "e8e7")).toThrow(/not legal/); // still on the e-file
    expect(legalMoves(state.position).map(moveToUci).sort()).toEqual([
      "e8d7",
      "e8d8",
      "e8f7",
      "e8f8",
    ]);
  });

  it("ends the exception when the follow-up resolves the check, in the same turn", () => {
    const first = play(gameFromScenario({ fen: BLOCK, mines: ["e4"] }), "a8e4").state;
    expect(first.position.fullmoveNumber).toBe(1);
    const { state, events } = play(first, "e8d8");
    expect(state.public.checkException).toBeNull();
    expect(state.position.turn).toBe("w");
    expect(state.position.fullmoveNumber).toBe(2); // the whole chain was one turn
    expect(eventTypes(events)).toContain("TurnPassed");
  });

  it("chains: a second blocker can explode too", () => {
    const fen = "b3k3/8/8/r7/8/8/8/4R2K b - - 0 1";
    const first = play(gameFromScenario({ fen, mines: ["e4", "e5"] }), "a8e4").state;
    const second = play(first, "a5e5");
    expect(second.events.filter((e) => e.type === "CheckExceptionTriggered")).toHaveLength(1);
    expect(second.state.public.checkException).toBe("b");
    expect(second.state.position.turn).toBe("b");
    const last = play(second.state, "e8d8").state;
    expect(last.position.turn).toBe("w");
    expect(last.position.fullmoveNumber).toBe(2);
  });

  // 3.6: a king on a mine in the follow-up still loses a life and stays.
  it("lets the follow-up king move hit a mine", () => {
    const game = gameFromScenario({ fen: BLOCK, mines: ["e4", "d8"] });
    const { state } = play(play(game, "a8e4").state, "e8d8");
    expect(state.public.lives).toEqual({ w: 3, b: 2 });
    expect(state.position.board[sq("d8")]?.type).toBe("k");
    expect(state.position.turn).toBe("w");
  });

  // 3.4: the en passant chance from before the move still stands during the follow-up.
  it("keeps the earlier en passant chance during the follow-up", () => {
    const fen = "4r2k/8/8/2Pp4/8/8/8/B3K3 w - d6 0 1";
    const { state } = play(gameFromScenario({ fen, mines: ["e5"] }), "a1e5");
    expect(state.public.checkException).toBe("w");
    expect(state.position.enPassant).toBe(sq("d6"));
  });

  // 3.4 (decided): no move resolves the check, so this is checkmate and the mover loses.
  it("is checkmate when the explosion leaves no resolving move", () => {
    const fen = "4k3/8/8/8/8/8/3N1PPP/r5K1 w - - 0 1";
    const { state, events } = play(gameFromScenario({ fen, mines: ["f1"] }), "d2f1");
    expect(state.public.status).toEqual({ kind: "over", result: "b", reason: "checkmate" });
    expect(state.public.checkException).toBeNull();
    expect(events.at(-1)).toEqual({ type: "GameOver", result: "b", reason: "checkmate" });
  });

  it("does not trigger when the explosion leaves the king safe", () => {
    const fen = "4k3/8/8/8/R7/8/8/4K3 w - - 0 1";
    const { state } = play(gameFromScenario({ fen, mines: ["d4"] }), "a4d4");
    expect(state.public.checkException).toBeNull();
    expect(state.position.turn).toBe("b");
  });
});
