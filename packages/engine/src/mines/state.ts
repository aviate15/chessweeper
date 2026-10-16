import type { Color, Position, Square } from "../chess/types";
import type { GameConfig } from "./config";
import type { PublicEvent } from "./events";

/**
 * Game state, split so the type system keeps secrets apart from public data.
 * Only `position` and `public` may ever reach a client; `hidden` stays on the server
 * (the M8 projection builds client views by whitelisting fields, never by deleting).
 */
export interface GameState {
  readonly position: Position;
  readonly public: PublicState;
  readonly hidden: HiddenState;
  readonly config: GameConfig;
}

export type GameResult = "w" | "b" | "draw";
export type GameOverReason =
  "king-lives" | "checkmate" | "stalemate" | "resignation" | "agreement" | "abandonment";

export type GameStatus =
  | { readonly kind: "ongoing" }
  | { readonly kind: "over"; readonly result: GameResult; readonly reason: GameOverReason };

export interface Lives {
  readonly w: number;
  readonly b: number;
}

/** Public events of one `resolveMove` call, kept for the status bar and the Moves dialog. */
export interface LogEntry {
  readonly color: Color;
  readonly events: readonly PublicEvent[];
}

export interface PublicState {
  /**
   * Squares whose number is shown (design doc 3.2). Numbers themselves are derived from
   * the live mines on demand (see numbers.ts) because they must stay live.
   */
  readonly revealed: ReadonlySet<Square>;
  /** Public craters left by triggered mines (3.4). */
  readonly craters: ReadonlySet<Square>;
  readonly lives: Lives;
  /** Turns since the last capture (3.7). */
  readonly noCaptureCount: number;
  readonly status: GameStatus;
  /**
   * Set while a check-exception chain is pending (design doc 3.4): that side must move
   * again this turn. Public, since the turn, the check and the explosion are all visible.
   */
  readonly checkException: Color | null;
  /**
   * Append-only move log, one entry per move (a check-exception chain has several).
   * Only public events are stored: server-only events are filtered out when written.
   */
  readonly log: readonly LogEntry[];
  /** Always `{ kind: "play" }` in Auto mode; Manual mode starts in placement (3.10). */
  readonly phase: Phase;
}

export interface HiddenState {
  /** Live mine squares. Never exposed to clients. */
  readonly mines: ReadonlySet<Square>;
  /**
   * Whether each side still has its safe first move (design doc 3.1). Engine bookkeeping;
   * clients never need it.
   */
  readonly safeStart: { readonly w: boolean; readonly b: boolean };
  /**
   * True while a check-exception chain is pending and an earlier move of the chain captured
   * a piece, so the turn counts as a capture turn for the reshuffle counter (3.7).
   */
  readonly chainCaptured: boolean;
  /**
   * Manual mine mode (3.10): the live mines each player placed, so `mines` is their union.
   * A square in both sets is a big mine. Null in Auto mode.
   */
  readonly owned?: { readonly w: ReadonlySet<Square>; readonly b: ReadonlySet<Square> } | null;
  /** Manual mode: each player's private placements during a placement phase, else null. */
  readonly drafts?: { readonly w: ReadonlySet<Square>; readonly b: ReadonlySet<Square> } | null;
  /** Manual mode: mines each side had placed at random in the last round (3.10), else null. */
  readonly autoPlaced?: { readonly w: number; readonly b: number } | null;
  /** Manual mode: number of the latest placement round started (1 at the start); 0 in Auto. */
  readonly placementRound?: number;
}

/** Manual mine mode (3.10): whether moves or mine placement are being accepted. */
export type Phase =
  | { readonly kind: "play" }
  | {
      readonly kind: "placement";
      readonly round: number;
      /** Mines each player places this round. */
      readonly quota: number;
      readonly ready: { readonly w: boolean; readonly b: boolean };
    };
