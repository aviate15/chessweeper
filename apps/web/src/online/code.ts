import { CODE_ALPHABET, CODE_LENGTH } from "@chessweeper/protocol";

/** Uppercases and strips all whitespace, so a pasted or typed code matches the wire format. */
export function normalizeCode(input: string): string {
  return input.toUpperCase().replace(/\s+/g, "");
}

/** True for a complete invite code: right length, only characters from the code alphabet. */
export function isValidCode(code: string): boolean {
  return code.length === CODE_LENGTH && new RegExp(`^[${CODE_ALPHABET}]+$`).test(code);
}
