import { describe, expect, it } from "vitest";
import { FenError, parseFen, START_FEN, toFen } from "./fen";
import { parseSquare } from "./square";
import { PERFT_POSITIONS } from "./perft-positions";

describe("parseFen", () => {
  it("parses the start position", () => {
    const pos = parseFen(START_FEN);
    expect(pos.turn).toBe("w");
    expect(pos.castling).toEqual({ wK: true, wQ: true, bK: true, bQ: true });
    expect(pos.enPassant).toBeNull();
    expect(pos.board[parseSquare("e1") ?? -1]).toEqual({ color: "w", type: "k" });
    expect(pos.board[parseSquare("d8") ?? -1]).toEqual({ color: "b", type: "q" });
    expect(pos.board.filter((p) => p !== null)).toHaveLength(32);
  });

  it("reads the en passant square and clocks", () => {
    const pos = parseFen("rnbqkbnr/ppp1pppp/8/3pP3/8/8/PPPP1PPP/RNBQKBNR w KQkq d6 0 3");
    expect(pos.enPassant).toBe(parseSquare("d6"));
    expect(pos.halfmoveClock).toBe(0);
    expect(pos.fullmoveNumber).toBe(3);
  });

  it('defaults missing clocks to "0 1"', () => {
    const pos = parseFen("4k3/8/8/8/8/8/8/4K3 w - -");
    expect(pos.halfmoveClock).toBe(0);
    expect(pos.fullmoveNumber).toBe(1);
  });

  it.each([
    ["wrong rank count", "8/8/8/8/8/8/8 w - - 0 1"],
    ["rank too long", "4k4/8/8/8/8/8/8/4K3 w - - 0 1"],
    ["rank too short", "4k2/8/8/8/8/8/8/4K3 w - - 0 1"],
    ["bad piece letter", "4k3/8/8/8/8/8/8/4X3 w - - 0 1"],
    ["missing king", "8/8/8/8/8/8/8/4K3 w - - 0 1"],
    ["two white kings", "4k3/8/8/8/8/8/8/3KK3 w - - 0 1"],
    ["pawn on back rank", "4k3/8/8/8/8/8/8/P3K3 w - - 0 1"],
    ["bad side to move", "4k3/8/8/8/8/8/8/4K3 x - - 0 1"],
    ["bad castling", "4k3/8/8/8/8/8/8/4K3 w KX - 0 1"],
    ["en passant on wrong rank", "4k3/8/8/8/8/8/8/4K3 w - e3 0 1"],
    ["en passant not a square", "4k3/8/8/8/8/8/8/4K3 w - z9 0 1"],
    ["negative clock", "4k3/8/8/8/8/8/8/4K3 w - - -1 1"],
    ["fullmove zero", "4k3/8/8/8/8/8/8/4K3 w - - 0 0"],
    ["too few fields", "4k3/8/8/8/8/8/8/4K3 w"],
  ])("rejects %s", (_reason, fen) => {
    expect(() => parseFen(fen)).toThrow(FenError);
  });
});

describe("toFen", () => {
  it("round-trips the reference positions", () => {
    for (const { fen } of PERFT_POSITIONS) {
      const normalized = fen.split(" ").length === 4 ? `${fen} 0 1` : fen;
      expect(toFen(parseFen(fen))).toBe(normalized);
    }
  });

  it("round-trips the start position", () => {
    expect(toFen(parseFen(START_FEN))).toBe(START_FEN);
  });
});
