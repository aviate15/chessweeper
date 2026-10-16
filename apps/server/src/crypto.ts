import { createHash, randomBytes, randomInt, timingSafeEqual } from "node:crypto";
import type { Rng } from "@chessweeper/engine";
import { CODE_ALPHABET, CODE_LENGTH } from "@chessweeper/protocol";

/** Production RNG for mine placement and relocation: cryptographically random (CLAUDE.md). */
export function createCryptoRng(): Rng {
  return { nextInt: (maxExclusive) => randomInt(maxExclusive) };
}

/** A 6-character invite code from the unambiguous alphabet. */
export function newInviteCode(): string {
  let code = "";
  for (let i = 0; i < CODE_LENGTH; i++)
    code += CODE_ALPHABET.charAt(randomInt(CODE_ALPHABET.length));
  return code;
}

/** A seat token: 32 random bytes, base64url. Never logged. */
export function newSeatToken(): string {
  return randomBytes(32).toString("base64url");
}

/** Constant-time comparison. Digests make the buffers equal length whatever the input. */
export function tokensEqual(a: string, b: string): boolean {
  const da = createHash("sha256").update(a).digest();
  const db = createHash("sha256").update(b).digest();
  return timingSafeEqual(da, db);
}
