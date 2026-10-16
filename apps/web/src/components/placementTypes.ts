import {
  DEFAULT_MANUAL_RESHUFFLE_INTERVAL,
  DEFAULT_RESHUFFLE_INTERVAL,
  type EventView,
  type GameMode,
  type GameOverView,
  type Phase,
  type PublicView,
  type Square,
} from "@chessweeper/engine";

export type { GameMode, Phase };

/** Default reshuffle interval per mode (6 auto, 10 manual). */
export const DEFAULT_INTERVAL_BY_MODE: Readonly<Record<GameMode, number>> = {
  auto: DEFAULT_RESHUFFLE_INTERVAL,
  manual: DEFAULT_MANUAL_RESHUFFLE_INTERVAL,
};

export interface PlacementInfo {
  readonly quota: number;
  readonly ready: { readonly w: boolean; readonly b: boolean };
  /** The viewer's own draft; null for a spectator. */
  readonly own: readonly Square[] | null;
}

/**
 * PublicView plus the manual-mode additions (3.10).
 * M-B-RECONCILE: once the engine's PublicView carries `phase` and `placement`, this is an
 * alias of PublicView; local play builds these fields in useLocalGame, online in online/wire.ts.
 */
export type PlacementView = PublicView & {
  readonly phase: Phase;
  readonly placement: PlacementInfo | null;
};

/** Final mine layout per placer; a square in both lists is a big mine. */
export interface OwnedLayout {
  readonly w: readonly Square[];
  readonly b: readonly Square[];
}

/**
 * The game-over view with the final layout by placer (3.10), null in Auto mode.
 * M-B-RECONCILE: `owned` becomes a required field of the engine's GameOverView.
 */
export type GameOverWithOwned = Omit<GameOverView, "view"> & {
  readonly view: PlacementView;
  readonly owned?: OwnedLayout | null | undefined;
};

/** Public event: a big mine went off and hit the 3x3 area around it. */
export type BigMineBlastedEvent = Extract<EventView, { type: "BigMineBlasted" }>;

/** Mines each player places at the start of a game (3.10): half the starting count, half-up. */
export function placementQuota(densityPercent: number): number {
  return Math.floor((densityPercent * 32) / 100 / 2 + 0.5);
}
