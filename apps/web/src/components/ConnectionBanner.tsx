import { useEffect } from "react";
import { playCue } from "../audio";
import { FATAL_MESSAGES, type FatalReason } from "../online/errors";
import type { OnlineNotice, OpponentState } from "../online/useOnlineGame";
import type { ConnectionState } from "../online/client";

export const NOTICE_MS = 5000;

/** Online status strip: reconnecting, opponent away, server errors, and fatal endings. */
export function ConnectionBanner({
  connection,
  opponent,
  over,
  fatal,
  error,
  onClaimWin,
  onDismissError,
  onLeave,
}: {
  connection: ConnectionState;
  opponent: OpponentState;
  over: boolean;
  fatal: FatalReason | null;
  error: OnlineNotice | null;
  onClaimWin: () => void;
  onDismissError: () => void;
  onLeave: () => void;
}) {
  const errorId = error?.id;
  useEffect(() => {
    if (errorId === undefined) return;
    const timer = window.setTimeout(onDismissError, NOTICE_MS);
    return () => {
      window.clearTimeout(timer);
    };
  }, [errorId, onDismissError]);

  const rows: React.ReactNode[] = [];
  if (fatal !== null) {
    rows.push(
      <div key="fatal" className="banner banner-bad" role="alert">
        <span>{FATAL_MESSAGES[fatal]}</span>
        <button
          type="button"
          className="btn"
          onClick={() => {
            playCue("click");
            onLeave();
          }}
        >
          Back to lobby
        </button>
      </div>,
    );
  } else if (connection === "reconnecting" && !over) {
    rows.push(
      <div key="reconnecting" className="banner banner-warn" role="status">
        Reconnecting...
      </div>,
    );
  }
  if (fatal === null && !over) {
    if (opponent === "disconnected") {
      rows.push(
        <div key="away" className="banner banner-warn" role="status">
          Opponent disconnected. Waiting for them to come back...
        </div>,
      );
    } else if (opponent === "claimable") {
      rows.push(
        <div key="claim" className="banner banner-warn" role="status">
          <span>Opponent left the game.</span>
          <button
            type="button"
            className="btn"
            onClick={() => {
              playCue("click");
              onClaimWin();
            }}
          >
            Claim win
          </button>
        </div>,
      );
    }
  }
  if (error !== null) {
    rows.push(
      <div key="error" className="banner banner-bad" role="alert">
        <span>{error.text}</span>
        <button type="button" className="btn" onClick={onDismissError}>
          OK
        </button>
      </div>,
    );
  }
  if (rows.length === 0) return null;
  return <div className="banners">{rows}</div>;
}
