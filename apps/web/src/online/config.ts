export interface ServerEnv {
  readonly VITE_SERVER_URL?: string | undefined;
  readonly DEV: boolean;
  /** Where the page was loaded from; used to find the game server in a production build. */
  readonly location?: { readonly protocol: string; readonly host: string } | undefined;
}

const DEV_SERVER_URL = "ws://localhost:8080";

/** Path the game server accepts WebSocket upgrades on when it also serves the page. */
export const SAME_ORIGIN_PATH = "/ws";

/**
 * The game server's WebSocket URL, or null when online play is not possible.
 * - VITE_SERVER_URL wins (a separately hosted server).
 * - Dev builds fall back to the local dev server.
 * - Production builds without it assume the server also served this page (`pnpm play`) and
 *   connect to the same host: wss on https, ws on http.
 */
export function resolveServerUrl(env: ServerEnv): string | null {
  const configured = env.VITE_SERVER_URL?.trim();
  if (configured) return configured;
  if (env.DEV) return DEV_SERVER_URL;
  const loc = env.location;
  if (loc === undefined) return null;
  const scheme = loc.protocol === "https:" ? "wss" : loc.protocol === "http:" ? "ws" : null;
  return scheme === null ? null : `${scheme}://${loc.host}${SAME_ORIGIN_PATH}`;
}

export function serverUrl(): string | null {
  return resolveServerUrl({
    VITE_SERVER_URL: import.meta.env.VITE_SERVER_URL as string | undefined,
    DEV: import.meta.env.DEV,
    location: typeof window === "undefined" ? undefined : window.location,
  });
}
