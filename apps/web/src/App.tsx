import "@fontsource/silkscreen/400.css";
import "@fontsource/silkscreen/700.css";
import {
  destinationsFrom,
  legalMovesFromView,
  noFlags,
  type Color,
  type Move,
  type PromotionPiece,
  type Rng,
  type Square,
} from "@chessweeper/engine";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type CSSProperties,
} from "react";
import { isMuted, playCue, playCues, setMuted, subscribeMuted, unlockAudio } from "./audio";
import { Board, findKing } from "./components/Board";
import { GameOverDialog } from "./components/GameOverDialog";
import { HandoffScreen } from "./components/HandoffScreen";
import { faceFor, InfoBar } from "./components/InfoBar";
import { MenuBar } from "./components/MenuBar";
import { MoveLog } from "./components/MoveLog";
import { Px, spriteUrl } from "./components/Px";
import { PromotionPicker } from "./components/PromotionPicker";
import { StatusBar } from "./components/StatusBar";
import { describeSquare } from "./narration";
import { canOffer } from "./drawOffers";
import {
  fxEndMs,
  prefersReducedMotion,
  presentationFor,
  type Fx,
  type Presentation,
} from "./presentation";
import { OptionsDialog } from "./components/OptionsDialog";
import { RulesDialog } from "./components/RulesDialog";
import {
  configFromOptions,
  loadFlip,
  loadOptions,
  loadRulesHidden,
  saveFlip,
  saveOptions,
  saveRulesHidden,
  type GameOptions,
} from "./settings";
import { BUTTON_PRESSED, BUTTON_UP, CLOSE_BOX } from "./sprites";
import { useFit } from "./useFit";
import { useLocalGame } from "./useLocalGame";

const NO_FLAGS = noFlags();
const NO_FX: readonly Fx[] = [];
const CHROME_VARS = {
  "--btn-up": spriteUrl(BUTTON_UP),
  "--btn-down": spriteUrl(BUTTON_PRESSED),
} as CSSProperties;

export interface AppProps {
  rng?: Rng;
  /**
   * Local pass-and-play only: hold the handoff screen and game-over dialog back until a mine
   * explosion has played (or the player clicks or presses a key). A future online client,
   * which has no handoff, passes false and never blocks.
   */
  gate?: boolean;
}

