import { parseFen, START_FEN } from "../chess/fen";
import { rankOf } from "../chess/square";
import type { Square } from "../chess/types";
import { DEFAULT_CONFIG, mineCountFor, type GameConfig } from "./config";
import { pickDistinct, type Rng } from "./rng";
import type { GameState } from "./state";

/** Ranks 3-6 (0-based rank indices 2-5) hold the starting mines (design doc 3.1). */
const FIRST_MINE_RANK = 2;
const LAST_MINE_RANK = 5;

export interface CreateGameOptions {
  readonly rng: Rng;
  readonly config?: GameConfig;
}

/**
 * New game from the standard start position with mines placed on ranks 3-6 only, on
 * empty squares, never under a piece (design doc 3.1).
 */
export function createGame({ rng, config = DEFAULT_CONFIG }: CreateGameOptions): GameState {
  const position = parseFen(START_FEN);
  const candidates: Square[] = [];
  position.board.forEach((piece, square) => {
    const rank = rankOf(square);
    if (piece === null && rank >= FIRST_MINE_RANK && rank <= LAST_MINE_RANK) {
      candidates.push(square);
    }
  });
  const mines = pickDistinct(rng, candidates, mineCountFor(candidates.length, config));

  return {
    position,
    public: {
      revealed: new Set(),
      craters: new Set(),
      lives: { w: config.kingLives, b: config.kingLives },
      noCaptureCount: 0,
      status: { kind: "ongoing" },
      checkException: null,
      log: [],
    },
    hidden: { mines: new Set(mines), safeStart: { w: true, b: true }, chainCaptured: false },
    config,
  };
}
