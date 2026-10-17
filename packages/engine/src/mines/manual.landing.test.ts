// 3.10 Manual mine mode: stacked (big) mines, numbers and the 3x3 blast.
import { describe, expect, it } from "vitest";
import { START_FEN } from "../chess/fen";
import { DEFAULT_CONFIG } from "./config";
import { liveMineCount, mineWeight, revealedNumbers } from "./numbers";
import { gameFromScenario, type Scenario } from "./scenario";
import { eventTypes, play, sq } from "./test-utils";

const MANUAL = { ...DEFAULT_CONFIG, mode: "manual" as const, reshuffleInterval: 10 };
const manual = (scenario: Omit<Scenario, "config">) =>
  gameFromScenario({ ...scenario, config: MANUAL });

/** The 9 squares around (and including) a centre, by name. */
const AREA_F3 = ["e2", "f2", "g2", "e3", "f3", "g3", "e4", "f4", "g4"];

describe("3.10 big mines in numbers and the live mine count", () => {
  const game = manual({
    fen: "4k3/8/8/8/8/8/8/4K3 w - - 0 1",
    owned: { w: ["e4", "a1"], b: ["e4", "c5"] },
    revealed: ["e5", "b2"],
  });

  it("a stacked square is a big mine: weight 2; single mines weigh 1; empty 0", () => {
    expect(mineWeight(game.hidden, sq("e4"))).toBe(2);
    expect(mineWeight(game.hidden, sq("a1"))).toBe(1);
    expect(mineWeight(game.hidden, sq("c5"))).toBe(1);
    expect(mineWeight(game.hidden, sq("h8"))).toBe(0);
  });

  it("a big mine counts 2 in a neighbouring number (and singles 1)", () => {
    const numbers = revealedNumbers(game);
    expect(numbers.get(sq("e5"))).toBe(2); // e4 big
    expect(numbers.get(sq("b2"))).toBe(1); // a1 single (c5 is out of range)
  });

  it("a big mine counts 2 in the live mine count", () => {
    // squares e4 (x2), a1, c5: 3 distinct squares, 4 mines.
    expect(game.hidden.mines.size).toBe(3);
    expect(liveMineCount(game)).toBe(4);
  });

  it("two single mines of different placers on different squares still count 1 each", () => {
    const two = manual({ fen: "4k3/8/8/8/8/8/8/4K3 w - - 0 1", owned: { w: ["a3"], b: ["a4"] } });
    expect(liveMineCount(two)).toBe(2);
  });
});

