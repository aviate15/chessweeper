// 3.8 step 1: legality ignores mines. This milestone has no mines at all, so these tests
// pin down plain chess legality, which the mine pipeline will reuse unchanged.
// 3.5: castling, en passant and promotion follow standard chess rules.
import { describe, expect, it } from "vitest";
import { parseFen, START_FEN } from "./fen";
import { moveToUci } from "./move";
import { legalMoves } from "./movegen";

function uci(fen: string): string[] {
  return legalMoves(parseFen(fen)).map(moveToUci).sort();
}

describe("legalMoves", () => {
  it("finds the 20 opening moves", () => {
    expect(legalMoves(parseFen(START_FEN))).toHaveLength(20);
  });

  it("only lets a pinned piece move along the pin line", () => {
    // Bishop e2 is pinned on the e-file: it has no legal moves at all.
    expect(uci("4k3/4r3/8/8/8/8/4B3/4K3 w - - 0 1").filter((m) => m.startsWith("e2"))).toEqual([]);
    // Rook e2 is pinned too, but can slide along the e-file, including capturing the pinner.
    expect(uci("4k3/4r3/8/8/8/8/4R3/4K3 w - - 0 1").filter((m) => m.startsWith("e2"))).toEqual([
      "e2e3",
      "e2e4",
      "e2e5",
      "e2e6",
      "e2e7",
    ]);
  });

  it("allows only king moves in double check", () => {
    // Rook a1 and bishop b4 both check the king on e1; the queen cannot help.
    const moves = legalMoves(parseFen("4k3/8/8/8/1b5Q/8/8/r3K3 w - - 0 1"));
    expect(moves.map(moveToUci).sort()).toEqual(["e1e2", "e1f2"]);
    expect(moves.every((m) => m.piece === "k")).toBe(true);
  });

  it("castles both ways when the path is clear and safe", () => {
    const moves = uci("r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1");
    expect(moves).toContain("e1g1");
    expect(moves).toContain("e1c1");
  });

  it("does not castle out of check", () => {
    const moves = uci("4k3/4r3/8/8/8/8/8/R3K2R w KQ - 0 1");
    expect(moves).not.toContain("e1g1");
    expect(moves).not.toContain("e1c1");
  });

  it("does not castle through an attacked square", () => {
    const moves = uci("4kr2/8/8/8/8/8/8/R3K2R w KQ - 0 1");
    expect(moves).not.toContain("e1g1");
    expect(moves).toContain("e1c1");
  });

  it("does not castle into check", () => {
    expect(uci("4k1r1/8/8/8/8/8/8/R3K2R w KQ - 0 1")).not.toContain("e1g1");
  });

  it("allows queenside castling when only b1 (crossed by the rook, not the king) is attacked", () => {
    expect(uci("1r2k3/8/8/8/8/8/8/R3K2R w KQ - 0 1")).toContain("e1c1");
  });

  it("does not castle through a piece or without the right", () => {
    expect(uci("4k3/8/8/8/8/8/8/RN2K2R w KQ - 0 1")).not.toContain("e1c1");
    expect(uci("4k3/8/8/8/8/8/8/R3K2R w Q - 0 1")).not.toContain("e1g1");
  });

  it("produces castling moves flagged for the mine pipeline", () => {
    const castle = legalMoves(parseFen("r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1")).find(
      (m) => moveToUci(m) === "e1g1",
    );
    expect(castle?.castle).toBe("king");
    expect(castle?.piece).toBe("k");
  });

  it("captures en passant, flagging the captured pawn's square", () => {
    const ep = legalMoves(parseFen("4k3/8/8/3pP3/8/8/8/4K3 w - d6 0 2")).find(
      (m) => moveToUci(m) === "e5d6",
    );
    expect(ep?.enPassant).toBe(true);
    expect(ep?.captured).toBe("p");
    expect(ep?.captureSquare).not.toBe(ep?.to);
  });

  it("forbids en passant when it would expose the king along the rank", () => {
    // Taking on c6 removes both c5 and d5 from rank 5, so rook h5 would hit king a5.
    expect(uci("8/8/8/K1pP3r/8/8/8/7k w - c6 0 1")).not.toContain("d5c6");
  });

  it("generates four promotions per pawn move", () => {
    expect(uci("4k3/P7/8/8/8/8/8/4K3 w - - 0 1").filter((m) => m.startsWith("a7"))).toEqual([
      "a7a8b",
      "a7a8n",
      "a7a8q",
      "a7a8r",
    ]);
    expect(uci("1n2k3/P7/8/8/8/8/8/4K3 w - - 0 1").filter((m) => m.startsWith("a7"))).toHaveLength(
      8,
    );
  });

  it("flags double pawn pushes", () => {
    const e4 = legalMoves(parseFen(START_FEN)).find((m) => moveToUci(m) === "e2e4");
    expect(e4?.doublePush).toBe(true);
  });
});
