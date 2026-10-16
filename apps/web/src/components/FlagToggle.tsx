export function FlagToggle({ on, onToggle }: { on: boolean; onToggle: () => void }) {
  return (
    <button type="button" aria-pressed={on} className="flag-toggle" onClick={onToggle}>
      {"⚑"} Flag mode: {on ? "on" : "off"}
    </button>
  );
}
