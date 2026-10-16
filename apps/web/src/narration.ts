import {
  squareName,
  type Color,
  type EventView,
  type GameOverReason,
  type GameResult,
  type PieceType,
  type PublicView,
  type Square,
} from "@chessweeper/engine";

export const COLOR_NAME: Record<Color, string> = { w: "White", b: "Black" };

export const PIECE_NAME: Record<PieceType, string> = {
  p: "pawn",
  n: "knight",
  b: "bishop",
  r: "rook",
  q: "queen",
  k: "king",
};

export function resultText(result: GameResult): string {
  if (result === "draw") return "Draw";
  return `${COLOR_NAME[result]} wins`;
}

export const REASON_TEXT: Record<GameOverReason, string> = {
  "king-lives": "a king lost its last life",
  checkmate: "checkmate",
  stalemate: "stalemate",
  resignation: "resignation",
  agreement: "agreement",
  abandonment: "abandonment",
};

/** Public events of one move as plain English for the status bar and Moves dialog (UI decision 13). */
export function narrate(events: readonly EventView[]): string {
  const parts: string[] = [];
  for (const e of events) {
    switch (e.type) {
      case "MoveMade": {
        const m = e.move;
        const hitMine = events.some(
          (x) => (x.type === "MineTriggered" || x.type === "BigMineBlasted") && x.square === m.to,
        );
        const who = `${COLOR_NAME[e.color]}'s ${PIECE_NAME[m.piece]}`;
        if (m.castle !== null) parts.push(`${COLOR_NAME[e.color]} castled ${m.castle}side`);
        else if (hitMine) break;
        else if (m.captured !== null) {
          const suffix = m.promotion !== null ? ` and promoted to ${PIECE_NAME[m.promotion]}` : "";
          parts.push(
            `${who} captured a ${PIECE_NAME[m.captured]} on ${squareName(m.captureSquare ?? m.to)}${suffix}`,
          );
        } else {
          const suffix = m.promotion !== null ? ` and promoted to ${PIECE_NAME[m.promotion]}` : "";
          parts.push(`${who} moved to ${squareName(m.to)}${suffix}`);
        }
        break;
      }
      case "MineTriggered": {
        const destroyed = events.some((x) => x.type === "PieceDestroyed" && x.square === e.square);
        parts.push(
          `${COLOR_NAME[e.by.color]}'s ${PIECE_NAME[e.by.type]} hit a mine on ${squareName(e.square)}` +
            (destroyed ? " and was destroyed" : ""),
        );
        break;
      }
      case "BigMineBlasted":
        parts.push(
          `${COLOR_NAME[e.by.color]}'s ${PIECE_NAME[e.by.type]} set off a big mine on ${squareName(e.square)}`,
        );
        break;
      case "PlacementStarted":
        parts.push("Mines cleared. Both players place new mines");
        break;
      case "LifeLost":
        parts.push(`${COLOR_NAME[e.color]}'s king lost a life (${String(e.livesLeft)} left)`);
        break;
      case "CheckExceptionTriggered":
        parts.push(`${COLOR_NAME[e.color]} is in check after the explosion and must move again`);
        break;
      case "Reshuffled":
        parts.push(`Mines reshuffled (${String(e.mineCount)} mines)`);
        break;
      case "GameOver":
        parts.push(`${resultText(e.result)} by ${REASON_TEXT[e.reason]}`);
        break;
      case "PieceCaptured":
      case "PieceDestroyed":
      case "NumberRevealed":
      case "NumbersChanged":
      case "TurnPassed":
      case "PlayerReady":
      case "PlacementEnded":
        break;
    }
  }
  return parts.join(". ");
}

export interface RevealSource {
  readonly color: Color;
  readonly piece: PieceType;
}

/** Rook destination of a castling move: f/d file on the mover's back rank. */
function castleRookSquare(color: Color, side: "king" | "queen"): Square {
  const base = color === "w" ? 0 : 56;
  return base + (side === "king" ? 5 : 3);
}

/**
 * Which piece landed on `square` to reveal its current number, from the public log only. Walks
 * back to the last reshuffle (a reshuffle re-hides every number, so older reveals are gone) and
 * returns null when the reveal is unknown.
 */
export function revealSource(view: PublicView, square: Square): RevealSource | null {
  for (let i = view.log.length - 1; i >= 0; i--) {
    const entry = view.log[i];
    if (!entry) continue;
    for (let j = entry.events.length - 1; j >= 0; j--) {
      const e = entry.events[j];
      if (e?.type === "Reshuffled") return null;
      if (e?.type !== "NumberRevealed" || e.square !== square) continue;
      for (let k = entry.events.length - 1; k >= 0; k--) {
        const m = entry.events[k];
        if (m?.type !== "MoveMade") continue;
        const move = m.move;
        if (move.castle !== null && castleRookSquare(m.color, move.castle) === square) {
          return { color: m.color, piece: "r" };
        }
        if (move.to === square) {
          return { color: m.color, piece: move.promotion ?? move.piece };
        }
      }
      return null;
    }
  }
  return null;
}

/** Tooltip / status text for a revealed number or a crater; null for a hidden square. */
export function numberDescription(
  number: number | null,
  crater: boolean,
  source: RevealSource | null,
): string | null {
  if (number === null && !crater) return null;
  const parts: string[] = [];
  if (crater) parts.push("A mine blew up here and left a crater.");
  if (number !== null) {
    parts.push(
      number === 0
        ? "No mines among the 8 neighbouring squares."
        : `${String(number)} ${number === 1 ? "mine" : "mines"} among the 8 neighbouring squares.`,
    );
    if (source) {
      parts.push(
        `Revealed when ${COLOR_NAME[source.color]}'s ${PIECE_NAME[source.piece]} landed here.`,
      );
    }
  }
  return parts.join(" ");
}

/** Tooltip text for one square of the public view, or null when nothing is revealed there. */
export function describeSquare(view: PublicView, square: Square): string | null {
  const number = view.revealed.find((r) => r.square === square)?.number ?? null;
  const crater = view.craters.includes(square);
  if (number === null && !crater) return null;
  return numberDescription(number, crater, number === null ? null : revealSource(view, square));
}
