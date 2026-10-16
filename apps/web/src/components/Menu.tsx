export interface MenuProps {
  gameOver: boolean;
  canOfferDraw: boolean;
  onNewGame: () => void;
  onMoves: () => void;
  onResign: () => void;
  onOfferDraw: () => void;
}

export function Menu(props: MenuProps) {
  return (
    <nav className="menu" aria-label="Game menu">
      <button type="button" onClick={props.onNewGame}>
        New game
      </button>
      <button type="button" onClick={props.onMoves}>
        Moves
      </button>
      <button type="button" disabled={props.gameOver} onClick={props.onResign}>
        Resign
      </button>
      <button
        type="button"
        disabled={props.gameOver || !props.canOfferDraw}
        onClick={props.onOfferDraw}
      >
        Offer draw
      </button>
    </nav>
  );
}
