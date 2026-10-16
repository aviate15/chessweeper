export interface ServerEnv {
  readonly VITE_SERVER_URL?: string | undefined;
  readonly DEV: boolean;
}

const DEV_SERVER_URL = "ws://localhost:8080";

/**
 * The game server's WebSocket URL, or null when online play is not configured. Production
 * builds need VITE_SERVER_URL; only dev builds fall back to the local server.
 */
export function resolveServerUrl(env: ServerEnv): string | null {
  const configured = env.VITE_SERVER_URL?.trim();
  if (configured) return configured;
  return env.DEV ? DEV_SERVER_URL : null;
}

export function serverUrl(): string | null {
  return resolveServerUrl({
    VITE_SERVER_URL: import.meta.env.VITE_SERVER_URL as string | undefined,
    DEV: import.meta.env.DEV,
  });
}
