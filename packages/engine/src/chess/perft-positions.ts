/**
 * Perft reference positions and node counts.
 *
 * Source: Chess Programming Wiki, "Perft Results"
 * https://www.chessprogramming.org/Perft_Results (fetched 2026-10-16).
 * Numbers are copied from that page, not from memory. `nodes[d - 1]` is perft(d).
 * Test data only; not exported from the engine package.
 */
export interface PerftPosition {
  readonly name: string;
  readonly fen: string;
  readonly nodes: readonly number[];
}

export const PERFT_POSITIONS: readonly PerftPosition[] = [
  {
    name: "Initial position",
    fen: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
    nodes: [20, 400, 8_902, 197_281, 4_865_609, 119_060_324],
  },
  {
    name: "Position 2 (Kiwipete)",
    fen: "r3k2r/p1ppqpb1/bn2pnp1/3PN3/1p2P3/2N2Q1p/PPPBBPPP/R3K2R w KQkq -",
    nodes: [48, 2_039, 97_862, 4_085_603, 193_690_690],
  },
  {
    name: "Position 3",
    fen: "8/2p5/3p4/KP5r/1R3p1k/8/4P1P1/8 w - - 0 1",
    nodes: [14, 191, 2_812, 43_238, 674_624, 11_030_083],
  },
  {
    name: "Position 4",
    fen: "r3k2r/Pppp1ppp/1b3nbN/nP6/BBP1P3/q4N2/Pp1P2PP/R2Q1RK1 w kq - 0 1",
    nodes: [6, 264, 9_467, 422_333, 15_833_292],
  },
  {
    name: "Position 4 (mirrored)",
    fen: "r2q1rk1/pP1p2pp/Q4n2/bbp1p3/Np6/1B3NBn/pPPP1PPP/R3K2R b KQ - 0 1",
    nodes: [6, 264, 9_467, 422_333, 15_833_292],
  },
  {
    name: "Position 5",
    fen: "rnbq1k1r/pp1Pbppp/2p5/8/2B5/8/PPP1NnPP/RNBQK2R w KQ - 1 8",
    nodes: [44, 1_486, 62_379, 2_103_487, 89_941_194],
  },
  {
    name: "Position 6",
    fen: "r4rk1/1pp1qppp/p1np1n2/2b1p1B1/2B1P1b1/P1NP1N2/1PP1QPPP/R4RK1 w - - 0 10",
    nodes: [46, 2_079, 89_890, 3_894_594, 164_075_551],
  },
];
