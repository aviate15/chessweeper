import "@fontsource/silkscreen/400.css";
import "@fontsource/silkscreen/700.css";
import {
  destinationsFrom,
  legalMovesFromView,
  noFlags,
  type Color,
  type GameConfig,
  type Move,
  type PromotionPiece,
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
  type ReactNode,
} from "react";
import { isMuted, playCue, playCues, setMuted, subscribeMuted, unlockAudio } from "./audio";
import { Board, findKing } from "./components/Board";
import { ConfirmDialog, type ConfirmKind } from "./components/ConfirmDialog";
import { ConnectionBanner } from "./components/ConnectionBanner";
import { GameOverDialog } from "./components/GameOverDialog";
import { HandoffScreen } from "./components/HandoffScreen";
import { faceFor, InfoBar } from "./components/InfoBar";
import { MenuBar } from "./components/MenuBar";
import { MoveLog } from "./components/MoveLog";
import { Px, spriteUrl } from "./components/Px";
import { PromotionPicker } from "./components/PromotionPicker";
import { WaitingRoom } from "./components/WaitingRoom";
import { StatusBar } from "./components/StatusBar";
import { describeSquare } from "./narration";
import type { GameController } from "./controller";
import type { OnlineGame } from "./online/useOnlineGame";
import {
  fxEndMs,
  prefersReducedMotion,
  presentationFor,
  type Fx,
  type Presentation,
} from "./presentation";
import { OptionsDialog } from "./components/OptionsDialog";
import { RulesDialog } from "./components/RulesDialog";
import { loadFlip, saveFlip, saveRulesHidden, type GameOptions } from "./settings";
import { BUTTON_PRESSED, BUTTON_UP, CLOSE_BOX } from "./sprites";
import { useFit } from "./useFit";

const NO_FLAGS = noFlags();
const NO_FX: readonly Fx[] = [];
const CHROME_VARS = {
  "--btn-up": spriteUrl(BUTTON_UP),
  "--btn-down": spriteUrl(BUTTON_PRESSED),
} as CSSProperties;

export interface GameScreenProps {
  ctl: GameController;
  /** The online session, when this screen is showing an online game. */
  online: OnlineGame | null;
  /**
   * Local pass-and-play only: hold the handoff screen and game-over dialog back until a mine
   * explosion has played (or the player clicks or presses a key). Online never blocks.
   */
  gate: boolean;
  config: GameConfig;
  options: GameOptions;
  onSaveOptions: (options: GameOptions) => void;
  optionsOpen: boolean;
  onOptionsOpen: (open: boolean) => void;
  rulesOpen: boolean;
  onRulesOpen: (open: boolean) => void;
  onlineAvailable: boolean;
  onOpenLobby: () => void;
  /** Leaves the online game for good and returns to the lobby. */
  onLeaveOnline: () => void;
  /** Extra dialogs rendered inside the window (the lobby). */
  children?: ReactNode;
}

