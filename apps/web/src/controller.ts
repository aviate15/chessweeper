import type { Color, GameConfig, EventView, Flags, Move, Square } from "@chessweeper/engine";
import type { GameOverWithOwned, PlacementView } from "./components/placementTypes";

/** Manual mine mode (3.10): what the placement screen needs besides the view. */
export interface PlacementControl {
  /** Whose mines are being placed (online: my seat; local: White first, then Black). */
  readonly color: Color;
  /** Milliseconds left in the round, or null when there is no timer (local play). */
  readonly msLeft: number | null;
}

/**
 * What the game screen needs from a game, whether it is local pass-and-play or online.
 * Both are driven only by a PublicView and projected events.
 */
export interface GameController {
  readonly mode: "local" | "online";
  /** PlacementView is the public view plus `phase` and `placement` (3.10). */
  readonly view: PlacementView;
  readonly gameOver: GameOverWithOwned | null;
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
  /** Non-null while a placement round is under way and this client may place. */
  readonly placement: PlacementControl | null;
  /** Mines placed at random for the player to move (local) or for me (online); null if none. */
  readonly autoPlaced: number | null;
  /** Local pass-and-play: the handoff is to a player who places mines next, not to move. */
  readonly handoffPlacing: boolean;
  play: (move: Move) => void;
  togglePlacement: (square: Square) => void;
  donePlacement: () => void;
  toggleFlag: (square: Square) => void;
  resign: () => void;
  offerDraw: () => void;
  acceptDraw: () => void;
  declineDraw: () => void;
  dismissHandoff: () => void;
  /** Local: start a new game. Online: unused (the screen leaves the game instead). */
  newGame: (config?: GameConfig) => void;
}
