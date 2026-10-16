import type { Color, PublicView } from "@chessweeper/engine";

/**
 * Who the device must be passed to after `mover` played, or null when it must not be.
 * No handoff while the game is over or during a check-exception chain (3.4), where the same
 * side moves again.
 */
export function handoffAfterMove(mover: Color, view: PublicView): Color | null {
  if (view.status.kind === "over") return null;
  if (view.checkException !== null) return null;
  return view.turn !== mover ? view.turn : null;
}
