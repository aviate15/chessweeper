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
  readonly checkException?: Color | null;
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
  const mines = squares(scenario.mines ?? []);
  for (const mine of mines) {
    if (position.board[mine] != null) throw new Error("Scenario puts a mine under a piece");
  }
  return {
    position,
    public: {
      revealed: squares(scenario.revealed ?? []),
      craters: squares(scenario.craters ?? []),
      lives: scenario.lives ?? { w: config.kingLives, b: config.kingLives },
      noCaptureCount: 0,
      status: scenario.status ?? { kind: "ongoing" },
      checkException: scenario.checkException ?? null,
    },
    hidden: { mines },
    config,
  };
}
