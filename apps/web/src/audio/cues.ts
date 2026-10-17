import type { EventView } from "@chessweeper/engine";

export type Cue =
  | "move"
  | "capture"
  | "flag"
  | "reveal"
  | "explosion"
  | "kingHit"
  | "check"
  | "reshuffle"
  | "gameOver"
  | "click";

/** Dominant-cue priority, highest first. `check` and `reshuffle` ride along as the 2nd cue. */
const PRIORITY: readonly Cue[] = [
  "gameOver",
  "kingHit",
  "explosion",
  "capture",
  "check",
  "reveal",
  "move",
];

/**
 * Maps the public events of a turn to at most two sound cues.
 * check = CheckExceptionTriggered (the only public check signal in the event stream).
 */
export function cuesFor(events: readonly EventView[]): Cue[] {
  const found = new Set<Cue>();
  for (const e of events) {
    switch (e.type) {
      case "MoveMade":
        found.add(e.move.captured !== null ? "capture" : "move");
        break;
      case "PieceCaptured":
        found.add("capture");
        break;
      case "MineTriggered":
      case "BigMineBlasted":
      case "PieceDestroyed":
        found.add("explosion");
        break;
      case "LifeLost":
        found.add("kingHit");
        break;
      case "NumberRevealed":
        found.add("reveal");
        break;
      case "CheckExceptionTriggered":
        found.add("check");
        break;
      case "Reshuffled":
        found.add("reshuffle");
        break;
      case "GameOver":
        found.add("gameOver");
        break;
      default:
        break;
    }
  }
  const dominant = PRIORITY.find((c) => found.has(c));
  if (dominant === undefined) return found.has("reshuffle") ? ["reshuffle"] : [];
  const out: Cue[] = [dominant];
  if (dominant !== "check" && found.has("check")) out.push("check");
  else if (found.has("reshuffle")) out.push("reshuffle");
  return out;
}
