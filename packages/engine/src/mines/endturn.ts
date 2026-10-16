import { isInCheck } from "../chess/attacks";
import type { Move } from "../chess/move";
import { legalMoves } from "../chess/movegen";
import type { Color, Position } from "../chess/types";
import { opponent } from "../chess/types";
import type { GameStatus } from "./state";
import type { Working } from "./landing";

export interface TurnEnd {
  readonly position: Position;
  readonly status: GameStatus;
  readonly checkException: Color | null;
}

interface FinishTurnInput {
  /** Position before the move being resolved (its turn is the mover's). */
  readonly before: Position;
  /** Result of the chess part of the move (the turn has already passed). */
  readonly moved: Position;
  readonly work: Working;
  readonly move: Move;
  readonly mover: Color;
  /** True if a landing destroyed a piece. */
  readonly destroyed: boolean;
}

/**
 * Decides what follows the landings (design doc 3.8 steps 5-8): the check exception, or
 * passing the turn. Appends events to `work.events`.
 */
export function finishTurn(input: FinishTurnInput): TurnEnd {
  const { before, moved, work, move, mover, destroyed } = input;

  // 3.4: a destroyed piece wastes the move; a destroyed double-pushed pawn sets no en
  // passant target.
  const afterLandings: Position = {
    ...moved,
    board: work.board,
    enPassant: destroyed ? null : moved.enPassant,
  };

  // 3.4 check exception: the explosion left the mover's own king in check, so the same
  // side moves again in the same turn. The en passant chance from before the move still
  // stands (unless this move was the en passant capture itself), and the fullmove number
  // is not advanced for the chain.
  if (destroyed && isInCheck(afterLandings, mover)) {
    const pending: Position = {
      ...afterLandings,
      turn: mover,
      enPassant: move.enPassant ? null : before.enPassant,
      fullmoveNumber: before.fullmoveNumber,
    };
    if (legalMoves(pending).length === 0) {
      // 3.4: no move resolves the check, so this is checkmate and the mover loses.
      const status: GameStatus = { kind: "over", result: opponent(mover), reason: "checkmate" };
      work.events.push({ type: "GameOver", result: status.result, reason: status.reason });
      return { position: pending, status, checkException: null };
    }
    work.events.push({ type: "CheckExceptionTriggered", color: mover });
    return { position: pending, status: { kind: "ongoing" }, checkException: mover };
  }

  work.events.push({ type: "TurnPassed", to: afterLandings.turn });
  return { position: afterLandings, status: { kind: "ongoing" }, checkException: null };
}
