import type { Color, PublicView, Square } from "@chessweeper/engine";

/**
 * Structural mirror of the Manual mine contract (3.10). These are defined locally because the
 * engine types land in parallel. When the engine exports them, replace this file's contents with
 * re-exports and keep the names.
 */
export type GameMode = "auto" | "manual";

/** Default reshuffle interval per mode (6 auto, 10 manual). */
export const DEFAULT_INTERVAL_BY_MODE: Readonly<Record<GameMode, number>> = {
  auto: 6,
  manual: 10,
};

export type Phase =
  | { readonly kind: "play" }
  | {
      readonly kind: "placement";
      readonly round: number;
      readonly quota: number;
      readonly ready: { readonly w: boolean; readonly b: boolean };
    };

export interface PlacementInfo {
  readonly quota: number;
  readonly ready: { readonly w: boolean; readonly b: boolean };
  /** The viewer's own draft; null for a spectator. */
  readonly own: readonly Square[] | null;
}

/** PublicView plus the manual-mode additions. */
export type PlacementView = PublicView & {
  readonly phase: Phase;
  readonly placement: PlacementInfo | null;
};

/** Final mine layout per placer; a square in both lists is a big mine. */
export interface OwnedLayout {
  readonly w: readonly Square[];
  readonly b: readonly Square[];
}

/** Public event: a big mine went off and hit the 3x3 area around it. */
export interface BigMineBlastedEvent {
  readonly type: "BigMineBlasted";
  readonly square: Square;
  readonly by: { readonly color: Color; readonly type: string };
  readonly area: readonly Square[];
}

/** Mines each player places at the start of a game (3.10): half the starting count, half-up. */
export function placementQuota(densityPercent: number): number {
  return Math.floor((densityPercent * 32) / 100 / 2 + 0.5);
}
