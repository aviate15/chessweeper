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
