/** Fixed wire error codes. Messages are fixed text, never derived from input or engine state. */
export const ERROR_CODES = [
  "bad-message",
  "not-your-turn",
  "stale-seq",
  "room-not-found",
  "room-full",
  "rate-limited",
  "illegal-move",
  "game-over",
  "internal",
  "forbidden",
  "not-playing",
] as const;

export type ErrorCode = (typeof ERROR_CODES)[number];

export const ERROR_MESSAGES: Readonly<Record<ErrorCode, string>> = {
  "bad-message": "Malformed message",
  "not-your-turn": "It is not your turn",
  "stale-seq": "Your view is out of date",
  "room-not-found": "Room not found",
  "room-full": "Room is full",
  "rate-limited": "Too many requests",
  "illegal-move": "Illegal move",
  "game-over": "The game is over",
  internal: "Internal error",
  forbidden: "Not allowed",
  "not-playing": "Mines are being placed",
};
