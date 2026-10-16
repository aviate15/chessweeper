// Hidden-information boundary (design doc 3.1, 3.2, 3.4, 3.5, 3.7).
import { describe, expect, it } from "vitest";
import { START_FEN } from "../chess/fen";
import type { GameEvent } from "../mines/events";
import type { Working } from "../mines/landing";
import { relocateSafeStartMine } from "../mines/safestart";
import { createSeededRng } from "../mines/rng";
import { gameFromScenario } from "../mines/scenario";
import { createGame } from "../mines/setup";
import { eventTypes, play, sq } from "../mines/test-utils";
import { parseFen } from "../chess/fen";
import { projectEvents, toPublicView } from "./public";
import type { PublicView } from "./types";

const TOP_LEVEL_KEYS = [
  "board",
  "castling",
  "checkException",
  "craters",
  "enPassant",
  "fallen",
  "fullmoveNumber",
  "inCheck",
  "lives",
  "log",
  "mineCount",
  "revealed",
  "status",
  "turn",
  "turnsUntilReshuffle",
  "viewer",
];

/** Every object (and set) reachable from a value. */
function reachable(value: unknown, seen = new Set<object>()): Set<object> {
  if (typeof value !== "object" || value === null || seen.has(value)) return seen;
  seen.add(value);
  const children: unknown[] =
    value instanceof Set
      ? [...(value as Set<unknown>)]
      : Array.isArray(value)
        ? value
        : Object.values(value);
  for (const child of children) reachable(child, seen);
  return seen;
}

function allKeys(value: unknown, keys = new Set<string>()): Set<string> {
  if (typeof value !== "object" || value === null) return keys;
  if (Array.isArray(value)) {
    for (const item of value) allKeys(item, keys);
  } else {
    for (const [key, child] of Object.entries(value)) {
      keys.add(key);
      allKeys(child, keys);
    }
  }
  return keys;
}

describe("toPublicView", () => {
  const rich = () => {
    // Two plies from a mid-game position with a mine hit, so log, craters and numbers exist.
    const game = gameFromScenario({
      fen: "4k3/8/8/3p4/4P3/8/8/1N2K3 w - - 0 1",
      mines: ["c3", "a5"],
      revealed: ["d4"],
    });
    return play(game, "b1c3").state;
  };

  // 3.2: type-level guarantee. These lines fail to compile if the fields are ever added.
  it("has no secret fields at the type level", () => {
    const view = toPublicView(createGame({ rng: createSeededRng(1) }), null);
    // @ts-expect-error mines are never part of the view
    expect(view.mines).toBeUndefined();
    // @ts-expect-error hidden state is never part of the view
    expect(view.hidden).toBeUndefined();
    // @ts-expect-error safe-start flags are never part of the view
    expect(view.safeStart).toBeUndefined();
    // @ts-expect-error the chain-capture flag is never part of the view
    expect(view.chainCaptured).toBeUndefined();
  });

  // 3.2: exact key whitelist, so any newly added field must be reviewed here.
  it("has exactly the whitelisted keys", () => {
    const view = toPublicView(rich(), "w");
    expect(Object.keys(view).sort()).toEqual(TOP_LEVEL_KEYS);
    const keys = allKeys(view);
    for (const forbidden of ["hidden", "mines", "safeStart", "chainCaptured", "MineRelocated"]) {
      expect(keys.has(forbidden)).toBe(false);
    }
  });

  // 3.2: the view is built, never copied: nothing in it is an engine object.
  it("shares no object with the engine state", () => {
    const state = rich();
    const owned = reachable(state);
    const view = toPublicView(state, null);
    for (const object of reachable(view)) expect(owned.has(object)).toBe(false);
  });

  it("serialises to plain JSON that round-trips", () => {
    const view = toPublicView(rich(), "b");
    expect(JSON.parse(JSON.stringify(view))).toEqual(view);
  });

  // 3.2: revealed numbers are live and sorted; mine count is public but positions are not.
  it("lists live numbers, craters and the mine count", () => {
    const view = toPublicView(rich(), null);
    expect(view.craters).toEqual([sq("c3")]);
    // the knight died on c3, so only d4 is revealed
    expect(view.revealed.map((r) => r.square)).toEqual([sq("d4")]);
    expect(view.mineCount).toBe(1); // c3 was consumed; a5 is still live
    // d4 touches c3 only (consumed), so its live number is 0
    expect(view.revealed.find((r) => r.square === sq("d4"))?.number).toBe(0);
  });

  // 3.7: public countdown to the next reshuffle.
  it("reports turns until the reshuffle", () => {
    const game = gameFromScenario({ fen: START_FEN, noCaptureCount: 2 });
    expect(toPublicView(game, null).turnsUntilReshuffle).toBe(4);
  });

  // 3.7, 3.4: a check-exception chain is one turn, so the countdown stays frozen until it ends.
  it("keeps the reshuffle countdown frozen during a check-exception chain", () => {
    const game = gameFromScenario({
      fen: "b3k3/8/8/8/8/8/8/4R2K b - - 0 1",
      mines: ["e4"],
      noCaptureCount: 2,
    });
    expect(toPublicView(game, null).turnsUntilReshuffle).toBe(4);
    const chain = play(game, "a8e4").state;
    expect(chain.public.checkException).toBe("b");
    expect(toPublicView(chain, null).turnsUntilReshuffle).toBe(4);
    const done = play(chain, "e8d8").state;
    expect(done.public.checkException).toBeNull();
    expect(toPublicView(done, null).turnsUntilReshuffle).toBe(3);
  });

  it("reports the viewer, turn and check", () => {
    const check = gameFromScenario({ fen: "4k3/8/8/8/8/8/4r3/4K3 w - - 0 1" });
    const view = toPublicView(check, "w");
    expect(view.viewer).toBe("w");
    expect(view.turn).toBe("w");
    expect(view.inCheck).toBe(true);
  });

  describe("fallen pieces", () => {
    // 3.5: normal captures only lose the captured piece.
    it("records a capture", () => {
      const game = gameFromScenario({ fen: "4k3/8/8/3p4/4P3/8/8/4K3 w - - 0 1" });
      const view = toPublicView(play(game, "e4d5").state, null);
      expect(view.fallen.b).toEqual([{ piece: "p", cause: "capture" }]);
      expect(view.fallen.w).toEqual([]);
    });

    // 3.4: a piece destroyed by a mine is lost by its own side.
    it("records a piece destroyed by a mine", () => {
      const game = gameFromScenario({ fen: "4k3/8/8/8/8/8/8/1N2K3 w - - 0 1", mines: ["c3"] });
      const view = toPublicView(play(game, "b1c3").state, null);
      expect(view.fallen.w).toEqual([{ piece: "n", cause: "mine" }]);
    });

    // 3.5: en passant onto a mine: the capturer dies and the captured pawn is still removed.
    it("records both pawns when en passant lands on a mine", () => {
      const game = gameFromScenario({
        fen: "4k3/8/8/3pP3/8/8/8/4K3 w - d6 0 2",
        mines: ["d6"],
      });
      const view = toPublicView(play(game, "e5d6").state, null);
      expect(view.fallen.b).toEqual([{ piece: "p", cause: "capture" }]);
      expect(view.fallen.w).toEqual([{ piece: "p", cause: "mine" }]);
    });
  });
});

