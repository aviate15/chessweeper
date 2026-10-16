const KEY = "chessweeper.muted";

let muted = false;
let loaded = false;
const listeners = new Set<(m: boolean) => void>();

function load(): void {
  if (loaded) return;
  loaded = true;
  try {
    muted = globalThis.localStorage.getItem(KEY) === "1";
  } catch {
    muted = false;
  }
}

export function isMuted(): boolean {
  load();
  return muted;
}

export function setMuted(b: boolean): void {
  load();
  if (b === muted) return;
  muted = b;
  try {
    globalThis.localStorage.setItem(KEY, b ? "1" : "0");
  } catch {
    // storage unavailable: keep the in-memory value
  }
  for (const fn of [...listeners]) fn(b);
}

export function subscribeMuted(fn: (m: boolean) => void): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

/** Test hook: forget the cached value so the next read hits storage again. */
export function resetSettingsForTests(): void {
  loaded = false;
  muted = false;
  listeners.clear();
}