describe("3.10 big mine blast", () => {
  // White knight g1-f3 lands on a big mine; a white pawn (e2) and a black pawn (g4) are in
  // the 3x3 area. A second big mine (e3) and a single mine (f4) are inside the area; a third
  // big mine (h7) is outside it. The black pawn is a piece, so it carries no mine.
  const fen = "4k3/8/8/8/6p1/8/4P3/4K1N1 w - - 0 1";
  const start = () =>
    manual({
      fen,
      owned: { w: ["f3", "e3", "h7"], b: ["f3", "e3", "h7", "f4"] },
      revealed: ["f5", "a1"],
    });

  it("destroys every non-king piece in the area, both sides' and the mover's own", () => {
    const { state, events } = play(start(), "g1f3");
    const board = state.position.board;
    expect(board[sq("f3")]).toBeNull(); // the mover's piece
    expect(board[sq("e2")]).toBeNull(); // a pawn of the mover's side
    expect(board[sq("g4")]).toBeNull(); // the opponent's pawn
    const destroyed = events.filter((e) => e.type === "PieceDestroyed").map((e) => e.square);
    expect(destroyed.sort()).toEqual([sq("e2"), sq("f3"), sq("g4")].sort());
  });

  it("is one BigMineBlasted event with the area; no single-mine MineTriggered", () => {
    const { events } = play(start(), "g1f3");
    const blasts = events.filter((e) => e.type === "BigMineBlasted");
    expect(blasts).toHaveLength(1);
    const blast = blasts[0];
    if (blast?.type !== "BigMineBlasted") throw new Error("no blast");
    expect(blast.square).toBe(sq("f3"));
    expect(blast.by).toEqual({ color: "w", type: "n" });
    expect([...blast.area].sort((a, b) => a - b)).toEqual(AREA_F3.map(sq).sort((a, b) => a - b));
    expect(eventTypes(events)).not.toContain("MineTriggered");
  });

  it("turns every area square into a crater and consumes every mine in it", () => {
    const { state } = play(start(), "g1f3");
    expect([...state.public.craters].sort((a, b) => a - b)).toEqual(
      AREA_F3.map(sq).sort((a, b) => a - b),
    );
    for (const name of AREA_F3) expect(state.hidden.mines.has(sq(name))).toBe(false);
    expect(state.hidden.owned?.w.has(sq("f4"))).toBe(false);
    expect(state.hidden.owned?.b.has(sq("f4"))).toBe(false);
  });

  it("does not chain: a second big mine in the area is consumed, not blasted", () => {
    const { state, events } = play(start(), "g1f3");
    expect(events.filter((e) => e.type === "BigMineBlasted")).toHaveLength(1);
    // e3 (big) was consumed; the big mine outside the area (h7) is untouched, no crater.
    expect(state.hidden.mines.has(sq("e3"))).toBe(false);
    expect(state.hidden.mines.has(sq("h7"))).toBe(true);
    expect(mineWeight(state.hidden, sq("h7"))).toBe(2);
    expect(state.public.craters.has(sq("h7"))).toBe(false);
  });

  it("keeps revealed numbers live: neighbours of consumed mines update", () => {
    const { state, events } = play(start(), "g1f3");
    const changed = events.find((e) => e.type === "NumbersChanged");
    if (changed?.type !== "NumbersChanged") throw new Error("no NumbersChanged");
    expect(changed.updates).toContainEqual({ square: sq("f5"), number: 0 }); // f4 single gone
    expect(revealedNumbers(state).get(sq("f5"))).toBe(0);
  });

  it("reveals nothing for pieces caught in the area or a destroyed lander", () => {
    const { state, events } = play(start(), "g1f3");
    expect(eventTypes(events)).not.toContain("NumberRevealed");
    for (const name of AREA_F3) expect(state.public.revealed.has(sq(name))).toBe(false);
  });

  it("is a normal turn: play passes to the opponent", () => {
    const { state } = play(start(), "g1f3");
    expect(state.position.turn).toBe("b");
    expect(state.public.checkException).toBeNull();
    expect(state.public.status.kind).toBe("ongoing");
  });

  it("is a single owned-by-both mine for a capture-free landing, never under a piece", () => {
    // 3.5: captures never meet a mine, so a scenario cannot put a mine under a piece.
    expect(() => manual({ fen, owned: { w: ["g4"], b: ["g4"] } })).toThrow();
  });
});

describe("3.10 kings in a blast", () => {
  it("every king in the area loses exactly one life and stays; a rook lander dies", () => {
    const game = manual({
      fen: "8/8/8/4k3/8/2K5/8/3R4 w - - 0 1",
      owned: { w: ["d4"], b: ["d4"] },
    });
    const { state, events } = play(game, "d1d4");
    expect(state.public.lives).toEqual({ w: 2, b: 2 });
    expect(state.position.board[sq("c3")]).toEqual({ color: "w", type: "k" });
    expect(state.position.board[sq("e5")]).toEqual({ color: "b", type: "k" });
    expect(state.position.board[sq("d4")]).toBeNull();
    expect(events.filter((e) => e.type === "LifeLost")).toHaveLength(2);
    expect(state.public.status.kind).toBe("ongoing");
  });

  it("a king that lands on a big mine loses exactly one life, stays and reveals", () => {
    const game = manual({
      fen: "4k3/8/8/8/8/8/8/4K3 w - - 0 1",
      owned: { w: ["e2"], b: ["e2"] },
    });
    const { state, events } = play(game, "e1e2");
    expect(state.public.lives).toEqual({ w: 2, b: 3 });
    expect(state.position.board[sq("e2")]).toEqual({ color: "w", type: "k" });
    expect(state.public.revealed.has(sq("e2"))).toBe(true);
    expect(eventTypes(events)).toContain("NumberRevealed");
    expect(state.public.craters.size).toBe(9);
  });

  it("when both kings lose their last life, the mover loses", () => {
    const game = manual({
      fen: "8/8/8/4k3/8/2K5/8/3R4 w - - 0 1",
      owned: { w: ["d4"], b: ["d4"] },
      lives: { w: 1, b: 1 },
    });
    const { state, events } = play(game, "d1d4");
    expect(state.public.status).toEqual({ kind: "over", result: "b", reason: "king-lives" });
    expect(eventTypes(events)).toContain("GameOver");
  });

  it("when only the opponent's king dies, the mover wins", () => {
    const game = manual({
      fen: "8/8/8/4k3/8/2K5/8/3R4 w - - 0 1",
      owned: { w: ["d4"], b: ["d4"] },
      lives: { w: 3, b: 1 },
    });
    const { state } = play(game, "d1d4");
    expect(state.public.status).toEqual({ kind: "over", result: "w", reason: "king-lives" });
  });

  it("when only the mover's king dies, the mover loses", () => {
    const game = manual({
      fen: "8/8/8/4k3/8/2K5/8/3R4 w - - 0 1",
      owned: { w: ["d4"], b: ["d4"] },
      lives: { w: 1, b: 3 },
    });
    const { state } = play(game, "d1d4");
    expect(state.public.status).toEqual({ kind: "over", result: "b", reason: "king-lives" });
  });
});

