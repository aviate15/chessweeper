import type { Move } from "../chess/move";
import type { Color, Piece, PieceType, Square } from "../chess/types";

/**
 * Structured record of what happened during a move: enough for UI narration, animations
 * and the Moves dialog. Public events only; nothing here reveals an unexploded mine.
 *
 * Reserved for later milestones: CheckExceptionTriggered (M6), GameOver (M6),
 * Reshuffled (M7) and the server-only MineRelocated (M7).
 */
export type GameEvent =
  | { readonly type: "MoveMade"; readonly color: Color; readonly move: Move }
  | { readonly type: "PieceCaptured"; readonly square: Square; readonly piece: PieceType }
  | { readonly type: "MineTriggered"; readonly square: Square; readonly by: Piece }
  | { readonly type: "PieceDestroyed"; readonly square: Square; readonly piece: Piece }
  | {
      readonly type: "LifeLost";
      readonly color: Color;
      readonly square: Square;
      readonly livesLeft: number;
    }
  | { readonly type: "NumberRevealed"; readonly square: Square; readonly number: number }
  | {
      readonly type: "NumbersChanged";
      readonly updates: readonly { readonly square: Square; readonly number: number }[];
    }
  | { readonly type: "TurnPassed"; readonly to: Color };
