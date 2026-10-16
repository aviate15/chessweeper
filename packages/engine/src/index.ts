/**
 * Chessweeper rules engine. Pure: no DOM, no network, no clock; RNG is injected.
 * Rules live in docs/GAME_DESIGN.md.
 */
export * from "./chess/types";
export * from "./chess/square";
export * from "./chess/fen";
export * from "./chess/attacks";
export * from "./chess/move";
export { applyMove } from "./chess/apply";
export { legalMoves } from "./chess/movegen";
export * from "./chess/status";
export { perft, perftDivide } from "./chess/perft";
export * from "./mines/rng";
export * from "./mines/config";
export * from "./mines/state";
export { createGame, type CreateGameOptions } from "./mines/setup";
export * from "./mines/numbers";
export * from "./mines/events";
