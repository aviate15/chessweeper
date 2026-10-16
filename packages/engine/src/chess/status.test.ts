import { describe, expect, it } from "vitest";
import { parseFen, START_FEN } from "./fen";
import { gameStatus } from "./status";

describe("gameStatus", () => {
  it("is ongoing at the start", () => {
    expect(gameStatus(parseFen(START_FEN))).toBe("ongoing");
  });

  // 3.6 checkmate is judged by standard chess rules (mines are ignored).
  it("detects checkmate (Fool's mate)", () => {
    const foolsMate = "rnb1kbnr/pppp1ppp/8/4p3/6Pq/5P2/PPPPP2P/RNBQKBNR w KQkq - 1 3";
    expect(gameStatus(parseFen(foolsMate))).toBe("checkmate");
  });

  // 3.6 checkmate: in check with no chess-legal move.
  it("detects back-rank mate", () => {
    expect(gameStatus(parseFen("3R2k1/5ppp/8/8/8/8/8/6K1 b - - 0 1"))).toBe("checkmate");
  });

  // 3.6 stalemate is a draw, as in normal chess.
  it("detects stalemate", () => {
    expect(gameStatus(parseFen("7k/5Q2/6K1/8/8/8/8/8 b - - 0 1"))).toBe("stalemate");
  });

  // 3.6 a king is only checkmated when it has no chess-legal move at all.
  it("is not checkmate when the king can escape", () => {
    expect(gameStatus(parseFen("3R2k1/5pp1/8/8/8/8/8/6K1 b - - 0 1"))).toBe("ongoing");
  });

  // 3.6: no insufficient-material draw, so bare kings keep playing.
  it("keeps bare kings ongoing", () => {
    expect(gameStatus(parseFen("4k3/8/8/8/8/8/8/4K3 w - - 0 1"))).toBe("ongoing");
  });
});
