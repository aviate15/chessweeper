import type { EventView } from "@chessweeper/engine";
import { cuesFor, type Cue } from "./cues";
import { isMuted, setMuted, subscribeMuted } from "./settings";
import { hasContext, initContext, play } from "./synth";

export type { Cue };
export { isMuted, setMuted, subscribeMuted };

/** Creates/resumes the AudioContext. Call on the first user pointer or key event. */
export function unlockAudio(): void {
  initContext();
}

export function playCue(cue: Cue): void {
  if (!hasContext() || isMuted()) return;
  play(cue);
}

export function playCues(events: readonly EventView[]): void {
  if (!hasContext() || isMuted()) return;
  cuesFor(events).forEach((cue, i) => {
    play(cue, i * 0.12);
  });
}
