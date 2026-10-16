const FLIP_KEY = "chessweeper.flip";

/** Flip-board preference for pass-and-play. Default ON; storage may be missing or throw. */
export function loadFlip(): boolean {
  try {
    return localStorage.getItem(FLIP_KEY) !== "0";
  } catch {
    return true;
  }
}

export function saveFlip(flip: boolean): void {
  try {
    localStorage.setItem(FLIP_KEY, flip ? "1" : "0");
  } catch {
    // Storage unavailable: the setting simply does not persist.
  }
}
