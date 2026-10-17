import type { Color, EventView, PieceView, Square } from "@chessweeper/engine";

/** Timings in ms. Pure data: the CSS keyframes in theme.css use the same numbers. */
export const SLIDE_MS = 140;
export const EXPLOSION_FRAME_MS = 80;
export const EXPLOSION_MS = EXPLOSION_FRAME_MS * 4;
export const POP_MS = 200;
export const FLIP_MS = 200;
export const CRACK_MS = 400;
export const CHECK_MS = 600;
export const WAVE_ROW_MS = 30;
export const WAVE_MS = 240;
export const MINE_STAGGER_MS = 40;
/** A big mine blast (3.10) ripples outwards: each ring of the 3x3 starts this much later. */
export const BLAST_RING_MS = 70;
/** The explosion gate never blocks longer than this (UI decision, local play only). */
export const MAX_BLOCKING_MS = 800;

export type Fx =
  | { kind: "slide"; from: Square; to: Square; delayMs: number; durationMs: number }
  | { kind: "capture"; square: Square; piece: PieceView; delayMs: number; durationMs: number }
  | { kind: "flip"; square: Square; delayMs: number; durationMs: number }
  | { kind: "explosion"; square: Square; delayMs: number; durationMs: number }
  | { kind: "lifeCrack"; color: Color; square: Square; delayMs: number; durationMs: number }
  | { kind: "check"; square: Square; delayMs: number; durationMs: number }
  | { kind: "reshuffle"; delayMs: number; durationMs: number }
  | { kind: "mineReveal"; delayMs: number; durationMs: number }
  | {
      kind: "blast";
      square: Square;
      area: readonly Square[];
      delayMs: number;
      durationMs: number;
    };

export interface Presentation {
  /** How long a local client may hold the handoff/dialog back so the explosion is seen. */
  blockingMs: number;
  fx: Fx[];
}

export interface PresentationOptions {
  reducedMotion: boolean;
  /** Square of the king of the side to move, when that side is in check after the turn. */
  checkSquare?: Square | null;
  /** Number of mines shown at game over (sets the length of the staggered reveal). */
  mineCount?: number;
}

export const NO_PRESENTATION: Presentation = { blockingMs: 0, fx: [] };

/** When every effect of a presentation is over, relative to its start. */
export function fxEndMs(fx: readonly Fx[]): number {
  return fx.reduce((end, f) => Math.max(end, f.delayMs + f.durationMs), 0);
}

function rookSlide(from: Square, castle: "king" | "queen"): { from: Square; to: Square } {
  const rankBase = from - (from % 8);
  return castle === "king"
    ? { from: rankBase + 7, to: rankBase + 5 }
    : { from: rankBase, to: rankBase + 3 };
}

/**
 * Turns the public events of one move or ending into animation effects and a blocking time.
 * Pure; under reduced motion there are no effects and nothing blocks.
 */
export function presentationFor(
  events: readonly EventView[],
  options: PresentationOptions,
): Presentation {
  if (options.reducedMotion) return NO_PRESENTATION;
  const fx: Fx[] = [];
  let blocking = 0;
  let mineIndex = 0;
  const moved = events.find((e) => e.type === "MoveMade");
  const destroyedAt = new Set<Square>();
  for (const e of events) if (e.type === "PieceDestroyed") destroyedAt.add(e.square);
  if (moved) {
    const m = moved.move;
    if (!destroyedAt.has(m.to)) {
      fx.push({ kind: "slide", from: m.from, to: m.to, delayMs: 0, durationMs: SLIDE_MS });
    }
    if (m.castle !== null) {
      const rook = rookSlide(m.from, m.castle);
      if (!destroyedAt.has(rook.to)) {
        fx.push({ kind: "slide", ...rook, delayMs: 0, durationMs: SLIDE_MS });
      }
    }
    if (m.captured !== null) {
      fx.push({
        kind: "capture",
        square: m.captureSquare ?? m.to,
        piece: { color: moved.color === "w" ? "b" : "w", type: m.captured },
        delayMs: 0,
        durationMs: POP_MS,
      });
    }
  }
  for (const e of events) {
    switch (e.type) {
      case "MineTriggered": {
        const delayMs = SLIDE_MS + mineIndex * (EXPLOSION_MS / 2);
        mineIndex++;
        fx.push({ kind: "explosion", square: e.square, delayMs, durationMs: EXPLOSION_MS });
        blocking = Math.max(blocking, delayMs + EXPLOSION_MS + 60);
        break;
      }
      case "BigMineBlasted": {
        const delayMs = SLIDE_MS + mineIndex * (EXPLOSION_MS / 2);
        mineIndex++;
        const durationMs = EXPLOSION_MS + BLAST_RING_MS;
        fx.push({ kind: "blast", square: e.square, area: e.area, delayMs, durationMs });
        blocking = Math.max(blocking, delayMs + durationMs + 60);
        break;
      }
      case "LifeLost":
        fx.push({
          kind: "lifeCrack",
          color: e.color,
          square: e.square,
          delayMs: SLIDE_MS,
          durationMs: CRACK_MS,
        });
        break;
      case "NumberRevealed":
        fx.push({ kind: "flip", square: e.square, delayMs: SLIDE_MS, durationMs: FLIP_MS });
        break;
      case "Reshuffled":
        fx.push({ kind: "reshuffle", delayMs: 0, durationMs: 7 * WAVE_ROW_MS + WAVE_MS });
        break;
      case "GameOver":
        fx.push({
          kind: "mineReveal",
          delayMs: 0,
          durationMs: (options.mineCount ?? 0) * MINE_STAGGER_MS + 200,
        });
        break;
      default:
        break;
    }
  }
  if (options.checkSquare !== null && options.checkSquare !== undefined) {
    fx.push({
      kind: "check",
      square: options.checkSquare,
      delayMs: SLIDE_MS,
      durationMs: CHECK_MS,
    });
  }
  return { blockingMs: Math.min(MAX_BLOCKING_MS, blocking), fx };
}

/** The user's reduced-motion preference; false where matchMedia is unavailable. */
export function prefersReducedMotion(): boolean {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}
