/**
 * Public-tunnel providers for `pnpm play` (scripts/play.ts). Pure data and parsing here so it
 * can be unit tested; the launcher does the spawning.
 *
 * Why several: Cloudflare's tunnel needs outbound port 7844, which many campus, work and hotel
 * networks block. The SSH-based ones go out on port 443 or 22, and ngrok uses HTTPS on 443.
 * ngrok is tried first when it is installed and configured: its free tunnels have no session
 * limit (Pinggy's end after 60 minutes).
 */

export type TunnelId = "cloudflared" | "pinggy" | "localhost.run" | "ngrok";

export interface TunnelContext {
  readonly port: number;
  /** Directory holding a throwaway SSH key and known_hosts for this run (SSH tunnels). */
  readonly sshDir: string;
  /** Optional reserved ngrok domain, from NGROK_DOMAIN. */
  readonly ngrokDomain: string | null;
}

export interface TunnelProvider {
  readonly id: TunnelId;
  readonly label: string;
  /** Executable that must exist. */
  readonly bin: string;
  readonly args: (ctx: TunnelContext) => readonly string[];
  /** Finds the public https URL in a chunk of the tool's output, or null. */
  readonly findUrl: (text: string) => string | null;
  /**
   * Local HTTP API that lists the tunnel's public URL (ngrok's agent API). When set, the
   * launcher polls it instead of parsing the tool's output, so nothing the tool prints matters.
   */
  readonly apiUrl?: string;
  /** Reads the public https URL from the API's JSON body, or null while it is not there yet. */
  readonly urlFromApi?: (body: unknown) => string | null;
  /** True when the tunnel adds Cloudflare's CF-Connecting-IP header. */
  readonly cloudflareHeaders: boolean;
}

const first = (re: RegExp, text: string): string | null => re.exec(text)?.[0] ?? null;

/** Common SSH options: no prompts, a private known_hosts, keepalives, fail if forwarding fails. */
export function sshBase(ctx: TunnelContext): string[] {
  return [
    "-o",
    "StrictHostKeyChecking=accept-new",
    "-o",
    `UserKnownHostsFile=${ctx.sshDir}/known_hosts`,
    "-o",
    "BatchMode=yes",
    "-o",
    "ServerAliveInterval=30",
    "-o",
    "ExitOnForwardFailure=yes",
    "-o",
    "ConnectTimeout=15",
    "-i",
    `${ctx.sshDir}/key`,
    "-o",
    "IdentitiesOnly=yes",
  ];
}

/** ngrok's agent API: `{ tunnels: [{ public_url, proto }] }`. Picks the https public URL. */
export function ngrokUrlFromApi(body: unknown): string | null {
  if (typeof body !== "object" || body === null || !("tunnels" in body)) return null;
  const tunnels: unknown = body.tunnels;
  if (!Array.isArray(tunnels)) return null;
  for (const t of tunnels as unknown[]) {
    if (typeof t !== "object" || t === null || !("public_url" in t)) continue;
    const url: unknown = t.public_url;
    if (typeof url === "string" && /^https:\/\/[a-z0-9.-]+$/.test(url)) return url;
  }
  return null;
}

export const TUNNELS: readonly TunnelProvider[] = [
  {
    id: "ngrok",
    label: "ngrok",
    bin: "ngrok",
    // No --log flag: ngrok logs nothing by default. The URL comes from the local agent API.
    args: (ctx) => [
      "http",
      `127.0.0.1:${String(ctx.port)}`,
      ...(ctx.ngrokDomain === null ? [] : [`--url=https://${ctx.ngrokDomain}`]),
    ],
    findUrl: () => null,
    apiUrl: "http://127.0.0.1:4040/api/tunnels",
    urlFromApi: ngrokUrlFromApi,
    cloudflareHeaders: false,
  },
  {
    id: "cloudflared",
    label: "Cloudflare quick tunnel",
    bin: "cloudflared",
    args: (ctx) => ["tunnel", "--no-autoupdate", "--url", `http://127.0.0.1:${String(ctx.port)}`],
    findUrl: (text) => first(/https:\/\/[a-z0-9-]+\.trycloudflare\.com/, text),
    cloudflareHeaders: true,
  },
  {
    id: "pinggy",
    label: "Pinggy (SSH over port 443)",
    bin: "ssh",
    args: (ctx) => [
      ...sshBase(ctx),
      "-p",
      "443",
      "-T",
      `-R0:127.0.0.1:${String(ctx.port)}`,
      "free.pinggy.io",
    ],
    // Real tunnel hosts only: the banner also prints https://dashboard.pinggy.io.
    findUrl: (text) =>
      first(
        /https:\/\/[a-z0-9-]+\.(?:[a-z0-9-]+\.)?(?:pinggy\.net|pinggy-free\.link|pinggy\.link)\b/,
        text,
      ),
    cloudflareHeaders: false,
  },
  {
    id: "localhost.run",
    label: "localhost.run (SSH)",
    bin: "ssh",
    args: (ctx) => [
      ...sshBase(ctx),
      "-T",
      `-R80:127.0.0.1:${String(ctx.port)}`,
      "nokey@localhost.run",
    ],
    // Free tunnels live on lhr.life; the welcome text also links admin.localhost.run.
    findUrl: (text) => first(/https:\/\/[a-z0-9]+\.lhr\.life/, text),
    cloudflareHeaders: false,
  },
];

/** The providers to try, in order. `choice` is "auto" or one provider id. */
export function pickTunnels(choice: string): readonly TunnelProvider[] | null {
  if (choice === "auto") return TUNNELS;
  const one = TUNNELS.find((t) => t.id === choice);
  return one === undefined ? null : [one];
}

/** Reads `--tunnel <id>` / `--tunnel=<id>` from argv; "auto" when absent. */
export function tunnelChoice(argv: readonly string[]): string {
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i] ?? "";
    if (arg === "--tunnel") return argv[i + 1] ?? "";
    if (arg.startsWith("--tunnel=")) return arg.slice("--tunnel=".length);
  }
  return "auto";
}
