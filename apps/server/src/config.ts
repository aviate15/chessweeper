export interface ServerConfig {
  readonly port: number;
  readonly host: string;
  readonly allowedOrigins: readonly string[];
  readonly trustProxy: boolean;
}

const DEV_ORIGIN = "http://localhost:5173";

/**
 * Reads the environment. Fails closed: with no ALLOWED_ORIGINS nothing is allowed, and the
 * dev origin is added only when NODE_ENV=development.
 *   PORT, HOST, ALLOWED_ORIGINS (comma separated exact origins), TRUST_PROXY (1 or true).
 */
export function loadConfig(env: Readonly<Record<string, string | undefined>>): ServerConfig {
  const origins = (env.ALLOWED_ORIGINS ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s !== "" && s !== "*");
  if (env.NODE_ENV === "development") origins.push(DEV_ORIGIN);
  const port = Number(env.PORT ?? "8080");
  if (!Number.isInteger(port) || port < 0 || port > 65535) throw new Error("Invalid PORT");
  return {
    port,
    host: env.HOST ?? "0.0.0.0",
    allowedOrigins: [...new Set(origins)],
    trustProxy: env.TRUST_PROXY === "1" || env.TRUST_PROXY === "true",
  };
}
