import { ERROR_CODES, type ErrorCode } from "@chessweeper/protocol";

/** Friendly copy for every wire error code. The server's own text is never shown. */
export const FRIENDLY_ERRORS: Readonly<Record<ErrorCode, string>> = {
  "bad-message": "Something went wrong talking to the server. Please try again.",
  "not-your-turn": "It is not your turn.",
  "stale-seq": "Your board was out of date. Refreshing it...",
  "room-not-found": "That code doesn't match any game.",
  "room-full": "That game already has two players.",
  "rate-limited": "Slow down a little and try again.",
  "illegal-move": "That move isn't allowed.",
  "game-over": "The game is already over.",
  internal: "The server had a problem. Please try again.",
  forbidden: "That isn't allowed right now.",
};

const GENERIC = "Something went wrong. Please try again.";

const KNOWN = new Set<string>(ERROR_CODES);

/** Maps a wire error code (or anything else) to a message fit for a player. */
export function friendlyError(code: string): string {
  return KNOWN.has(code) ? FRIENDLY_ERRORS[code as ErrorCode] : GENERIC;
}

/** Why the client gave up on a game for good. */
export type FatalReason = "taken-over" | "room-closed" | "game-gone" | "connect-failed";

export const FATAL_MESSAGES: Readonly<Record<FatalReason, string>> = {
  "taken-over": "This game was opened in another tab or window.",
  "room-closed": "The game was closed by the server.",
  "game-gone": "That game no longer exists.",
  "connect-failed": "Could not reach the game server.",
};
