import type {
  Color,
  EventView,
  Flags,
  GameOverView,
  Move,
  PublicView,
  Square,
} from "@chessweeper/engine";

/**
 * What the game screen needs from a game, whether it is local pass-and-play or online.
 * Both are driven only by a PublicView and projected events.
 */
export interface GameController {
  readonly mode: "local" | "online";
  readonly view: PublicView;
  readonly gameOver: GameOverView | null;
  /** The private flags to show. */
  readonly flags: Flags;
  readonly lastEvents: readonly EventView[];
  readonly turnId: number;
  /** Online: my fixed seat. Local: null. */
  readonly seat: Color | null;
  /** May the viewer pick and play a piece right now? Local: always. */
  readonly canMove: boolean;
  /** Local pass-and-play only. */
  readonly handoffTo: Color | null;
  readonly canOfferDraw: boolean;
  /** The side whose draw offer is pending, if any. */
  readonly pendingDraw: Color | null;
  /** Online: false while my own offer is pending. */
  readonly canAnswerDraw: boolean;
  play: (move: Move) => void;
  toggleFlag: (square: Square) => void;
  resign: () => void;
  offerDraw: () => void;
  acceptDraw: () => void;
  declineDraw: () => void;
  dismissHandoff: () => void;
  /** Local: start a new game. Online: unused (the screen leaves the game instead). */
  newGame: () => void;
}