describe("projectEvents", () => {
  // 3.1: MineRelocated is server-only and never forwarded.
  it("drops MineRelocated and keeps the public events", () => {
    const game = gameFromScenario({
      fen: START_FEN,
      mines: ["e4"],
      safeStart: { w: true, b: true },
    });
    const { events } = play(game, "e2e4");
    expect(eventTypes(events)).toContain("MineRelocated");
    const projected = projectEvents(events);
    expect(projected.map((e) => e.type)).not.toContain("MineRelocated");
    expect(JSON.stringify(projected)).not.toContain("MineRelocated");
    expect(projected.length).toBe(events.length - 1);
  });

  // 3.1, 3.2: a dropped relocation changes revealed numbers, and that is public by design.
  it("still sends NumbersChanged for a dropped relocation", () => {
    const board = parseFen("4k3/8/8/8/R7/8/8/4K3 w - - 0 1").board.slice();
    const work: Working = {
      board,
      mines: new Set(),
      craters: new Set(),
      revealed: new Set([sq("a5")]),
      lives: { w: 3, b: 3 },
      events: [],
    };
    board.forEach((piece, square) => {
      if (piece === null && square !== sq("a5")) work.mines.add(square);
    });
    work.mines.add(sq("a4"));
    relocateSafeStartMine(work, sq("a4"), createSeededRng(1));
    const events: GameEvent[] = work.events;
    expect(events.map((e) => e.type)).toEqual(["MineRelocated", "NumbersChanged"]);
    expect(projectEvents(events).map((e) => e.type)).toEqual(["NumbersChanged"]);
  });

  // 3.2: events are rebuilt, not passed through, so extra fields never reach clients.
  it("rebuilds events without extra fields", () => {
    const polluted = {
      type: "TurnPassed",
      to: "b",
      mines: [1, 2, 3],
    } as unknown as GameEvent;
    expect(projectEvents([polluted])).toEqual([{ type: "TurnPassed", to: "b" }]);
  });
});

// 3.1: the move log stores public events only, so a snapshot can never replay a relocation.
describe("log in the view", () => {
  it("has no MineRelocated", () => {
    const game = gameFromScenario({
      fen: START_FEN,
      mines: ["e4"],
      safeStart: { w: true, b: true },
    });
    const view: PublicView = toPublicView(play(game, "e2e4").state, null);
    expect(JSON.stringify(view.log)).not.toContain("MineRelocated");
    expect(view.log).toHaveLength(1);
  });
});
