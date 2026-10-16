import type { Rng } from "@chessweeper/engine";

/** Source of random 32-bit words; injectable so rejection sampling can be tested. */
export type RandomWords = (out: Uint32Array<ArrayBuffer>) => void;

const cryptoWords: RandomWords = (out) => {
  crypto.getRandomValues(out);
};

const RANGE = 0x1_0000_0000; // 2^32

/**
 * Cryptographically random Rng for production (the engine never touches crypto itself).
 * Uses rejection sampling so every integer in [0, maxExclusive) is equally likely: words in
 * the biased tail (the remainder of 2^32 / maxExclusive) are discarded and redrawn.
 */
export function createCryptoRng(words: RandomWords = cryptoWords): Rng {
  const buffer = new Uint32Array(1);
  return {
    nextInt(maxExclusive) {
      if (!Number.isInteger(maxExclusive) || maxExclusive < 1 || maxExclusive > RANGE) {
        throw new RangeError("maxExclusive must be an integer in [1, 2^32]");
      }
      const limit = RANGE - (RANGE % maxExclusive);
      for (;;) {
        words(buffer);
        const word = buffer[0] ?? 0;
        if (word < limit) return word % maxExclusive;
      }
    },
  };
}
