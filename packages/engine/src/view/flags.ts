import type { Square } from "../chess/types";
import type { EventView } from "./types";

/*
 * Flags are private notes (design doc 3.3): not engine state, never sent to the server.
 * The browser keeps one set per seat (pass-and-play: one per colour, showing only the side
 * to move). These helpers are pure and return new sets.
 */

export type Flags = ReadonlySet<Square>;

export const noFlags = (): Flags => new Set<Square>();

/** Adds the flag if absent, removes it if present. */
export function toggleFlag(flags: Flags, square: Square): Flags {
  const next = new Set(flags);
  if (!next.delete(square)) next.add(square);
  return next;
}

/** Flags after a batch of events: a reshuffle clears them all (3.3, 3.7). */
export function flagsAfterEvents(flags: Flags, events: readonly EventView[]): Flags {
  return events.some((e) => e.type === "Reshuffled") ? noFlags() : flags;
}
