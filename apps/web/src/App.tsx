import "@fontsource/silkscreen/400.css";
import "@fontsource/silkscreen/700.css";
import { opponent, type Rng } from "@chessweeper/engine";
import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { LobbyDialog } from "./components/LobbyDialog";
import { Dialog } from "./components/Dialog";
import { spriteUrl } from "./components/Px";
import type { GameController } from "./controller";
import { canOffer } from "./drawOffers";
import { GameScreen, TitleBar } from "./GameScreen";
import type { OnlineClient } from "./online/client";
import { isValidCode, normalizeCode } from "./online/code";
import { serverUrl } from "./online/config";
import { useOnlineGame } from "./online/useOnlineGame";
import { configFromOptions, loadOptions, loadRulesHidden, saveOptions } from "./settings";
import { BUTTON_PRESSED, BUTTON_UP } from "./sprites";
import { useLocalGame } from "./useLocalGame";

const CHROME_VARS = {
  "--btn-up": spriteUrl(BUTTON_UP),
  "--btn-down": spriteUrl(BUTTON_PRESSED),
} as CSSProperties;

export interface AppProps {
  rng?: Rng;
  /** Local pass-and-play: hold the handoff screen back until a mine explosion has played. */
  gate?: boolean;
  /** Injectable for tests: builds the online client. Default connects to the game server. */
  createOnlineClient?: () => OnlineClient | null;
}

/** The invite code in `?join=CODE`, removed from the address bar once read. */
function takeJoinParam(): string {
  try {
    const url = new URL(window.location.href);
    const raw = url.searchParams.get("join");
    if (raw === null) return "";
    url.searchParams.delete("join");
    window.history.replaceState(null, "", url.toString());
    const code = normalizeCode(raw);
    return isValidCode(code) ? code : "";
  } catch {
    return "";
  }
}

export function App({ rng, gate = true, createOnlineClient }: AppProps) {
  const [options, setOptions] = useState(loadOptions);
  const [optionsOpen, setOptionsOpen] = useState(false);
  const [rulesOpen, setRulesOpen] = useState(() => !loadRulesHidden());
  const [joinCode] = useState(takeJoinParam);
  const [lobbyOpen, setLobbyOpen] = useState(joinCode !== "");
  const config = useMemo(() => configFromOptions(options), [options]);
  const local = useLocalGame(rng ? { rng, config } : { config });
  const online = useOnlineGame(createOnlineClient ? { createClient: createOnlineClient } : {});
  const onlineAvailable = serverUrl() !== null;

  // A failed create or join sends the player back to the lobby with the reason.
  useEffect(() => {
    if (online.lobbyError !== null) setLobbyOpen(true);
  }, [online.lobbyError]);

  const leaveOnline = () => {
    online.leave();
    setLobbyOpen(true);
  };

  const saveOpts = (next: typeof options) => {
    setOptions(next);
    saveOptions(next);
  };

  const lobby =
    lobbyOpen && !online.active ? (
      <LobbyDialog
        initialCode={joinCode}
        error={online.lobbyError}
        onCreate={() => {
          setLobbyOpen(false);
          online.create();
        }}
        onJoin={(code) => {
          setLobbyOpen(false);
          online.join(code);
        }}
        onClose={() => {
          online.clearLobbyError();
          setLobbyOpen(false);
        }}
      />
    ) : null;

  // Online, before the first snapshot there is no board yet.
  if (online.active && (online.view === null || online.seat === null)) {
    return (
      <div className="desk" style={CHROME_VARS}>
        <main className="window">
          <TitleBar />
          <div className="window-body handoff-body" />
          <Dialog title="Connecting" label="Connecting">
            <p>Connecting to the game server...</p>
            <div className="dialog-buttons">
              <button type="button" className="btn" onClick={leaveOnline}>
                Cancel
              </button>
            </div>
          </Dialog>
        </main>
      </div>
    );
  }

  let ctl: GameController;
  if (online.active && online.view !== null && online.seat !== null) {
    const seat = online.seat;
    ctl = {
      mode: "online",
      view: online.view,
      gameOver: online.gameOver,
      flags: online.flags,
      lastEvents: online.lastEvents,
      turnId: online.turnId,
      seat,
      canMove: online.canMove && online.connection === "open" && online.fatal === null,
      handoffTo: null,
      canOfferDraw: online.canOfferDraw && online.connection === "open",
      pendingDraw: online.draw === "theirs" ? opponent(seat) : online.draw === "mine" ? seat : null,
      canAnswerDraw: online.draw === "theirs",
      play: online.play,
      toggleFlag: online.toggleFlag,
      resign: online.resign,
      offerDraw: online.offerDraw,
      acceptDraw: online.acceptDraw,
      declineDraw: online.declineDraw,
      dismissHandoff: () => undefined,
      newGame: () => undefined,
    };
  } else {
    ctl = {
      mode: "local",
      view: local.view,
      gameOver: local.gameOver,
      flags: local.flags,
      lastEvents: local.lastEvents,
      turnId: local.turnId,
      seat: null,
      canMove: true,
      handoffTo: local.handoffTo,
      canOfferDraw: canOffer(local.offers, local.view.turn),
      pendingDraw: local.offers.pending,
      canAnswerDraw: true,
      play: (move) => {
        local.play(move);
      },
      toggleFlag: local.toggleFlag,
      resign: local.resign,
      offerDraw: local.offerDraw,
      acceptDraw: local.acceptDraw,
      declineDraw: local.declineDraw,
      dismissHandoff: local.dismissHandoff,
      newGame: local.newGame,
    };
  }

  return (
    <GameScreen
      // A fresh screen per mode and per online game, so selection, fx and dialogs reset.
      key={ctl.mode === "online" ? `online:${online.code ?? ""}` : "local"}
      ctl={ctl}
      online={ctl.mode === "online" ? online : null}
      gate={ctl.mode === "local" && gate}
      config={config}
      options={options}
      onSaveOptions={saveOpts}
      optionsOpen={optionsOpen}
      onOptionsOpen={setOptionsOpen}
      rulesOpen={rulesOpen}
      onRulesOpen={setRulesOpen}
      onlineAvailable={onlineAvailable}
      onOpenLobby={() => {
        setLobbyOpen(true);
      }}
      onLeaveOnline={leaveOnline}
    >
      {lobby}
    </GameScreen>
  );
}
