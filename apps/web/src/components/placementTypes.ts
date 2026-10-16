import {
  DEFAULT_MANUAL_RESHUFFLE_INTERVAL,
  DEFAULT_RESHUFFLE_INTERVAL,
  type GameMode,
  type GameOverView,
  type Phase,
} from "@chessweeper/engine";

export type { GameMode, Phase };

/** Default reshuffle interval per mode (6 auto, 10 manual). */
export const DEFAULT_INTERVAL_BY_MODE: Readonly<Record<GameMode, number>> = {
  auto: DEFAULT_RESHUFFLE_INTERVAL,
  manual: DEFAULT_MANUAL_RESHUFFLE_INTERVAL,
};

/** Final mine layout per placer; a square in both lists is a big mine (3.10). */
export type OwnedLayout = NonNullable<GameOverView["owned"]>;

/** Mines each player places at the start of a game (3.10): half the starting count, half-up. */
export function placementQuota(densityPercent: number): number {
  return Math.floor((densityPercent * 32) / 100 / 2 + 0.5);
}