describe("3.10 turn after a blast", () => {
  it("check exception: the blast destroys the mover's blocker and exposes the mover's king", () => {
    // The e2 pawn shields the white king from the rook on e8; the knight's blast removes it.
    const game = manual({
      fen: "4r2k/8/8/8/8/8/4P3/4K1N1 w - - 0 1",
      owned: { w: ["f3"], b: ["f3"] },
    });
    const { state, events } = play(game, "g1f3");
    expect(state.position.board[sq("e2")]).toBeNull();
    expect(state.public.checkException).toBe("w");
    expect(state.position.turn).toBe("w");
    expect(eventTypes(events)).toContain("CheckExceptionTriggered");
    expect(eventTypes(events)).not.toContain("TurnPassed");
  });

  it("a blast that leaves the opponent in check is ordinary check; the turn passes", () => {
    // The black pawn on e3 shields the black king from the rook on e1; the blast removes it.
    const game = manual({
      fen: "8/8/8/4k3/8/4p3/8/4R1NK w - - 0 1",
      owned: { w: ["f3"], b: ["f3"] },
    });
    const { state } = play(game, "g1f3");
    expect(state.position.board[sq("e3")]).toBeNull();
    expect(state.public.checkException).toBeNull();
    expect(state.position.turn).toBe("b");
  });

  it("checkmate is judged for the opponent on the board the blast left", () => {
    // Black bishop f8 and pawn g7 shield the king on h8 from the rook on a8 and the bishop
    // on b2. The knight h6-f7 lands on the big mine: the blast destroys f8, g7 and the knight,
    // leaving the king in check from both with no flight square: mate, the mover wins.
    const game = manual({
      fen: "R4b1k/6pp/7N/8/8/8/1B6/6K1 w - - 0 1",
      owned: { w: ["f7"], b: ["f7"] },
    });
    const { state } = play(game, "h6f7");
    expect(state.position.board[sq("f8")]).toBeNull();
    expect(state.position.board[sq("g7")]).toBeNull();
    expect(state.public.status).toEqual({ kind: "over", result: "w", reason: "checkmate" });
  });
});

describe("3.10 blast kills are not captures", () => {
  it("the no-capture counter keeps counting after a blast that killed enemy pieces", () => {
    const game = manual({
      fen: "4k3/8/8/8/6p1/8/4P3/4K1N1 w - - 0 1",
      owned: { w: ["f3"], b: ["f3"] },
      noCaptureCount: 3,
    });
    const { state } = play(game, "g1f3");
    expect(state.public.noCaptureCount).toBe(4);
  });

  it("an ordinary capture does not reset it in Manual mode (fixed cadence)", () => {
    const game = manual({
      fen: "4k3/8/8/3p4/4P3/8/8/4K3 w - - 0 1",
      owned: { w: ["a3"], b: ["a3"] },
      noCaptureCount: 3,
    });
    const { state } = play(game, "e4d5");
    expect(state.public.noCaptureCount).toBe(4);
  });
});

