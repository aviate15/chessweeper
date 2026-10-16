import type { Color, Square } from "../chess/types";
import type { GameState } from "../mines/state";

/**
 * A seat's own placement draft during a Manual placement round (3.10), sorted. Like
 * `gameover.ts` this reads `state.hidden`, which the fenced view files may not. Only
 * `placementView` calls it, and only with the viewer's own colour.
 */
export function ownDraft(state: GameState, color: Color): Square[] {
  return [...(state.hidden.drafts?.[color] ?? [])].sort((a, b) => a - b);
}
