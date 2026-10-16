import { noFlags, type Flags, type PublicView } from "@chessweeper/engine";

/**
 * Flags after a snapshot (design doc 3.3, 3.7). A reshuffle clears flags, and one can happen
 * while the client is away. `seenLogLength` is how much of the move log the flags have seen:
 * if any later log entry holds a Reshuffled event, the flags are stale and are dropped.
 */
export function flagsAfterSnapshot(
  flags: Flags,
  seenLogLength: number | null,
  view: PublicView,
): Flags {
  if (seenLogLength === null) return flags;
  if (seenLogLength > view.log.length) return noFlags();
  const missed = view.log
    .slice(seenLogLength)
    .some((entry) => entry.events.some((e) => e.type === "Reshuffled"));
  return missed ? noFlags() : flags;
}