export function GameScreen({
  ctl,
  online,
  gate,
  config,
  options,
  onSaveOptions,
  optionsOpen,
  onOptionsOpen,
  rulesOpen,
  onRulesOpen,
  onlineAvailable,
  onOpenLobby,
  onLeaveOnline,
  children,
}: GameScreenProps) {
  const isOnline = ctl.mode === "online";
  /** Number hint shown in the status bar after focusing or tapping a revealed square. */
  const [hint, setHint] = useState<string | null>(null);
  const game = ctl;
  const { view, gameOver, turnId, lastEvents } = game;
  const [selected, setSelected] = useState<Square | null>(null);
  const [promotion, setPromotion] = useState<{ from: Square; to: Square } | null>(null);
  const [flagMode, setFlagMode] = useState(false);
  const [dismissedOver, setDismissedOver] = useState(false);
  const [flip, setFlip] = useState(loadFlip);
  const [localOrientation, setOrientation] = useState<Color>(() =>
    loadFlip() && view.status.kind !== "over" ? view.turn : "w",
  );
  // Online the board is fixed to my seat: no flipping.
  const orientation: Color = game.seat ?? localOrientation;
  const [confirm, setConfirm] = useState<ConfirmKind | null>(null);
  /** Turn whose handoff has been dismissed; its effects then replay for the new player. */
  const [dismissedTurn, setDismissedTurn] = useState(-1);
  const [skippedTurn, setSkippedTurn] = useState(-1);
  const [gateShownTurn, setGateShownTurn] = useState(-1);
  const [fxDoneKey, setFxDoneKey] = useState("");
  const logRef = useRef<HTMLElement>(null);
  const fit = useFit();
  const soundOn = !useSyncExternalStore(subscribeMuted, isMuted);

  const over = view.status.kind === "over";
  const phase0 = online?.phase ?? null;
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

  // Online, a piece can only be held while it is my turn and the connection is up.
  useEffect(() => {
    if (!game.canMove) setSelected(null);
  }, [game.canMove]);

  const destinations =
    selected === null || over || !game.canMove ? [] : destinationsFrom(view, selected);

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
    if (!game.canMove) return;
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

  const resetLocal = () => {
    setSelected(null);
    setPromotion(null);
    setDismissedOver(false);
    setOrientation("w");
    setDismissedTurn(-1);
  };

  /** Online, the smiley and New game mean Leave game. */
  const requestLeave = () => {
    if (online === null) return;
    if (online.phase === "playing" && online.fatal === null) setConfirm("leave");
    else onLeaveOnline();
  };

  const newGame = () => {
    if (isOnline) {
      requestLeave();
      return;
    }
    game.newGame();
    resetLocal();
  };

  /** Online actions are irreversible, so each asks first; local ones act at once. */
  const ask = (kind: ConfirmKind, action: () => void) => () => {
    if (isOnline) setConfirm(kind);
    else action();
  };

  const confirmed = (kind: ConfirmKind) => {
    setConfirm(null);
    switch (kind) {
      case "resign":
        game.resign();
        return;
      case "offerDraw":
        game.offerDraw();
        return;
      case "acceptDraw":
        game.acceptDraw();
        return;
      case "declineDraw":
        game.declineDraw();
        return;
      case "claimWin":
        online?.claimWin();
        return;
      case "leave":
        online?.resign();
        onLeaveOnline();
        return;
    }
  };

  const openRules = () => {
    onRulesOpen(true);
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
          canOfferDraw={game.canOfferDraw}
          flip={flip}
          soundOn={soundOn}
          onNewGame={newGame}
          onResign={ask("resign", game.resign)}
          onOfferDraw={ask("offerDraw", game.offerDraw)}
          onToggleFlip={toggleFlip}
          onToggleSound={() => {
            setMuted(!isMuted());
          }}
          onMoves={focusMoves}
          onOptions={() => {
            onOptionsOpen(true);
          }}
          onRules={openRules}
          online={isOnline}
          onlineAvailable={onlineAvailable}
          onOnline={onOpenLobby}
          onLeave={requestLeave}
        />
        <InfoBar
          view={view}
          face={face}
          flagMode={flagMode}
          crackColor={crackColor}
          gameOver={over}
          pendingDraw={game.pendingDraw}
          canAnswerDraw={game.canAnswerDraw}
          onSmiley={newGame}
          onRules={openRules}
          onFlagToggle={() => {
            setFlagMode((v) => !v);
          }}
          onAcceptDraw={ask("acceptDraw", game.acceptDraw)}
          onDeclineDraw={ask("declineDraw", game.declineDraw)}
        />
        {online !== null && (
          <ConnectionBanner
            connection={online.connection}
            opponent={online.opponent}
            over={over}
            fatal={online.fatal}
            error={online.error}
            onClaimWin={() => {
              setConfirm("claimWin");
            }}
            onDismissError={online.dismissError}
            onLeave={onLeaveOnline}
          />
        )}
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
        <StatusBar view={view} hint={hint} you={game.seat} />
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
              onRulesOpen(false);
            }}
          />
        )}
        {optionsOpen && (
          <OptionsDialog
            options={options}
            onSave={onSaveOptions}
            onClose={() => {
              onOptionsOpen(false);
            }}
          />
        )}
        {phase0 === "waiting" && online?.code != null && (
          <WaitingRoom code={online.code} onCancel={onLeaveOnline} />
        )}
        {confirm !== null && (
          <ConfirmDialog
            kind={confirm}
            onConfirm={() => {
              confirmed(confirm);
            }}
            onCancel={() => {
              setConfirm(null);
            }}
          />
        )}
        {children}
        {gameOver && !dismissedOver && !gated && (
          <GameOverDialog
            gameOver={gameOver}
            onNewGame={newGame}
            {...(isOnline ? { onBackToLobby: onLeaveOnline } : {})}
            onClose={() => {
              setDismissedOver(true);
            }}
          />
        )}
      </main>
    </div>
  );
}

export function TitleBar() {
  return (
    <header className="titlebar">
      <h1 className="title">Chessweeper</h1>
      <Px sprite={CLOSE_BOX} className="titlebar-close" />
    </header>
  );
}
