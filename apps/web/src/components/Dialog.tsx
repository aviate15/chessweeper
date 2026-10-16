import type { ReactNode } from "react";
import { CLOSE_BOX } from "../sprites";
import { Px } from "./Px";

/** A modal dialog with Windows title-bar chrome, centred over the window. */
export function Dialog({
  title,
  label,
  onClose,
  className,
  children,
}: {
  title: string;
  label: string;
  onClose?: () => void;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className="dialog-layer">
      <div
        className={className ? `dialog ${className}` : "dialog"}
        role="dialog"
        aria-label={label}
      >
        <div className="dialog-titlebar">
          <h2 className="dialog-title">{title}</h2>
          {onClose && (
            <button type="button" className="close-box" aria-label="Close" onClick={onClose}>
              <Px sprite={CLOSE_BOX} className="close-box-px" />
            </button>
          )}
        </div>
        <div className="dialog-body">{children}</div>
      </div>
    </div>
  );
}
