/**
 * Injected randomness. The engine never touches Math.random or crypto: tests pass a
 * seeded RNG, production passes a cryptographic one built by the server or web app.
 */
export interface Rng {
  /** A uniformly random integer in [0, maxExclusive). */
  nextInt(maxExclusive: number): number;
}

/** Deterministic RNG (mulberry32) for tests and reproducible scenarios. */
export function createSeededRng(seed: number): Rng {
  let state = seed >>> 0;
  const next = (): number => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return { nextInt: (maxExclusive) => Math.floor(next() * maxExclusive) };
}

/** `count` distinct items chosen uniformly at random (partial Fisher-Yates). */
export function pickDistinct<T>(rng: Rng, items: readonly T[], count: number): T[] {
  if (count > items.length) throw new RangeError("Cannot pick more items than exist");
  const pool = items.slice();
  for (let i = 0; i < count; i++) {
    const j = i + rng.nextInt(pool.length - i);
    const picked = pool[j] as T;
    pool[j] = pool[i] as T;
    pool[i] = picked;
  }
  return pool.slice(0, count);
}
