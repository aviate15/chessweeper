# Play online from your laptop (free, no account)

One command runs the game server on your laptop and exposes it through a free public tunnel. Friends open one link and play. There is no hosting and no cost. `pnpm play` tries several tunnel services in turn and uses the first one your network lets through, because some networks block some of them.

## Install (once)

```sh
pnpm install
brew install cloudflared   # optional but recommended (first choice)
```

You don't need anything else for the SSH tunnels (Pinggy, localhost.run): they use the `ssh` already on your Mac.

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

Options: `pnpm play --local` (no tunnel, only `http://localhost:8080`), `pnpm play --tunnel pinggy` (use only one of `cloudflared`, `pinggy`, `localhost.run`, `ngrok`), `pnpm play --verbose` (show the tunnel tools' own output), `PLAY_PORT=9000 pnpm play` (another port; the port must be free).

## Which tunnel is used

In the default `auto` mode it tries, in order, and moves on when a link doesn't answer within about 30 seconds:

| Tunnel                  | Needs                      | Goes out on  | Notes                                                                                                |
| ----------------------- | -------------------------- | ------------ | ---------------------------------------------------------------------------------------------------- |
| ngrok                   | free account (below)       | HTTPS 443    | Tried first, only if installed **and** configured. No session limit. Friends click one warning page. |
| Cloudflare quick tunnel | `brew install cloudflared` | UDP/TCP 7844 | Best link when it works. Blocked on many campus, work and hotel networks.                            |
| Pinggy                  | `ssh` (built in)           | TCP 443      | No account. Free links last 60 minutes, then restart.                                                |
| localhost.run           | `ssh` (built in)           | TCP 22       | No account. Links change after a few hours.                                                          |

The launcher prints which one it used and why the others were skipped.

### Recommended for long sessions: ngrok (free account, one time)

ngrok's free tunnels have **no session time limit**, unlike Pinggy's 60 minutes.

```sh
brew install ngrok
ngrok config add-authtoken <your token from dashboard.ngrok.com>   # you run this; never commit or share the token
pnpm play            # ngrok is picked automatically; or: pnpm play --tunnel ngrok
```

The launcher checks the setup with `ngrok config check` (exit code only; the token is never read or printed), starts ngrok, reads the public URL from ngrok's local API at `127.0.0.1:4040`, and gives that exact URL to the server as its allowed origin.

Free plan limits: **1 GB of transfer and 20,000 HTTP requests per month**, plus an interstitial **warning page** the first time someone opens the link in a browser: they click **Visit Site** once. The launcher's own health checks send the `ngrok-skip-browser-warning` header. The warning page applies to browser page loads; the WebSocket is expected to work after the click, but this has not been checked live yet (note it if it fails for a friend).

For a link that never changes, reserve your free dev domain in the ngrok dashboard and run `NGROK_DOMAIN=<name>.ngrok-free.dev pnpm play --tunnel ngrok`.

## What friends see

The same game at the trycloudflare address. Online play works with no configuration because the page and the game server share one address (the client connects to `wss://<same host>/ws`).

## Limits

- It works **only while your laptop is awake and the command is running.** Closing the lid sleeps the laptop; `pnpm play` keeps it awake otherwise (macOS).
- **Ctrl+C, a crash or a restart drops every live game.** Rooms live in memory.
- **The link changes every run.** Old invite links stop working.
- Quick tunnels are best effort, with no uptime promise from Cloudflare.
- Cloudflare's tunnel needs outbound **port 7844**, which many networks block; that is why the SSH tunnels are tried next. If none work, `pnpm play` stops and lists why (try another network or ngrok). A `~/.cloudflared/config.yml` file can also stop cloudflared quick tunnels from starting.

## Safety

- The link is **public while the command runs**: anyone who has it can open the game. Games are private by invite code, and mines never leave the server before the game ends (same as everywhere).
- The server listens on `127.0.0.1` only, so nothing on your network can reach it except through the tunnel.
- WebSocket connections must come from the tunnel's own address (or localhost). The launcher passes the new address to the server on each run; no list to edit.
- Limits: 200 rooms in total, the usual per-connection rate limit, and per-IP caps of 30 rooms and 100 connections. With Cloudflare the real visitor address (`CF-Connecting-IP`, trusted only from your own machine) is used, so each friend has their own cap. The other tunnels' headers are not trusted, so all visitors share one cap; that is fine for a group of friends.
- Logs contain event names and counts only: no IPs, seat tokens, invite codes or links. The tunnel tools' own output is hidden unless you pass `--verbose`.

## Troubleshooting

- **"cloudflared is not installed"** in the list: fine, the next tunnel is tried. `brew install cloudflared` if you want it as first choice.
- **"Port 8080 is busy"**: stop the other program, or `PLAY_PORT=8099 pnpm play`.
- **"No public tunnel worked"**: your network blocks them all. Try another network or a phone hotspot, or set up ngrok; run with `--verbose` to see why each failed.
- **Friend sees an error page (for example 530)**: the tunnel dropped, or Pinggy's 60 minutes ended. Stop and run `pnpm play` again; you get a new link.

Hosting on Fly.io and Vercel instead is still set up for later: see [DEPLOY.md](DEPLOY.md).
