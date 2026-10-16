import type { Move } from "../chess/move";
import type { Color, Piece, PieceType, Square } from "../chess/types";
import type { GameOverReason, GameResult } from "./state";

/**
 * Structured record of what happened during a move: enough for UI narration, animations
 * and the Moves dialog. Public events only; nothing here reveals an unexploded mine.
 *
 * Reserved for later milestones: Reshuffled (M7) and the server-only MineRelocated (M7).
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
  | { readonly type: "CheckExceptionTriggered"; readonly color: Color }
  | {
      readonly type: "GameOver";
      readonly result: GameResult;
      readonly reason: GameOverReason;
    }
  | { readonly type: "TurnPassed"; readonly to: Color };
