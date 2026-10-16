/**
 * Mine-density / placement study (playtest 3). Plays seeded random games on the real
 * engine, no UI, and prints one table per move policy.
 *
 *   pnpm --filter @chessweeper/engine sim [-- <games per variant>]
 *
 * Not a test and not run in CI. "engine" variants use the engine's own placement (at most
 * 2 mines per 3x3 area, design doc 3.1). Other placements are tried here only, by replacing
 * `hidden.mines` after setup and after every reshuffle. Safe-start relocation is the
 * engine's own and ignores the constraint. The first study (2026-10-17) compared uniform
 * placement with these spread-out rules; uniform is no longer in the engine.
 */
import { legalMoves } from "../src/chess/movegen";
import { castleRookSquares, type Move } from "../src/chess/move";
import { fileOf, rankOf } from "../src/chess/square";
import type { Square } from "../src/chess/types";
import {
  createGame,
  createSeededRng,
  resolveMove,
  revealedNumbers,
  type GameState,
  type Rng,
} from "../src/index";
import { pickDistinct } from "../src/mines/rng";
import { mineCountFor } from "../src/mines/config";

declare const console: { log(...args: unknown[]): void };
declare const process: { argv: string[] };

type Placement = "engine" | "nonadjacent" | "max2per3x3";
type Policy = "random" | "capture-pref";

interface Variant {
  readonly name: string;
  readonly density: number;
  readonly placement: Placement;
}

const INTERVAL = 6;
const MAX_PLIES = 150;

const VARIANTS: readonly Variant[] = [
  { name: "25% engine", density: 0.25, placement: "engine" },
  { name: "30% engine", density: 0.3, placement: "engine" },
  { name: "35% engine", density: 0.35, placement: "engine" },
  { name: "30% no-adjacent", density: 0.3, placement: "nonadjacent" },
];

function windowSquares(center: Square): Square[] {
  const out: Square[] = [];
  for (let df = -1; df <= 1; df++) {
    for (let dr = -1; dr <= 1; dr++) {
      const f = fileOf(center) + df;
      const r = rankOf(center) + dr;
      if (f >= 0 && f < 8 && r >= 0 && r < 8) out.push(r * 8 + f);
    }
  }
  return out;
}

function maxIn3x3(mines: ReadonlySet<Square>): number {
  let best = 0;
  for (let c = 0; c < 64; c++) {
    let n = 0;
    for (const s of windowSquares(c)) if (mines.has(s)) n += 1;
    best = Math.max(best, n);
  }
  return best;
}

function allowed(mines: ReadonlySet<Square>, square: Square, placement: Placement): boolean {
  if (placement === "engine") return true;
  if (placement === "nonadjacent") {
    return !windowSquares(square).some((s) => mines.has(s));
  }
  // max 2 mines in any 3x3 window: every window containing `square` must have room.
  return windowSquares(square).every((c) => {
    let n = 0;
    for (const s of windowSquares(c)) if (mines.has(s)) n += 1;
    return n < 2;
  });
}

/** Spread placement; may come up short when the constraint cannot be met. */
function place(
  rng: Rng,
  candidates: readonly Square[],
  count: number,
  placement: Placement,
): Set<Square> {
  let best = new Set<Square>();
  // Random greedy packs poorly, so retry a few times before accepting a shortfall.
  for (let attempt = 0; attempt < 50 && best.size < count; attempt++) {
    const mines = new Set<Square>();
    for (const s of pickDistinct(rng, candidates, candidates.length)) {
      if (mines.size >= count) break;
      if (allowed(mines, s, placement)) mines.add(s);
    }
    if (mines.size > best.size) best = mines;
  }
  return best;
}

function withMines(state: GameState, mines: Set<Square>): GameState {
  return { ...state, hidden: { ...state.hidden, mines } };
}

function respread(state: GameState, rng: Rng, variant: Variant, initial: boolean): GameState {
  const free: Square[] = [];
  state.position.board.forEach((piece, sq) => {
    if (piece !== null) return;
    if (initial && (rankOf(sq) < 2 || rankOf(sq) > 5)) return;
    free.push(sq);
  });
  const count = mineCountFor(free.length, state.config);
  return withMines(state, place(rng, free, count, variant.placement));
}

function landings(move: Move): Square[] {
  const rook = castleRookSquares(move);
  return rook === null ? [move.to] : [move.to, rook.to];
}

class Acc {
  n = 0;
  sum = 0;
  min = Infinity;
  max = -Infinity;
  add(x: number): void {
    this.n += 1;
    this.sum += x;
    this.min = Math.min(this.min, x);
    this.max = Math.max(this.max, x);
  }
  get mean(): number {
    return this.n === 0 ? 0 : this.sum / this.n;
  }
}

