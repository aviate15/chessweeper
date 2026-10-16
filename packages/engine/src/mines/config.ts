/** Tunable game parameters (design doc 3.1, 3.6, 3.7). Defaults are [T] until playtesting. */
export interface GameConfig {
  /** Mines as a fraction of free squares. */
  readonly mineDensity: number;
  /** Optional upper limit on the mine count; null for none. */
  readonly mineCap: number | null;
  readonly kingLives: number;
  /** Turns without a capture before the mines are reshuffled (3.7). */
  readonly reshuffleInterval: number;
}

export const DEFAULT_CONFIG: GameConfig = {
  mineDensity: 0.25,
  mineCap: null,
  kingLives: 3,
  reshuffleInterval: 6,
};

/**
 * Mines for a given number of free squares: density × free, rounded half-up, then capped
 * (design doc 3.7). At the start, 25% of the 32 squares on ranks 3-6 gives 8 (3.1).
 */
export function mineCountFor(freeSquares: number, config: GameConfig): number {
  const count = Math.floor(config.mineDensity * freeSquares + 0.5);
  return config.mineCap === null ? count : Math.min(count, config.mineCap);
}
