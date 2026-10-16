import { isInCheck } from "../chess/attacks";
import type { Move } from "../chess/move";
import { legalMoves } from "../chess/movegen";
import { gameStatus } from "../chess/status";
import type { Color, Position } from "../chess/types";
import { opponent } from "../chess/types";
import type { GameOverReason, GameResult, GameStatus } from "./state";
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
  /** True if a landing destroyed a piece of the mover's (in a big-mine blast, any of them). */
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

  // 3.6 precedence: landings resolve first, so a king that lost its last life loses the game
  // before any check or mate is considered, even if the same move would mate the opponent.
  if (work.lives[mover] === 0) {
    const status = over(opponent(mover), "king-lives", work);
    return { position: afterLandings, status, checkException: null };
  }

  // 3.10: a blast can also take the opponent's last king life, which ends the game in the
  // mover's favour (both kings dying was caught above: the mover loses).
  if (work.lives[opponent(mover)] === 0) {
    const status = over(mover, "king-lives", work);
    return { position: afterLandings, status, checkException: null };
  }

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
      const status = over(opponent(mover), "checkmate", work);
      return { position: pending, status, checkException: null };
    }
    work.events.push({ type: "CheckExceptionTriggered", color: mover });
    return { position: pending, status: { kind: "ongoing" }, checkException: mover };
  }

  // The turn passes. 3.6: checkmate (the mover wins) and stalemate (a draw) follow standard
  // chess rules and ignore mines; there are no other automatic draws.
  work.events.push({ type: "TurnPassed", to: afterLandings.turn });
  const chess = gameStatus(afterLandings);
  if (chess === "checkmate") {
    return {
      position: afterLandings,
      status: over(mover, "checkmate", work),
      checkException: null,
    };
  }
  if (chess === "stalemate") {
    return {
      position: afterLandings,
      status: over("draw", "stalemate", work),
      checkException: null,
    };
  }
  return { position: afterLandings, status: { kind: "ongoing" }, checkException: null };
}

function over(result: GameResult, reason: GameOverReason, work: Working): GameStatus {
  work.events.push({ type: "GameOver", result, reason });
  return { kind: "over", result, reason };
}