class Stats {
  startMines = new Acc();
  reshuffleMines = new Acc();
  startShortfall = 0;
  reshuffleShortfall = 0;
  reshuffles = 0;
  games = 0;
  lopsided = 0;
  sparseHalf = 0;
  maxWindowStart = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
  maxWindowReshuffle = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
  w1Hit = new Acc(); // share of White's 20 opening moves that land on a mine
  moveHit = { early: new Acc(), mid: new Acc(), late: new Acc() }; // per position, share of legal moves
  explosions = { early: new Acc(), mid: new Acc(), late: new Acc() }; // per ply, 0/1
  numbers = new Acc();
  numMax = 0;
  num3plus = 0;
  numZero = 0;
  numCount = 0;
  relocations = 0;
  widened = 0;
  dropped = 0;
  positions = 0;
  stuckPositions = 0;
  gamesStuck = 0;
  plies = new Acc();
  ends: Record<string, number> = {};
}

function phase(ply: number): "early" | "mid" | "late" {
  return ply < 20 ? "early" : ply < 60 ? "mid" : "late";
}

function pickOne(rng: Rng, moves: readonly Move[]): Move {
  const move = moves[rng.nextInt(moves.length)];
  if (move === undefined) throw new RangeError("No moves to choose from");
  return move;
}

function choose(rng: Rng, moves: readonly Move[], policy: Policy): Move {
  if (policy === "capture-pref") {
    const caps = moves.filter((m) => m.captured !== null);
    if (caps.length > 0 && rng.nextInt(2) === 0) return pickOne(rng, caps);
  }
  return pickOne(rng, moves);
}

function countHalves(mines: ReadonlySet<Square>): { w: number; b: number } {
  let w = 0;
  let b = 0;
  for (const s of mines) {
    const r = rankOf(s);
    if (r === 2 || r === 3) w += 1;
    else if (r === 4 || r === 5) b += 1;
  }
  return { w, b };
}

function playGame(seed: number, variant: Variant, policy: Policy, stats: Stats): void {
  const rng = createSeededRng(seed);
  const config = {
    mineDensity: variant.density,
    mineCap: null,
    kingLives: 3,
    reshuffleInterval: INTERVAL,
  };
  let state = createGame({ rng, config });
  const expected = mineCountFor(32, config);
  if (variant.placement !== "engine") state = respread(state, rng, variant, true);

  const size = state.hidden.mines.size;
  stats.games += 1;
  stats.startMines.add(size);
  if (size < expected) stats.startShortfall += 1;
  const win = maxIn3x3(state.hidden.mines);
  stats.maxWindowStart[Math.min(win, 9)] = (stats.maxWindowStart[Math.min(win, 9)] ?? 0) + 1;
  const halves = countHalves(state.hidden.mines);
  if (Math.max(halves.w, halves.b) * 3 >= size * 2) stats.lopsided += 1;
  if (Math.min(halves.w, halves.b) <= 1) stats.sparseHalf += 1;
  const first = legalMoves(state.position);
  stats.w1Hit.add(
    first.filter((m) => landings(m).some((s) => state.hidden.mines.has(s))).length / first.length,
  );

  let stuckHere = false;
  let ply = 0;
  while (state.public.status.kind === "ongoing" && ply < MAX_PLIES) {
    const moves = legalMoves(state.position);
    if (moves.length === 0) break;
    const mines = state.hidden.mines;
    const unsafe = moves.filter((m) => landings(m).some((s) => mines.has(s))).length;
    const ph = phase(ply);
    stats.moveHit[ph].add(unsafe / moves.length);
    stats.positions += 1;
    if (unsafe === moves.length) {
      stats.stuckPositions += 1;
      stuckHere = true;
    }

    const res = resolveMove(state, choose(rng, moves, policy), rng);
    state = res.state;
    ply += 1;
    let exploded = 0;
    let reshuffled = false;
    for (const e of res.events) {
      if (e.type === "MineTriggered") exploded = 1;
      else if (e.type === "Reshuffled") reshuffled = true;
      else if (e.type === "MineRelocated") {
        stats.relocations += 1;
        if (e.to === null) stats.dropped += 1;
        else if (rankOf(e.to) < 2 || rankOf(e.to) > 5) stats.widened += 1;
      }
    }
    stats.explosions[ph].add(exploded);

    if (reshuffled && variant.placement !== "engine") {
      state = respread(state, rng, variant, false);
    }
    if (reshuffled) {
      stats.reshuffles += 1;
      const want = state.hidden.mines.size;
      stats.reshuffleMines.add(want);
      const w = maxIn3x3(state.hidden.mines);
      stats.maxWindowReshuffle[Math.min(w, 9)] =
        (stats.maxWindowReshuffle[Math.min(w, 9)] ?? 0) + 1;
      const free = state.position.board.filter((p) => p === null).length;
      if (want < mineCountFor(free, config)) stats.reshuffleShortfall += 1;
    }

    for (const n of revealedNumbers(state).values()) {
      stats.numbers.add(n);
      stats.numCount += 1;
      stats.numMax = Math.max(stats.numMax, n);
      if (n >= 3) stats.num3plus += 1;
      if (n === 0) stats.numZero += 1;
    }
  }
  if (stuckHere) stats.gamesStuck += 1;
  stats.plies.add(ply);
  const st = state.public.status;
  const key = st.kind === "over" ? st.reason : "cap/none";
  stats.ends[key] = (stats.ends[key] ?? 0) + 1;
}