describe("3.10 castling with a big mine", () => {
  it("kingside: the king's blast destroys the rook on h1, so the rook move does not happen", () => {
    const game = manual({
      fen: "4k3/8/8/8/8/8/8/4K2R w K - 0 1",
      owned: { w: ["g1"], b: ["g1"] },
    });
    const { state } = play(game, "e1g1");
    expect(state.position.board[sq("g1")]).toEqual({ color: "w", type: "k" });
    expect(state.position.board[sq("h1")]).toBeNull();
    expect(state.position.board[sq("f1")]).toBeNull(); // the rook never arrived
    expect(state.public.lives.w).toBe(2); // exactly one life
    expect(state.public.revealed.has(sq("g1"))).toBe(true); // surviving landing king reveals
    expect(state.public.revealed.has(sq("f1"))).toBe(false);
  });

  it("queenside: the rook starts outside the blast, then lands on the new crater safely", () => {
    const game = manual({
      fen: "4k3/8/8/8/8/8/8/R3K3 w Q - 0 1",
      owned: { w: ["c1"], b: ["c1"] },
    });
    const { state } = play(game, "e1c1");
    expect(state.position.board[sq("c1")]).toEqual({ color: "w", type: "k" });
    expect(state.position.board[sq("d1")]).toEqual({ color: "w", type: "r" });
    expect(state.position.board[sq("a1")]).toBeNull();
    expect(state.public.craters.has(sq("d1"))).toBe(true);
    expect(state.public.revealed.has(sq("d1"))).toBe(true); // a surviving landing reveals
  });

  it("a rook landing on a big mine blasts like any piece", () => {
    const game = manual({
      fen: "4k3/8/8/8/8/8/8/R3K3 w Q - 0 1",
      owned: { w: ["d1"], b: ["d1"] },
    });
    const { state, events } = play(game, "e1c1");
    expect(events.filter((e) => e.type === "BigMineBlasted")).toHaveLength(1);
    expect(state.position.board[sq("d1")]).toBeNull(); // the rook died on its landing
    expect(state.position.board[sq("c1")]).toEqual({ color: "w", type: "k" }); // king caught
    expect(state.public.lives.w).toBe(2);
  });
});

describe("3.10 en passant with a big mine", () => {
  it("the captured pawn is removed first, then the capturer's landing blasts", () => {
    const start = manual({
      fen: "4k3/3p4/8/4P3/8/8/8/4K3 b - - 0 1",
      owned: { w: ["d6"], b: ["d6"] },
      noCaptureCount: 3,
    });
    const afterPush = play(start, "d7d5").state;
    expect(afterPush.position.enPassant).toBe(sq("d6"));
    const { state, events } = play(afterPush, "e5d6");
    const types = eventTypes(events);
    expect(types.indexOf("PieceCaptured")).toBeLessThan(types.indexOf("BigMineBlasted"));
    expect(state.position.board[sq("d5")]).toBeNull(); // captured pawn
    expect(state.position.board[sq("d6")]).toBeNull(); // capturer died in the blast
    expect(state.public.craters.has(sq("d6"))).toBe(true);
    // 3.10: Manual mode counts every turn, captures included.
    expect(state.public.noCaptureCount).toBe(5);
  });
});

describe("3.10 single mines and auto mode are unchanged", () => {
  it("a single mine in manual mode behaves as in 3.4, whoever placed it", () => {
    const game = manual({ fen: START_FEN, owned: { w: ["e4"] } });
    const { state, events } = play(game, "e2e4");
    expect(state.position.board[sq("e4")]).toBeNull();
    expect(eventTypes(events)).toContain("MineTriggered");
    expect(eventTypes(events)).not.toContain("BigMineBlasted");
    expect(state.public.craters.has(sq("e4"))).toBe(true);
    expect(state.public.craters.size).toBe(1);
  });

  it("an owned-by-black single mine hurts black too", () => {
    const game = manual({ fen: "4k3/8/8/8/8/8/8/4K3 b - - 0 1", owned: { b: ["e7"] } });
    const { state } = play(game, "e8e7");
    expect(state.public.lives.b).toBe(2);
  });
});
