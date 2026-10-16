import {
  squareName,
  type Color,
  type EventView,
  type GameOverReason,
  type GameResult,
  type PieceType,
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
        const hitMine = events.some((x) => x.type === "MineTriggered" && x.square === m.to);
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
        break;
    }
  }
  return parts.join(". ");
}
