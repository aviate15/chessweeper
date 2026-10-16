import { LED_DIGITS, PALETTE, type Palette } from "../sprites";
import { Px } from "./Px";

export function ledText(value: number, digits = 3): string {
  const clamped = Math.max(0, Math.min(10 ** digits - 1, Math.trunc(value)));
  return String(clamped).padStart(digits, "0");
}

/** Three-digit LED counter. The number is also in the DOM as hidden text for tests and readers. */
export function Led({
  value,
  label,
  testId,
  palette = PALETTE,
  blink = false,
}: {
  value: number;
  label: string;
  testId?: string;
  palette?: Palette;
  blink?: boolean;
}) {
  const text = ledText(value);
  return (
    <span className={blink ? "led led-blink" : "led"} title={label}>
      <span className="sr-only" data-testid={testId}>
        {String(value)}
      </span>
      <span className="led-digits" aria-hidden="true">
        {text.split("").map((ch, i) => (
          <Px key={i} sprite={LED_DIGITS[ch] ?? []} palette={palette} className="led-digit" />
        ))}
      </span>
    </span>
  );
}
