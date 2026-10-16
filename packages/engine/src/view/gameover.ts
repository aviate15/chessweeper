import type { Color } from "../chess/types";
import type { GameState } from "../mines/state";
import { toPublicView } from "./public";
import type { GameOverView } from "./types";

/**
 * The end-of-game view: the public view plus the final live mine layout (design doc 3.6,
 * UI decision 14). Returns null unless the game has ended, so mine positions can never be
 * produced for a running game. This is the only view file that reads `state.hidden`.
 */
export function toGameOverView(state: GameState, viewer: Color | null): GameOverView | null {
  if (state.public.status.kind !== "over") return null;
  return {
    view: toPublicView(state, viewer),
    mines: [...state.hidden.mines].sort((a, b) => a - b),
  };
}
