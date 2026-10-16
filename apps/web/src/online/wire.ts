import type { EventView, GameSettings } from "@chessweeper/engine";
import type {
  EventView as WireEvent,
  GameOverView as WireGameOver,
  GameSettings as WireSettings,
  PublicView as WireView,
} from "@chessweeper/protocol";
import type { GameOverWithOwned, PlacementView } from "../components/placementTypes";

/*
 * Adapters from the wire types (@chessweeper/protocol) to the types the UI renders from.
 * M-C-RECONCILE: once the protocol re-exports the engine's own view and event types (M-B),
 * these shrink to the `phase` default and the MinesAutoPlaced split.
 */

const isPublicEvent = (event: WireEvent): event is EventView => event.type !== "MinesAutoPlaced";

export function settingsFromWire(settings: WireSettings): GameSettings {
  const base = {
    reshuffleInterval: settings.reshuffleInterval,
    densityPercent: settings.densityPercent,
  };
  // Auto games keep `mode` omitted, exactly like the engine's own settings.
  return settings.mode === "manual" ? { ...base, mode: "manual" } : base;
}

/** The wire view as the UI's view: a missing `phase` (an Auto game) means play. */
export function viewFromWire(view: WireView): PlacementView {
  const { phase, placement, log, settings, ...rest } = view;
  return {
    ...rest,
    settings: settingsFromWire(settings),
    log: log.map((entry) => ({ color: entry.color, events: entry.events.filter(isPublicEvent) })),
    phase: phase ?? { kind: "play" },
    placement: placement ?? null,
  };
}

export function gameOverFromWire(over: WireGameOver): GameOverWithOwned {
  return {
    view: viewFromWire(over.view),
    mines: over.mines,
    owned: over.owned ?? null,
  };
}

/**
 * Splits an update's events into the public ones and the viewer's own random-fill count
 * (`MinesAutoPlaced`, sent only to the placer it concerns).
 */
export function splitEvents(
  events: readonly WireEvent[],
  seat: "w" | "b" | null,
): { events: EventView[]; autoPlaced: number | null } {
  let autoPlaced: number | null = null;
  const pub: EventView[] = [];
  for (const event of events) {
    if (event.type === "MinesAutoPlaced") {
      if (event.color === seat) autoPlaced = event.count;
    } else {
      pub.push(event);
    }
  }
  return { events: pub, autoPlaced };
}
