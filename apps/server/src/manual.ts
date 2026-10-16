import {
  projectEvents,
  toGameOverView,
  toPublicView,
  type Color,
  type GameEvent,
  type GameState,
} from "@chessweeper/engine";
import type { EventView, GameOverView, PublicView } from "@chessweeper/protocol";

/*
 * Manual mine mode (design doc 3.10) projection shims.
 *
 * M-B-RECONCILE: the engine's own toPublicView(state, seat) / projectEvents(events, seat) /
 * toGameOverView(state, seat) will carry phase, placement, MinesAutoPlaced and owned. When M-B
 * lands, replace these three helpers by direct calls and delete this file. Until then they read
 * the placement state themselves, per seat, and are the only place the server touches drafts.
 */

const sorted = (set: ReadonlySet<number>): number[] => [...set].sort((a, b) => a - b);

/** Events for one seat: public ones, plus that seat's own MinesAutoPlaced and nobody else's. */
export function projectFor(events: readonly GameEvent[], color: Color): EventView[] {
  const out: EventView[] = [];
  for (const event of events) {
    if (event.type === "MinesAutoPlaced") {
      if (event.color === color)
        out.push({ type: "MinesAutoPlaced", color: event.color, count: event.count });
    } else {
      out.push(...projectEvents([event]));
    }
  }
  return out;
}

/** The seat's public view plus the placement phase and the seat's own draft. */
export function viewFor(state: GameState, color: Color): PublicView {
  const base = toPublicView(state, color);
  const phase = state.public.phase;
  if (phase.kind === "play") {
    // Auto games keep their exact wire shape: no phase or placement fields.
    return state.config.mode === "manual"
      ? { ...base, phase: { kind: "play" }, placement: null }
      : base;
  }
  return {
    ...base,
    phase: {
      kind: "placement",
      round: phase.round,
      quota: phase.quota,
      ready: { w: phase.ready.w, b: phase.ready.b },
    },
    placement: {
      quota: phase.quota,
      ready: { w: phase.ready.w, b: phase.ready.b },
      own: sorted(state.hidden.drafts?.[color] ?? new Set<number>()),
    },
  };
}

/** The game-over view; `owned` is set (manual games) only once the game has ended. */
export function overFor(state: GameState, color: Color): GameOverView | null {
  const over = toGameOverView(state, color);
  if (over === null) return null;
  if (state.config.mode !== "manual") return over;
  const owned = state.hidden.owned;
  return {
    ...over,
    view: viewFor(state, color),
    owned: owned == null ? null : { w: sorted(owned.w), b: sorted(owned.b) },
  };
}
