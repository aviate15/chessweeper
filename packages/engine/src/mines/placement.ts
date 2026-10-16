import type { Board, Color, Square } from "../chess/types";
import { quotaFor, type GameConfig } from "./config";
import type { GameEvent } from "./events";
import { pickDistinct, type Rng } from "./rng";
import type { GameState, Phase } from "./state";

/*
 * Manual mine mode placement (design doc 3.10). Pure functions over `GameState`: each
 * returns a new state and events and never touches its input.
 */

export type PlacementError = "not-placing" | "quota-full" | "bad-square" | "already-ready";

export type PlacementResult =
  | { readonly ok: true; readonly state: GameState; readonly events: readonly GameEvent[] }
  | { readonly ok: false; readonly error: PlacementError };

type Placing = Extract<Phase, { kind: "placement" }>;

const fail = (error: PlacementError): PlacementResult => ({ ok: false, error });

/** The placement phase of a running game, or null (not Manual, in play, or game over). */
function placing(state: GameState): Placing | null {
  const phase = state.public.phase;
  return phase.kind === "placement" && state.public.status.kind === "ongoing" ? phase : null;
}

function emptySquares(board: Board): Square[] {
  const free: Square[] = [];
  board.forEach((piece, square) => {
    if (piece === null) free.push(square);
  });
  return free;
}

/**
 * Squares a player may put a mine on: every empty (unoccupied) square, ascending (3.10).
 * At the start of the game that is ranks 3-6. Empty when no placement is under way.
 */
export function legalPlacementSquares(state: GameState): Square[] {
  return placing(state) === null ? [] : emptySquares(state.position.board);
}

/** The start of a placement round: its phase and the quota from the free squares (3.10). */
export function placementPhase(board: Board, config: GameConfig, round: number): Placing {
  return {
    kind: "placement",
    round,
    quota: quotaFor(emptySquares(board).length, config),
    ready: { w: false, b: false },
  };
}

function withDraft(state: GameState, color: Color, draft: ReadonlySet<Square>): GameState {
  const drafts = state.hidden.drafts;
  if (drafts == null) throw new Error("Invariant violated: placing without drafts");
  return {
    ...state,
    hidden: {
      ...state.hidden,
      drafts: color === "w" ? { w: draft, b: drafts.b } : { w: drafts.w, b: draft },
    },
  };
}

function isSquare(square: Square): boolean {
  return Number.isInteger(square) && square >= 0 && square < 64;
}

/**
 * Puts one of `color`'s mines on `square` (3.10): an empty square, at most one mine per
 * square per player, up to the quota. Placing on a square already in the draft changes
 * nothing. Only until that player presses Done. Drafts are not mines until the round ends.
 */
export function placeMine(state: GameState, color: Color, square: Square): PlacementResult {
  const phase = placing(state);
  if (phase === null) return fail("not-placing");
  if (phase.ready[color]) return fail("already-ready");
  if (!isSquare(square) || state.position.board[square] != null) return fail("bad-square");
  const draft = state.hidden.drafts?.[color];
  if (draft === undefined) return fail("not-placing");
  if (draft.has(square)) return { ok: true, state, events: [] };
  if (draft.size >= phase.quota) return fail("quota-full");
  return { ok: true, state: withDraft(state, color, new Set(draft).add(square)), events: [] };
}

/** Takes one of `color`'s own placements back, until that player presses Done (3.10). */
export function unplaceMine(state: GameState, color: Color, square: Square): PlacementResult {
  const phase = placing(state);
  if (phase === null) return fail("not-placing");
  if (phase.ready[color]) return fail("already-ready");
  if (!isSquare(square)) return fail("bad-square");
  const draft = state.hidden.drafts?.[color];
  if (draft === undefined) return fail("not-placing");
  if (!draft.has(square)) return { ok: true, state, events: [] };
  const next = new Set(draft);
  next.delete(square);
  return { ok: true, state: withDraft(state, color, next), events: [] };
}

/**
 * Done (3.10): locks `color`'s draft and tells everyone the side is ready. It does not end
 * the round; once both are ready (`phase.ready`), or the timer ran out, the caller runs
 * `finishPlacement`, which random-fills anything below the quota.
 */
export function markReady(state: GameState, color: Color): PlacementResult {
  const phase = placing(state);
  if (phase === null) return fail("not-placing");
  if (phase.ready[color]) return fail("already-ready");
  const ready = color === "w" ? { w: true, b: phase.ready.b } : { w: phase.ready.w, b: true };
  return {
    ok: true,
    state: { ...state, public: { ...state.public, phase: { ...phase, ready } } },
    events: [{ type: "PlayerReady", color }],
  };
}

/**
 * Ends the placement round (3.10): each side's missing mines are placed at random on legal
 * squares, the two drafts merge into the live mines (a square in both is a big mine) and
 * play begins. Events: `MinesAutoPlaced` per side that needed filling (seat-private), then
 * `PlacementEnded`. A no-op (same state, no events) when no placement is under way.
 */
export function finishPlacement(
  state: GameState,
  rng: Rng,
): { state: GameState; events: GameEvent[] } {
  const phase = placing(state);
  const drafts = state.hidden.drafts;
  if (phase === null || drafts == null) return { state, events: [] };

  const free = emptySquares(state.position.board);
  const events: GameEvent[] = [];
  const filled = { w: new Set(drafts.w), b: new Set(drafts.b) };
  const autoPlaced = { w: 0, b: 0 };
  for (const color of ["w", "b"] as const) {
    const draft = filled[color];
    const open = free.filter((square) => !draft.has(square));
    const count = Math.min(Math.max(phase.quota - draft.size, 0), open.length);
    for (const square of pickDistinct(rng, open, count)) draft.add(square);
    autoPlaced[color] = count;
    if (count > 0) events.push({ type: "MinesAutoPlaced", color, count });
  }
  events.push({ type: "PlacementEnded", mineCount: filled.w.size + filled.b.size });

  return {
    state: {
      ...state,
      public: { ...state.public, phase: { kind: "play" } },
      hidden: {
        ...state.hidden,
        mines: new Set([...filled.w, ...filled.b]),
        owned: filled,
        drafts: null,
        autoPlaced,
      },
    },
    events,
  };
}
