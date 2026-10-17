import type { CastlingRights, Color, PieceType, PromotionPiece, Square } from "../chess/types";
import type { GameSettings } from "../mines/settings";
import type { GameOverReason, GameResult, GameStatus, Lives, Phase } from "../mines/state";

/**
 * What a client may know (design doc 3.2). Every type here is plain JSON data: arrays
 * instead of Sets and Maps, no class instances. None has a field for mine positions, the
 * safe-start flags or the chain-capture flag, so a leak would not even compile.
 */

export interface PieceView {
  readonly color: Color;
  readonly type: PieceType;
}

export interface MoveView {
  readonly from: Square;
  readonly to: Square;
  readonly piece: PieceType;
  readonly captured: PieceType | null;
  readonly captureSquare: Square | null;
  readonly promotion: PromotionPiece | null;
  readonly castle: "king" | "queen" | null;
  readonly enPassant: boolean;
  readonly doublePush: boolean;
}

export interface NumberView {
  readonly square: Square;
  readonly number: number;
}

/** Public events as clients receive them. The server-only MineRelocated has no variant. */
export type EventView =
  | { readonly type: "MoveMade"; readonly color: Color; readonly move: MoveView }
  | { readonly type: "PieceCaptured"; readonly square: Square; readonly piece: PieceType }
  | { readonly type: "MineTriggered"; readonly square: Square; readonly by: PieceView }
  | { readonly type: "PieceDestroyed"; readonly square: Square; readonly piece: PieceView }
  | {
      readonly type: "LifeLost";
      readonly color: Color;
      readonly square: Square;
      readonly livesLeft: number;
    }
  | { readonly type: "NumberRevealed"; readonly square: Square; readonly number: number }
  | { readonly type: "NumbersChanged"; readonly updates: readonly NumberView[] }
  | { readonly type: "CheckExceptionTriggered"; readonly color: Color }
  | { readonly type: "GameOver"; readonly result: GameResult; readonly reason: GameOverReason }
  | { readonly type: "TurnPassed"; readonly to: Color }
  | { readonly type: "Reshuffled"; readonly mineCount: number }
  // Manual mine mode (3.10) events, same shape as the engine events.
  | { readonly type: "PlacementStarted"; readonly round: number; readonly quota: number }
  | { readonly type: "PlayerReady"; readonly color: Color }
  | { readonly type: "PlacementEnded"; readonly mineCount: number }
  | {
      readonly type: "BigMineBlasted";
      readonly square: Square;
      readonly by: PieceView;
      readonly area: readonly Square[];
    }
  /** Seat-private: only ever projected to its own colour (3.10), never to the opponent or null. */
  | { readonly type: "MinesAutoPlaced"; readonly color: Color; readonly count: number };

export interface LogEntryView {
  readonly color: Color;
  readonly events: readonly EventView[];
}

/** A piece that left the board: taken by a capture or destroyed by a mine (3.4, 3.5). */
export interface FallenView {
  readonly piece: PieceType;
  readonly cause: "capture" | "mine";
}

/**
 * Manual mine placement as one client may see it (3.10). `own` is the viewer's own
 * placements (a draft until they press Done); null for pass-and-play and spectators.
 * The opponent's placements are never here: only `ready` says they are done.
 */
export interface PlacementView {
  readonly quota: number;
  readonly ready: { readonly w: boolean; readonly b: boolean };
  readonly own: readonly Square[] | null;
}

export interface PublicView {
  /** Seat this view was made for; null for pass-and-play or a spectator. */
  readonly viewer: Color | null;
  /** 64 entries indexed by Square. */
  readonly board: readonly (PieceView | null)[];
  readonly turn: Color;
  readonly castling: CastlingRights;
  readonly enPassant: Square | null;
  readonly fullmoveNumber: number;
  readonly lives: Lives;
  /** Revealed squares with their live numbers, sorted by square (3.2). */
  readonly revealed: readonly NumberView[];
  /** Sorted by square (3.4). */
  readonly craters: readonly Square[];
  /** Live mines on the board: a public count, never positions (3.2). */
  readonly mineCount: number;
  /** The settings this game runs with: public, so nobody is surprised by them (3.9). */
  readonly settings: GameSettings;
  /**
   * Manual mode (3.10): public, so a reconnect sees it. Omitted in Auto mode, like
   * `settings.mode`, so Auto views keep their exact shape; read it with `phaseOf`.
   */
  readonly phase?: Phase;
  /** Manual mode only: non-null just during a placement round (3.10). Omitted in Auto. */
  readonly placement?: PlacementView | null;
  /**
   * Turns left before the next reshuffle (3.7). A pure function of the counter: the counter
   * is 0 during a placement round, so it reads the full interval until play begins.
   */
  readonly turnsUntilReshuffle: number;
  readonly status: GameStatus;
  readonly checkException: Color | null;
  /** Whether the side to move is in check. */
  readonly inCheck: boolean;
  readonly log: readonly LogEntryView[];
  /** Pieces each colour has lost, in the order they fell. */
  readonly fallen: { readonly w: readonly FallenView[]; readonly b: readonly FallenView[] };
}

/** The final mine layout, available only once the game has ended (3.6, UI decision 14). */
export interface GameOverView {
  readonly view: PublicView;
  /** Mines still live at game end, sorted by square. */
  readonly mines: readonly Square[];
  /**
   * Manual mode (3.10): who placed each live mine, each list sorted (a big mine is in
   * both). Null in Auto mode.
   */
  /** Who placed each mine; present only in Manual mine games (3.10). */
  readonly owned?: { readonly w: readonly Square[]; readonly b: readonly Square[] } | undefined;
}

export type SafeErrorCode = "illegal-move" | "game-over" | "not-playing" | "internal";

/** An error that is safe to send to a client: fixed text, never derived from engine state. */
export interface SafeError {
  readonly code: SafeErrorCode;
  readonly message: string;
}
