# Play online from your laptop (free, no account)

One command runs the game server on your laptop and exposes it through a free [Cloudflare quick tunnel](https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/do-more-with-tunnels/trycloudflare/). Friends open one link and play. There is no hosting, no cost and no Cloudflare account.

## Install (once)

```sh
brew install cloudflared
pnpm install
```

## Run

```sh
pnpm play
```

It builds the web app and the server, starts the tunnel, starts the server, and prints something like:

```
Chessweeper is up.
  Public link: https://charges-stated-chat-mail.trycloudflare.com   (copied)
  On this machine:  http://localhost:8080
```

The public link is copied to your clipboard. Open it yourself, then:

1. **Game → Online… → Create game.**
2. Click **Copy link** and send it to your friend (or tell them the 6-character code).
3. They open the link and the game starts. You play on the same site, so nothing else to set up.

Options: `pnpm play --local` (no tunnel, only `http://localhost:8080`), `pnpm play --verbose` (show cloudflared's log), `PLAY_PORT=9000 pnpm play` (another port; the port must be free).

## What friends see

The same game at the trycloudflare address. Online play works with no configuration because the page and the game server share one address (the client connects to `wss://<same host>/ws`).

## Limits

- It works **only while your laptop is awake and the command is running.** Closing the lid sleeps the laptop; `pnpm play` keeps it awake otherwise (macOS).
- **Ctrl+C, a crash or a restart drops every live game.** Rooms live in memory.
- **The link changes every run.** Old invite links stop working.
- Quick tunnels are best effort, with no uptime promise from Cloudflare.
- cloudflared needs outbound access to Cloudflare on **port 7844** (UDP, with TCP as fallback). Campus, work or hotel wifi and some VPNs block it. If the public link never comes up, `pnpm play` stops and says so; try a phone hotspot. A `~/.cloudflared/config.yml` file can also stop quick tunnels from starting.

## Safety

- The link is **public while the command runs**: anyone who has it can open the game. Games are private by invite code, and mines never leave the server before the game ends (same as everywhere).
- The server listens on `127.0.0.1` only, so nothing on your network can reach it except through the tunnel.
- WebSocket connections must come from the tunnel's own address (or localhost). The launcher passes the new address to the server on each run; no list to edit.
- The real visitor address is read from `CF-Connecting-IP` only when the connection comes from your own machine (cloudflared), so the per-IP limits apply to each friend separately: 30 rooms and 100 connections per IP, 200 rooms in total, plus the usual per-connection rate limit.
- Logs contain event names and counts only: no IPs, seat tokens, invite codes or links. cloudflared's own log is hidden unless you pass `--verbose`.

## Troubleshooting

- **"cloudflared is not installed"**: `brew install cloudflared`.
- **"Port 8080 is busy"**: stop the other program, or `PLAY_PORT=8099 pnpm play`.
- **"The public link never came up"**: see the port 7844 note above; run with `--verbose`.
- **Friend sees a Cloudflare error page (530, 1033)**: the tunnel dropped. Stop and run `pnpm play` again; you get a new link.

Hosting on Fly.io and Vercel instead is still set up for later: see [DEPLOY.md](DEPLOY.md).
