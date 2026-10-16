import { clampSettings } from "@chessweeper/engine";
import { z } from "zod";

/** Largest accepted frame, in characters. The server also caps the socket payload. */
export const MAX_MESSAGE_CHARS = 2048;

/** Invite codes: 6 characters from an alphabet without look-alikes (no I, L, O, 0, 1). */
export const CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
export const CODE_LENGTH = 6;
/** Seat tokens are 32 random bytes in base64url (43 chars). */
export const MAX_TOKEN_CHARS = 64;

const square = z.number().int().min(0).max(63);
const code = z
  .string()
  .length(CODE_LENGTH)
  .regex(new RegExp(`^[${CODE_ALPHABET}]+$`));
const token = z
  .string()
  .min(1)
  .max(MAX_TOKEN_CHARS)
  .regex(/^[A-Za-z0-9_-]+$/);

/**
 * Per-game settings chosen by the creator (design doc 3.7). Integers only; out-of-range
 * values are clamped to the allowed bounds, never rejected, so the server stays the authority.
 */
const settings = z
  .strictObject({
    reshuffleInterval: z.number().int().min(-1_000_000).max(1_000_000),
    densityPercent: z.number().int().min(-1_000_000).max(1_000_000),
  })
  .transform((raw) => clampSettings(raw));

export const clientMessageSchema = z.discriminatedUnion("type", [
  z.strictObject({ type: z.literal("create_room"), settings: settings.optional() }),
  z.strictObject({ type: z.literal("join_room"), code, token: token.optional() }),
  z.strictObject({
    type: z.literal("move"),
    seq: z.number().int().min(0).max(Number.MAX_SAFE_INTEGER),
    from: square,
    to: square,
    promo: z.enum(["n", "b", "r", "q"]).optional(),
  }),
  z.strictObject({ type: z.literal("resign") }),
  z.strictObject({ type: z.literal("draw_offer") }),
  z.strictObject({ type: z.literal("draw_reply"), accept: z.boolean() }),
  z.strictObject({ type: z.literal("claim_win") }),
  z.strictObject({ type: z.literal("ping") }),
]);

export type ClientMessage = z.infer<typeof clientMessageSchema>;

export type ParseResult =
  { readonly ok: true; readonly message: ClientMessage } | { readonly ok: false };

/** Parses one raw frame. Never throws and never reports why it failed (no echo of input). */
export function parseClientMessage(raw: string): ParseResult {
  if (typeof raw !== "string" || raw.length > MAX_MESSAGE_CHARS) return { ok: false };
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    return { ok: false };
  }
  const parsed = clientMessageSchema.safeParse(json);
  return parsed.success ? { ok: true, message: parsed.data } : { ok: false };
}
