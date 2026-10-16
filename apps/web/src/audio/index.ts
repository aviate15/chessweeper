import type { EventView } from "@chessweeper/engine";

// STUB: replaced by the real audio module at merge.
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

let muted = false;
const listeners = new Set<() => void>();

export function unlockAudio(): void {
  // no-op
}

export const playCue: (cue: Cue) => void = () => undefined;

export const playCues: (events: readonly EventView[]) => void = () => undefined;

export function setMuted(b: boolean): void {
  muted = b;
  listeners.forEach((fn) => {
    fn();
  });
}

export function isMuted(): boolean {
  return muted;
}

export function subscribeMuted(fn: () => void): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}
