import type { ProxyMode } from "./ip";
import type { Limits } from "./limits";

export interface ServerConfig {
  readonly port: number;
  readonly host: string;
  readonly allowedOrigins: readonly string[];
  readonly trustProxy: ProxyMode;
  /** Directory of the built web app to serve, or null to serve only the game. */
  readonly staticDir: string | null;
  /** Only the limits set in the environment; the rest come from DEFAULT_LIMITS. */
  readonly limits: Partial<Limits>;
}

const DEV_ORIGIN = "http://localhost:5173";

/**
 * Reads the environment. Fails closed: with no ALLOWED_ORIGINS nothing is allowed, and the
 * dev origin is added only when NODE_ENV=development.
 *   PORT, HOST, ALLOWED_ORIGINS (comma separated exact origins), TRUST_PROXY (1/true/fly or cloudflare),
 *   STATIC_DIR,
 *   MAX_ROOMS_PER_IP, MAX_CONNS_PER_IP, MAX_ROOMS, FINISHED_ROOM_MS (positive integers).
 */
export function loadConfig(env: Readonly<Record<string, string | undefined>>): ServerConfig {
  const origins = (env.ALLOWED_ORIGINS ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s !== "" && s !== "*");
  if (env.NODE_ENV === "development") origins.push(DEV_ORIGIN);
  const port = Number(env.PORT ?? "8080");
  if (!Number.isInteger(port) || port < 0 || port > 65535) throw new Error("Invalid PORT");
  const limits: { -readonly [K in keyof Limits]?: Limits[K] } = {};
  const maxRoomsPerIp = positiveInt(env, "MAX_ROOMS_PER_IP");
  if (maxRoomsPerIp !== undefined) limits.maxRoomsPerIp = maxRoomsPerIp;
  const maxConnectionsPerIp = positiveInt(env, "MAX_CONNS_PER_IP");
  if (maxConnectionsPerIp !== undefined) limits.maxConnectionsPerIp = maxConnectionsPerIp;
  const maxRooms = positiveInt(env, "MAX_ROOMS");
  if (maxRooms !== undefined) limits.maxRooms = maxRooms;
  const finishedRoomMs = positiveInt(env, "FINISHED_ROOM_MS");
  if (finishedRoomMs !== undefined) limits.finishedRoomMs = finishedRoomMs;
  return {
    port,
    host: env.HOST ?? "0.0.0.0",
    allowedOrigins: [...new Set(origins)],
    trustProxy: parseProxy(env.TRUST_PROXY),
    staticDir: nonEmpty(env.STATIC_DIR),
    limits,
  };
}

/** Unset or empty means "use the default"; anything else must be a positive integer. */
function positiveInt(
  env: Readonly<Record<string, string | undefined>>,
  name: string,
): number | undefined {
  const raw = env[name]?.trim();
  if (raw === undefined || raw === "") return undefined;
  const value = Number(raw);
  if (!Number.isInteger(value) || value <= 0) throw new Error(`Invalid ${name}`);
  return value;
}

function parseProxy(raw: string | undefined): ProxyMode {
  const value = raw?.trim().toLowerCase();
  if (value === "1" || value === "true" || value === "fly") return "fly";
  if (value === "cloudflare") return "cloudflare";
  return "none";
}

function nonEmpty(value: string | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed === undefined || trimmed === "" ? null : trimmed;
}
