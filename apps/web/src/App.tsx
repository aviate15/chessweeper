import {
  destinationsFrom,
  legalMovesFromView,
  opponent,
  type Move,
  type PromotionPiece,
  type Rng,
  type Square,
} from "@chessweeper/engine";
import { useState } from "react";
import { Board } from "./components/Board";
import { Counters } from "./components/Counters";
import { FlagToggle } from "./components/FlagToggle";
import { GameOverDialog } from "./components/GameOverDialog";
import { HandoffScreen } from "./components/HandoffScreen";
import { Menu } from "./components/Menu";
import { MovesDialog } from "./components/MovesDialog";
import { PromotionPicker } from "./components/PromotionPicker";
import { StatusBar } from "./components/StatusBar";
import { canOffer } from "./drawOffers";
import { COLOR_NAME } from "./narration";
import { useLocalGame } from "./useLocalGame";

export function App({ rng }: { rng?: Rng }) {
  const game = useLocalGame(rng ? { rng } : {});
  const { view, gameOver } = game;
  const [selected, setSelected] = useState<Square | null>(null);
  const [promotion, setPromotion] = useState<{ from: Square; to: Square } | null>(null);
  const [flagMode, setFlagMode] = useState(false);
  const [showMoves, setShowMoves] = useState(false);
  const [dismissedOver, setDismissedOver] = useState(false);

  const over = view.status.kind === "over";
  const destinations = selected === null || over ? [] : destinationsFrom(view, selected);

  const attempt = (move: Move) => {
    setSelected(null);
    setPromotion(null);
    game.play(move);
  };

  const onSquareClick = (square: Square) => {
    if (over) return;
    if (flagMode) {
      game.toggleFlag(square);
      return;
    }
    if (selected !== null && destinations.includes(square)) {
      const candidates = legalMovesFromView(view).filter(
        (m) => m.from === selected && m.to === square,
      );
      const first = candidates[0];
      if (first === undefined) return;
      if (candidates.length > 1 && first.promotion !== null) {
        setPromotion({ from: selected, to: square });
        return;
      }
      attempt(first);
      return;
    }
    const piece = view.board[square];
    setSelected(piece?.color === view.turn && selected !== square ? square : null);
  };

  const onPromote = (piece: PromotionPiece) => {
    if (promotion === null) return;
    const move = legalMovesFromView(view).find(
      (m) => m.from === promotion.from && m.to === promotion.to && m.promotion === piece,
    );
    if (move) attempt(move);
  };

  const newGame = () => {
    game.newGame();
    setSelected(null);
    setPromotion(null);
    setDismissedOver(false);
    setShowMoves(false);
  };

  if (game.handoffTo !== null) {
    return (
      <main className="app">
        <HandoffScreen
          to={game.handoffTo}
          onReady={() => {
            setSelected(null);
            game.dismissHandoff();
          }}
        />
      </main>
    );
  }

  const pending = game.offers.pending;
  return (
    <main className="app">
      <h1 className="title">Chessweeper</h1>
      <Menu
        gameOver={over}
        canOfferDraw={canOffer(game.offers, view.turn)}
        onNewGame={newGame}
        onMoves={() => {
          setShowMoves(true);
        }}
        onResign={game.resign}
        onOfferDraw={game.offerDraw}
      />
      <Counters view={view} />
      <div className="play-area">
        <Board
          view={view}
          flags={game.flags}
          selected={selected}
          destinations={destinations}
          mines={gameOver?.mines ?? []}
          onSquareClick={onSquareClick}
          onSquareFlag={(sq) => {
            if (!over) game.toggleFlag(sq);
          }}
        />
        <FlagToggle
          on={flagMode}
          onToggle={() => {
            setFlagMode((v) => !v);
          }}
        />
      </div>
      <StatusBar view={view} />
      {pending !== null && !over && (
        <div className="draw-offer" role="alert">
          {COLOR_NAME[pending]} offers a draw. {COLOR_NAME[opponent(pending)]}:
          <button type="button" onClick={game.acceptDraw}>
            Accept draw
          </button>
          <button type="button" onClick={game.declineDraw}>
            Decline draw
          </button>
        </div>
      )}
      {promotion !== null && (
        <PromotionPicker
          onPick={onPromote}
          onCancel={() => {
            setPromotion(null);
          }}
        />
      )}
      {showMoves && (
        <MovesDialog
          view={view}
          onClose={() => {
            setShowMoves(false);
          }}
        />
      )}
      {gameOver && !dismissedOver && (
        <GameOverDialog
          gameOver={gameOver}
          onNewGame={newGame}
          onClose={() => {
            setDismissedOver(true);
          }}
        />
      )}
    </main>
  );
}
