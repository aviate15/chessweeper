import { parseFen } from "../chess/fen";
import { parseSquare } from "../chess/square";
import type { Square } from "../chess/types";
import { DEFAULT_CONFIG, type GameConfig } from "./config";
import type { Color } from "../chess/types";
import type { GameState, GameStatus, Lives } from "./state";

export interface Scenario {
  readonly fen: string;
  /** Square names such as "e4". */
  readonly mines?: readonly string[];
  readonly lives?: Lives;
  readonly revealed?: readonly string[];
  readonly craters?: readonly string[];
  readonly config?: GameConfig;
  readonly status?: GameStatus;
  /** Turns since the last capture (default 0). */
  readonly noCaptureCount?: number;
  /** Sides that still have their safe first move (default none, so scenarios behave literally). */
  readonly safeStart?: { readonly w: boolean; readonly b: boolean };
  readonly checkException?: Color | null;
  /**
   * Manual mine mode (3.10): the live mines each player placed, by square name. The state
   * then has `owned` set and `mines` is their union (a square in both is a big mine); do
   * not also pass `mines`. Use with a manual `config`.
   */
  readonly owned?: { readonly w?: readonly string[]; readonly b?: readonly string[] };
  /** Manual mode: start in a placement phase with this quota (round defaults to 1). */
  readonly placement?: { readonly quota: number; readonly round?: number };
}

function squares(names: readonly string[]): Set<Square> {
  return new Set(
    names.map((name) => {
      const square = parseSquare(name);
      if (square === null) throw new Error(`Bad square name "${name}"`);
      return square;
    }),
  );
}

/**
 * Builds an exact game state for tests. Throws if a mine sits under a piece, because
 * that can never happen in a real game (design doc 3.1, 3.5). Not exported from the
 * package index.
 */
export function gameFromScenario(scenario: Scenario): GameState {
  const config = scenario.config ?? DEFAULT_CONFIG;
  const position = parseFen(scenario.fen);
  const ownedW = squares(scenario.owned?.w ?? []);
  const ownedB = squares(scenario.owned?.b ?? []);
  const manual = scenario.owned !== undefined || scenario.placement !== undefined;
  const mines = manual ? new Set([...ownedW, ...ownedB]) : squares(scenario.mines ?? []);
  for (const mine of mines) {
    if (position.board[mine] != null) throw new Error("Scenario puts a mine under a piece");
  }
  const round = scenario.placement?.round ?? 1;
  return {
    position,
    public: {
      revealed: squares(scenario.revealed ?? []),
      craters: squares(scenario.craters ?? []),
      lives: scenario.lives ?? { w: config.kingLives, b: config.kingLives },
      noCaptureCount: scenario.noCaptureCount ?? 0,
      status: scenario.status ?? { kind: "ongoing" },
      checkException: scenario.checkException ?? null,
      log: [],
      phase:
        scenario.placement === undefined
          ? { kind: "play" }
          : {
              kind: "placement",
              round,
              quota: scenario.placement.quota,
              ready: { w: false, b: false },
            },
    },
    hidden: {
      mines,
      safeStart: scenario.safeStart ?? { w: false, b: false },
      chainCaptured: false,
      owned: manual ? { w: ownedW, b: ownedB } : null,
      drafts: scenario.placement === undefined ? null : { w: new Set(), b: new Set() },
      autoPlaced: null,
      placementRound: manual ? round : 0,
    },
    config,
  };
}
