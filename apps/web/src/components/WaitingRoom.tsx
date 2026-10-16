import { useState } from "react";
import { playCue } from "../audio";
import type { GameOptions } from "../settings";
import { Dialog } from "./Dialog";
import { settingsSummary } from "./SettingsFields";

/** The invite link for a code: this page with ?join=CODE. */
export function inviteLink(code: string): string {
  const url = new URL(window.location.href);
  url.search = "";
  url.hash = "";
  url.searchParams.set("join", code);
  return url.toString();
}

async function copy(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

/** Shown to the creator until the opponent joins. */
export function WaitingRoom({
  code,
  settings,
  onCancel,
}: {
  code: string;
  settings: GameOptions | null;
  onCancel: () => void;
}) {
  const [copied, setCopied] = useState<"code" | "link" | "failed" | null>(null);
  const doCopy = (what: "code" | "link") => {
    playCue("click");
    void copy(what === "code" ? code : inviteLink(code)).then((ok) => {
      setCopied(ok ? what : "failed");
    });
  };
  return (
    <Dialog title="Waiting for opponent" label="Waiting room">
      <p>Send this code to your opponent:</p>
      <p className="code-box" data-testid="invite-code" aria-label={`Invite code ${code}`}>
        {code}
      </p>
      {settings !== null && <p data-testid="waiting-settings">{settingsSummary(settings)}</p>}
      <div className="dialog-buttons">
        <button
          type="button"
          className="btn"
          onClick={() => {
            doCopy("code");
          }}
        >
          Copy code
        </button>
        <button
          type="button"
          className="btn"
          onClick={() => {
            doCopy("link");
          }}
        >
          Copy link
        </button>
      </div>
      <p className="dialog-note" role="status">
        {copied === "code" && "Code copied."}
        {copied === "link" && "Link copied."}
        {copied === "failed" && "Could not copy. Select the code and copy it by hand."}
        {copied === null && "Waiting for opponent..."}
      </p>
      <div className="dialog-buttons">
        <button
          type="button"
          className="btn"
          onClick={() => {
            playCue("click");
            onCancel();
          }}
        >
          Cancel
        </button>
      </div>
    </Dialog>
  );
}
