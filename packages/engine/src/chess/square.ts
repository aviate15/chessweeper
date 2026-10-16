import type { Square } from "./types";

const FILES = "abcdefgh";

/** file and rank are 0-based: file 0 = a, rank 0 = rank 1. */
export function squareOf(file: number, rank: number): Square {
  return rank * 8 + file;
}

export function fileOf(square: Square): number {
  return square % 8;
}

export function rankOf(square: Square): number {
  return Math.floor(square / 8);
}

export function isOnBoard(file: number, rank: number): boolean {
  return file >= 0 && file < 8 && rank >= 0 && rank < 8;
}

/** The square shifted by (df, dr), or null if that falls off the board. */
export function offsetSquare(square: Square, df: number, dr: number): Square | null {
  const file = fileOf(square) + df;
  const rank = rankOf(square) + dr;
  return isOnBoard(file, rank) ? squareOf(file, rank) : null;
}

/** "e4" → Square, or null if the text is not a square name. */
export function parseSquare(name: string): Square | null {
  if (name.length !== 2) return null;
  const file = FILES.indexOf(name.charAt(0));
  const rank = Number(name.charAt(1)) - 1;
  if (file < 0 || !Number.isInteger(rank) || !isOnBoard(file, rank)) return null;
  return squareOf(file, rank);
}

export function squareName(square: Square): string {
  return `${FILES.charAt(fileOf(square))}${String(rankOf(square) + 1)}`;
}
