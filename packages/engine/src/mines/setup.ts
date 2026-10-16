import { parseFen, START_FEN } from "../chess/fen";
import { rankOf } from "../chess/square";
import type { Square } from "../chess/types";
import { DEFAULT_CONFIG, mineCountFor, type GameConfig } from "./config";
import { placementPhase } from "./placement";
import type { Rng } from "./rng";
import { placeSpread } from "./spread";
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
  if (config.mode === "manual") {
    // 3.10: no mines yet. Both players place secretly (round 1), White first locally; no
    // safe start because both sides place blind.
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
        phase: placementPhase(position.board, config, 1),
      },
      hidden: {
        mines: new Set(),
        safeStart: { w: false, b: false },
        chainCaptured: false,
        owned: { w: new Set(), b: new Set() },
        drafts: { w: new Set(), b: new Set() },
        autoPlaced: null,
        placementRound: 1,
      },
      config,
    };
  }
  const candidates: Square[] = [];
  position.board.forEach((piece, square) => {
    const rank = rankOf(square);
    if (piece === null && rank >= FIRST_MINE_RANK && rank <= LAST_MINE_RANK) {
      candidates.push(square);
    }
  });
  const mines = placeSpread(rng, candidates, mineCountFor(candidates.length, config));

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
      phase: { kind: "play" },
    },
    hidden: {
      mines: new Set(mines),
      safeStart: { w: true, b: true },
      chainCaptured: false,
      owned: null,
      drafts: null,
      autoPlaced: null,
      placementRound: 0,
    },
    config,
  };
}
