import { afterEach, describe, expect, it } from "vitest";
import {
  configFromSettings,
  createGame,
  DEFAULT_SETTINGS,
  createSeededRng,
  legalMoves,
  resolveMove,
  type GameSettings,
  type GameState,
} from "@chessweeper/engine";
import { startHarness, twoPlayers, type Harness } from "./testkit";

/*
 * 3.2 / 3.6 information boundary, end to end: record every raw frame of a scripted game and
 * check that nothing about the mines leaves the server until the game is over.
 */

interface Step {
  from: number;
  to: number;
  promo?: "n" | "b" | "r" | "q";
  color: "w" | "b";
}

interface Plan {
  seed: number;
  steps: Step[];
  final: GameState;
  seen: Set<string>;
}

/** Plays non-capturing random moves with the engine directly, tracking what happened. */
function simulate(seed: number, plies: number, settings: GameSettings): Plan {
  const rng = createSeededRng(seed);
  const chooser = createSeededRng(seed + 100_000);
  let state = createGame({ rng, config: configFromSettings(settings) });
  const steps: Step[] = [];
  const seen = new Set<string>();
  for (let i = 0; i < plies && state.public.status.kind === "ongoing"; i++) {
    const legal = legalMoves(state.position);
    const quiet = legal.filter((m) => m.captured === null);
    const pool = quiet.length > 0 ? quiet : legal;
    const move = pool[chooser.nextInt(pool.length)];
    if (move === undefined) break;
    steps.push({
      from: move.from,
      to: move.to,
      color: state.position.turn,
      ...(move.promotion === null ? {} : { promo: move.promotion }),
    });
    const res = resolveMove(state, move, rng);
    for (const e of res.events) seen.add(e.type);
    state = res.state;
  }
  return { seed, steps, final: state, seen };
}

/** Finds a seed whose game has a safe-start relocation, an explosion and a reshuffle. */
function findScenario(settings: GameSettings): Plan {
  for (let seed = 1; seed < 5000; seed++) {
    const plan = simulate(seed, 30, settings);
    if (
      plan.seen.has("MineRelocated") &&
      plan.seen.has("MineTriggered") &&
      plan.seen.has("Reshuffled")
    ) {
      return plan;
    }
  }
  throw new Error("no scenario seed found");
}

let h: Harness | null = null;
afterEach(async () => {
  await h?.stop();
  h = null;
});

const FORBIDDEN = ['"mines"', "hidden", "safeStart", "chainCaptured", "MineRelocated"];

// 3.7: the default settings, and a custom pair chosen by the creator.
const SETTINGS: readonly GameSettings[] = [
  DEFAULT_SETTINGS,
  { reshuffleInterval: 3, densityPercent: 40 },
];

describe.each(SETTINGS)("no hidden information leaks before game over (%o)", (settings) => {
  it("keeps every frame clean through relocation, explosions, a reshuffle and game end", async () => {
    const plan = findScenario(settings);
    h = await startHarness({ rng: createSeededRng(plan.seed) });
    const { a, b, ja } = await twoPlayers(h, settings);
    // 3.7: the settings are public, so they appear in the joined message and every view.
    expect(ja.settings).toEqual(settings);

    let seq = 0;
    for (const step of plan.steps) {
      const mover = step.color === "w" ? a : b;
      mover.send({
        type: "move",
        seq,
        from: step.from,
        to: step.to,
        ...(step.promo === undefined ? {} : { promo: step.promo }),
      });
      seq += 1;
      await a.next("update", (m) => m.seq === seq);
      await b.next("update", (m) => m.seq === seq);
    }

    // End the game by resignation by the side to move, unless the game ended on its own.
    const over = plan.final.public.status.kind === "over";
    if (!over) {
      (plan.final.position.turn === "w" ? a : b).send({ type: "resign" });
    }
    const goA = await a.next("game_over");
    const goB = await b.next("game_over");

    for (const client of [a, b]) {
      const idx = client.frames.findIndex((f) => f.includes('"type":"game_over"'));
      expect(idx).toBeGreaterThan(0);
      for (const frame of client.frames.slice(0, idx)) {
        for (const word of FORBIDDEN) expect(frame).not.toContain(word);
        // Every frame already passed the strict outgoing schema in the test client.
        expect(frame).not.toMatch(/"type":"game_over"/);
      }
    }

    // The full layout arrives only at the end, and it is the true layout.
    const truth = [...plan.final.hidden.mines].sort((x, y) => x - y);
    expect(goA.over.mines).toEqual(truth);
    expect(goB.over.mines).toEqual(truth);
    expect(goA.over.view.status.kind).toBe("over");
  });

  it("covers the scenario: the plan really contains each hidden-state event", () => {
    const plan = findScenario(settings);
    expect(plan.seen).toContain("MineRelocated");
    expect(plan.seen).toContain("MineTriggered");
    expect(plan.seen).toContain("Reshuffled");
  });
});
