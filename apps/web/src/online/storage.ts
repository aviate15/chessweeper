import type { Color, Flags, Square } from "@chessweeper/engine";
import { isValidCode } from "./code";

/*
 * Everything the online client keeps in localStorage. Storage may be missing, full or throw
 * (private windows, blocked site data), so every access is wrapped and failures are silent:
 * the game still works, it just cannot resume after a reload.
 */

const PREFIX = "chessweeper.online.";
const CURRENT_KEY = `${PREFIX}current`;
const seatKey = (code: string) => `${PREFIX}seat.${code}`;
const flagsKey = (code: string, seat: Color) => `${PREFIX}flags.${code}.${seat}`;

function read(key: string): unknown {
  try {
    const raw = localStorage.getItem(key);
    return raw === null ? null : (JSON.parse(raw) as unknown);
  } catch {
    return null;
  }
}

function write(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage unavailable: nothing persists.
  }
}

function remove(key: string): void {
  try {
    localStorage.removeItem(key);
  } catch {
    // Storage unavailable.
  }
}

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null;

/** The code of the game to resume on load, if any. */
export function loadCurrent(): string | null {
  const v = read(CURRENT_KEY);
  return isObject(v) && typeof v.code === "string" && isValidCode(v.code) ? v.code : null;
}

export function saveCurrent(code: string): void {
  write(CURRENT_KEY, { code });
}

export interface StoredSeat {
  readonly seat: Color;
  readonly token: string;
}

export function loadSeat(code: string): StoredSeat | null {
  const v = read(seatKey(code));
  if (!isObject(v)) return null;
  const { seat, token } = v;
  if ((seat !== "w" && seat !== "b") || typeof token !== "string") return null;
  if (!/^[A-Za-z0-9_-]{1,64}$/.test(token)) return null;
  return { seat, token };
}

export function saveSeat(code: string, seat: Color, token: string): void {
  write(seatKey(code), { seat, token });
}

/** Private flags for one game and seat (design doc 3.3), plus how much of the log they have seen. */
export interface StoredFlags {
  readonly squares: readonly Square[];
  readonly logLength: number;
}

export function loadFlags(code: string, seat: Color): StoredFlags | null {
  const v = read(flagsKey(code, seat));
  if (!isObject(v) || !Array.isArray(v.squares) || typeof v.logLength !== "number") return null;
  const squares = (v.squares as unknown[]).filter(
    (s): s is number => typeof s === "number" && Number.isInteger(s) && s >= 0 && s < 64,
  );
  if (!Number.isInteger(v.logLength) || v.logLength < 0) return null;
  return { squares, logLength: v.logLength };
}

export function saveFlags(code: string, seat: Color, flags: Flags, logLength: number): void {
  write(flagsKey(code, seat), { squares: [...flags], logLength });
}

/** Forgets a game: its seat token, both seats' flags, and the resume pointer if it is this game. */
export function clearGame(code: string): void {
  remove(seatKey(code));
  remove(flagsKey(code, "w"));
  remove(flagsKey(code, "b"));
  if (loadCurrent() === code) remove(CURRENT_KEY);
}