const pct = (x: number, d = 1): string => `${(x * 100).toFixed(d)}%`;
const f1 = (x: number): string => x.toFixed(1);

function report(variant: Variant, s: Stats): Record<string, string> {
  const g = s.games;
  const hi = (a: number[], from: number): number => a.slice(from).reduce((x, y) => x + y, 0);
  const ends = Object.entries(s.ends)
    .map(([k, v]) => `${k} ${pct(v / g, 0)}`)
    .join(", ");
  return {
    variant: variant.name,
    "mines start (mean)": f1(s.startMines.mean),
    "mines after reshuffle (mean min-max)": `${f1(s.reshuffleMines.mean)} (${String(s.reshuffleMines.min)}-${String(s.reshuffleMines.max)})`,
    "start shortfall": pct(s.startShortfall / g),
    "reshuffle shortfall": pct(s.reshuffleShortfall / Math.max(1, s.reshuffles)),
    "W opening moves on a mine": pct(s.w1Hit.mean),
    "half has <=1 mine (start)": pct(s.sparseHalf / g),
    "one side holds >=2/3 (start)": pct(s.lopsided / g),
    "max mines in a 3x3, start >=3 / >=4": `${pct(hi(s.maxWindowStart, 3) / g, 0)} / ${pct(hi(s.maxWindowStart, 4) / g, 0)}`,
    "max mines in a 3x3, reshuffle >=3 / >=4": `${pct(hi(s.maxWindowReshuffle, 3) / Math.max(1, s.reshuffles), 0)} / ${pct(hi(s.maxWindowReshuffle, 4) / Math.max(1, s.reshuffles), 0)}`,
    "legal moves on a mine early/mid/late": `${pct(s.moveHit.early.mean)} / ${pct(s.moveHit.mid.mean)} / ${pct(s.moveHit.late.mean)}`,
    "explosions per ply early/mid/late": `${pct(s.explosions.early.mean)} / ${pct(s.explosions.mid.mean)} / ${pct(s.explosions.late.mean)}`,
    "revealed number avg / max": `${s.numbers.mean.toFixed(2)} / ${String(s.numMax)}`,
    "revealed number 0 / >=3": `${pct(s.numZero / Math.max(1, s.numCount), 0)} / ${pct(s.num3plus / Math.max(1, s.numCount), 1)}`,
    "safe-start relocations per game": (s.relocations / g).toFixed(2),
    "widened / dropped (games)": `${pct(s.widened / g, 2)} / ${pct(s.dropped / g, 2)}`,
    "stuck positions / games": `${pct(s.stuckPositions / Math.max(1, s.positions), 3)} / ${pct(s.gamesStuck / g, 2)}`,
    "plies avg": f1(s.plies.mean),
    endings: ends,
  };
}

function main(): void {
  const arg = Number(process.argv[process.argv.length - 1]);
  const games = Number.isInteger(arg) && arg > 0 ? arg : 1000;
  for (const policy of ["random", "capture-pref"] as const) {
    console.log(
      `\n=== policy: ${policy}, ${String(games)} games per variant, reshuffle every ${String(INTERVAL)}, cap ${String(MAX_PLIES)} plies ===`,
    );
    const rows = VARIANTS.map((variant) => {
      const stats = new Stats();
      for (let i = 0; i < games; i++) playGame(1000 + i, variant, policy, stats);
      return report(variant, stats);
    });
    const keys = Object.keys(rows[0] ?? {});
    for (const key of keys.filter((k) => k !== "variant")) {
      console.log(`\n${key}`);
      for (const row of rows) console.log(`  ${(row.variant ?? "").padEnd(18)} ${row[key] ?? ""}`);
    }
  }
}

main();
