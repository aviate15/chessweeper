import type { Move } from "../chess/move";
import type { Color, Piece, PieceType, Square } from "../chess/types";
import type { GameOverReason, GameResult } from "./state";

/**
 * Structured record of what happened during a move: enough for UI narration, animations
 * and the Moves dialog. Public events only; nothing here reveals an unexploded mine.
 *
 * Public events only, except the server-side ones in `ServerOnlyEvent`.
 */
export type PublicEvent =
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
  | { readonly type: "TurnPassed"; readonly to: Color }
  | { readonly type: "Reshuffled"; readonly mineCount: number }
  // Manual mine mode (3.10).
  | { readonly type: "PlacementStarted"; readonly round: number; readonly quota: number }
  | { readonly type: "PlayerReady"; readonly color: Color }
  /** `mineCount` counts mines, a big mine as 2 (so it is 2 x quota after a full round). */
  | { readonly type: "PlacementEnded"; readonly mineCount: number }
  /**
   * A big mine blasted its 3x3 `area` (3.10), instead of the single-mine `MineTriggered`.
   * `by` is the piece that landed on it. The kills and life losses follow as
   * `PieceDestroyed` and `LifeLost` events.
   */
  | {
      readonly type: "BigMineBlasted";
      readonly square: Square;
      readonly by: Piece;
      readonly area: readonly Square[];
    };

/**
 * Events only the server may see. The client projection must never forward them to the
 * wrong seat: they reveal hidden mine positions or one player's private information.
 */
export type ServerOnlyEvent =
  | {
      readonly type: "MineRelocated";
      readonly from: Square;
      /** Where the mine went, or null if no square existed and it was removed (3.1). */
      readonly to: Square | null;
    }
  | {
      /**
       * Manual mode (3.10): `count` of `color`'s mines were placed at random when the round
       * ended. Seat-private: only that player is told, never the opponent.
       */
      readonly type: "MinesAutoPlaced";
      readonly color: Color;
      readonly count: number;
    };

export type GameEvent = PublicEvent | ServerOnlyEvent;

/** Allow-list: a new event type is non-public until it is added here. */
const PUBLIC_EVENT_TYPES: ReadonlySet<string> = new Set<PublicEvent["type"]>([
  "MoveMade",
  "PieceCaptured",
  "MineTriggered",
  "PieceDestroyed",
  "LifeLost",
  "NumberRevealed",
  "NumbersChanged",
  "CheckExceptionTriggered",
  "GameOver",
  "TurnPassed",
  "Reshuffled",
  "PlacementStarted",
  "PlayerReady",
  "PlacementEnded",
  "BigMineBlasted",
]);

export function isPublicEvent(event: GameEvent): event is PublicEvent {
  return PUBLIC_EVENT_TYPES.has(event.type);
}
