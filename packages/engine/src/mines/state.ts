import type { Position, Square } from "../chess/types";
import type { GameConfig } from "./config";

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

export interface Lives {
  readonly w: number;
  readonly b: number;
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
  /** Turns since the last capture. Unused until the reshuffle work (3.7). */
  readonly noCaptureCount: number;
}

export interface HiddenState {
  /** Live mine squares. Never exposed to clients. */
  readonly mines: ReadonlySet<Square>;
}