export function App({ rng, gate = true }: AppProps) {
  const [options, setOptions] = useState<GameOptions>(loadOptions);
  /** Number hint shown in the status bar after focusing or tapping a revealed square. */
  const [hint, setHint] = useState<string | null>(null);
  const [optionsOpen, setOptionsOpen] = useState(false);
  const [rulesOpen, setRulesOpen] = useState(() => !loadRulesHidden());
  const config = useMemo(() => configFromOptions(options), [options]);
  const game = useLocalGame(rng ? { rng, config } : { config });
  const { view, gameOver, turnId, lastEvents } = game;
  const [selected, setSelected] = useState<Square | null>(null);
  const [promotion, setPromotion] = useState<{ from: Square; to: Square } | null>(null);
  const [flagMode, setFlagMode] = useState(false);
  const [dismissedOver, setDismissedOver] = useState(false);
  const [flip, setFlip] = useState(loadFlip);
  const [orientation, setOrientation] = useState<Color>("w");
  /** Turn whose handoff has been dismissed; its effects then replay for the new player. */
  const [dismissedTurn, setDismissedTurn] = useState(-1);
  const [skippedTurn, setSkippedTurn] = useState(-1);
  const [gateShownTurn, setGateShownTurn] = useState(-1);
  const [fxDoneKey, setFxDoneKey] = useState("");
  const logRef = useRef<HTMLElement>(null);
  const fit = useFit();
  const soundOn = !useSyncExternalStore(subscribeMuted, isMuted);

  const over = view.status.kind === "over";
  const reducedMotion = useMemo(() => prefersReducedMotion(), []);

  const presentation: Presentation = useMemo(
    () =>
      presentationFor(lastEvents, {
        reducedMotion,
        checkSquare: view.inCheck && !over ? findKing(view, view.turn) : null,
        mineCount: gameOver?.mines.length ?? 0,
      }),
    [lastEvents, view, over, gameOver, reducedMotion],
  );

  // The explosion gate: only presentation waits, the engine state is already updated.
  const gated =
    gate &&
    presentation.blockingMs > 0 &&
    skippedTurn !== turnId &&
    (game.handoffTo !== null || over);

  useEffect(() => {
    if (!gated) return;
    setGateShownTurn(turnId);
    const finish = () => {
      setSkippedTurn(turnId);
    };
    const timer = window.setTimeout(finish, presentation.blockingMs);
    window.addEventListener("pointerdown", finish, true);
    window.addEventListener("keydown", finish, true);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("pointerdown", finish, true);
      window.removeEventListener("keydown", finish, true);
    };
  }, [gated, turnId, presentation.blockingMs]);

  // Effects shown on the board: everything while the mover watches; after a handoff only what
  // the mover has not already seen through the gate.
  const phase = dismissedTurn === turnId ? "post" : "pre";
  const fxKey = `${String(turnId)}:${phase}`;
  const shownFx = useMemo(() => {
    if (phase === "pre") return presentation.fx;
    if (gateShownTurn !== turnId) return presentation.fx;
    return presentation.fx.filter((f) => f.kind !== "explosion" && f.kind !== "lifeCrack");
  }, [phase, presentation, gateShownTurn, turnId]);
  const fxActive = fxDoneKey !== fxKey && shownFx.length > 0;
  useEffect(() => {
    if (shownFx.length === 0) return;
    const timer = window.setTimeout(
      () => {
        setFxDoneKey(fxKey);
      },
      fxEndMs(shownFx) + 50,
    );
    return () => {
      window.clearTimeout(timer);
    };
  }, [fxKey, shownFx]);
  const activeFx = fxActive ? shownFx : NO_FX;
  const crackColor = (() => {
    const f = activeFx.find((x) => x.kind === "lifeCrack");
    return f?.kind === "lifeCrack" ? f.color : null;
  })();

  // Sound: unlock on the first gesture, one set of cues per turn.
  useEffect(() => {
    const unlock = () => {
      unlockAudio();
      window.removeEventListener("pointerdown", unlock, true);
      window.removeEventListener("keydown", unlock, true);
    };
    window.addEventListener("pointerdown", unlock, true);
    window.addEventListener("keydown", unlock, true);
    return () => {
      window.removeEventListener("pointerdown", unlock, true);
      window.removeEventListener("keydown", unlock, true);
    };
  }, []);
  const latest = useRef({ events: lastEvents, inCheck: view.inCheck && !over });
  latest.current = { events: lastEvents, inCheck: view.inCheck && !over };
  useEffect(() => {
    if (turnId === 0) return;
    playCues(latest.current.events);
    if (latest.current.inCheck) playCue("check");
  }, [turnId]);

  const destinations = selected === null || over ? [] : destinationsFrom(view, selected);

  const attempt = (move: Move) => {
    setSelected(null);
    setPromotion(null);
    game.play(move);
  };

  const flagSquare = (square: Square) => {
    playCue("flag");
    game.toggleFlag(square);
  };

  const showHint = (square: Square) => {
    setHint(describeSquare(view, square));
  };

  // Any new turn or game replaces the hint with the usual narration.
  useEffect(() => {
    setHint(null);
  }, [turnId]);

  const onSquareClick = (square: Square) => {
    showHint(square);
    if (over || gated) return;
    if (flagMode) {
      flagSquare(square);
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
    setOrientation("w");
    setDismissedTurn(-1);
  };

  const openRules = () => {
    setRulesOpen(true);
  };

  const toggleFlip = () => {
    const next = !flip;
    setFlip(next);
    saveFlip(next);
    if (!over) setOrientation(next ? view.turn : "w");
  };

  const focusMoves = useCallback(() => {
    const el = logRef.current;
    if (!el) return;
    el.focus();
    el.scrollTop = el.scrollHeight;
  }, []);

  const rootStyle: CSSProperties = { ...CHROME_VARS };
  const windowStyle: CSSProperties = { zoom: fit.zoom };
  const windowClass = fit.stacked ? "window window-stacked" : "window";

  if (game.handoffTo !== null && !gated) {
    return (
      <div className="desk" style={rootStyle}>
        <main className={windowClass} style={windowStyle}>
          <TitleBar />
          <div className="window-body handoff-body" />
          <HandoffScreen
            to={game.handoffTo}
            onReady={() => {
              setSelected(null);
              setOrientation(flip ? (game.handoffTo ?? "w") : "w");
              setDismissedTurn(turnId);
              game.dismissHandoff();
            }}
          />
        </main>
      </div>
    );
  }

  const face = faceFor(view, selected !== null);
  return (
    <div className="desk" style={rootStyle}>
      <main className={windowClass} style={windowStyle}>
        <TitleBar />
        <MenuBar
          gameOver={over}
          canOfferDraw={canOffer(game.offers, view.turn)}
          flip={flip}
          soundOn={soundOn}
          onNewGame={newGame}
          onResign={game.resign}
          onOfferDraw={game.offerDraw}
          onToggleFlip={toggleFlip}
          onToggleSound={() => {
            setMuted(!isMuted());
          }}
          onMoves={focusMoves}
          onOptions={() => {
            setOptionsOpen(true);
          }}
          onRules={openRules}
        />
        <InfoBar
          view={view}
          face={face}
          flagMode={flagMode}
          crackColor={crackColor}
          gameOver={over}
          pendingDraw={game.offers.pending}
          onSmiley={newGame}
          onRules={openRules}
          onFlagToggle={() => {
            setFlagMode((v) => !v);
          }}
          onAcceptDraw={game.acceptDraw}
          onDeclineDraw={game.declineDraw}
        />
        <div className="window-body">
          <Board
            view={view}
            flags={gated ? NO_FLAGS : game.flags}
            orientation={orientation}
            selected={gated ? null : selected}
            destinations={gated ? [] : destinations}
            mines={gameOver?.mines ?? []}
            fx={activeFx}
            fxKey={turnId * 2 + (phase === "post" ? 1 : 0)}
            onSquareClick={onSquareClick}
            onSquareFocus={showHint}
            onSquareFlag={(sq) => {
              if (!over && !gated) flagSquare(sq);
            }}
          />
          <MoveLog view={view} logRef={logRef} />
        </div>
        <StatusBar view={view} hint={hint} />
        {promotion !== null && (
          <PromotionPicker
            color={view.turn}
            onPick={onPromote}
            onCancel={() => {
              setPromotion(null);
            }}
          />
        )}
        {rulesOpen && (
          <RulesDialog
            config={config}
            onClose={(dontShowAgain) => {
              if (dontShowAgain) saveRulesHidden(true);
              setRulesOpen(false);
            }}
          />
        )}
        {optionsOpen && (
          <OptionsDialog
            options={options}
            onSave={(next) => {
              setOptions(next);
              saveOptions(next);
            }}
            onClose={() => {
              setOptionsOpen(false);
            }}
          />
        )}
        {gameOver && !dismissedOver && !gated && (
          <GameOverDialog
            gameOver={gameOver}
            onNewGame={newGame}
            onClose={() => {
              setDismissedOver(true);
            }}
          />
        )}
      </main>
    </div>
  );
}

function TitleBar() {
  return (
    <header className="titlebar">
      <h1 className="title">Chessweeper</h1>
      <Px sprite={CLOSE_BOX} className="titlebar-close" />
    </header>
  );
}
