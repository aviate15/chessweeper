# Deploying Chessweeper

> **Not in use right now.** Games currently run from a laptop through a free tunnel: see [PLAY_ONLINE.md](PLAY_ONLINE.md). This guide is kept for when the project moves to real hosting.

Two pieces: the game server on **Fly.io** (`chessweeper-server`, region `sin`) and the web client on **Vercel**. Every command below is one you run yourself; nothing here needs to be committed with secrets.

Names used below (change them everywhere if you pick different ones):

- Fly app: `chessweeper-server` → server URL `https://chessweeper-server.fly.dev`, WebSocket URL `wss://chessweeper-server.fly.dev`.
- Vercel domain: `https://<your-app>.vercel.app` (you learn it in step 2).

If `chessweeper-server` is already taken on Fly, pick another name, then update `app` in `fly.toml`, the `connect-src` host in `apps/web/vercel.json`, and `VITE_SERVER_URL`.

## 0. Before you start

```sh
brew install flyctl          # or: curl -L https://fly.io/install.sh | sh
fly auth login               # opens the browser
```

Make sure `main` has the M13 PR merged (or deploy from the branch for a first try), and `pnpm check` is green.

## 1. Server on Fly.io

Run from the repo root (`fly.toml` lives there and the Docker build context is the root).

```sh
# Create the app from the committed fly.toml without deploying yet.
fly launch --no-deploy --copy-config --name chessweeper-server --region sin
# Answer "No" if it offers a Postgres/Redis/Sentry. Keep the existing fly.toml.

# Stage the allowed origin. You do not know the Vercel domain yet, so use a placeholder now
# and fix it in step 3. Secrets are set only here, never in a file.
fly secrets set ALLOWED_ORIGINS=https://placeholder.invalid --stage

# Deploy exactly one machine (rooms are in memory; two machines would split players).
fly deploy --ha=false
fly scale count 1

# Check it.
fly status
fly logs
curl -i https://chessweeper-server.fly.dev/healthz     # expect 200 and "ok"
```

`fly.toml` already disables auto-stop, so the machine stays up. TLS is terminated by Fly; the server speaks plain ws behind it and reads `Fly-Client-IP` because `TRUST_PROXY=1`.

## 2. Web on Vercel

1. Vercel dashboard → **Add New… → Project** → import the GitHub repo.
2. **Root Directory**: `apps/web`. Leave "Include source files outside of the Root Directory" **on**.
3. Framework Preset: Vite (also set by `apps/web/vercel.json`, which supplies the install/build commands, the SPA fallback so `?join=CODE` links work, and security headers).
4. **Environment Variables** (Production and Preview):
   - `VITE_SERVER_URL` = `wss://chessweeper-server.fly.dev`
   - `ENABLE_EXPERIMENTAL_COREPACK` = `1` (so Vercel uses the pnpm version pinned in `package.json`)
5. Settings → General → **Node.js Version**: 24.x.
6. Deploy. Note the production domain, e.g. `https://chessweeper.vercel.app`.

`VITE_SERVER_URL` is baked in at build time: if you change it, redeploy the web app.

## 3. Wire them together

Allow the real web origin on the server. Exact origin, `https`, no trailing slash; comma separated for several (for example a custom domain too). This restarts the machine and drops live games.

```sh
fly secrets set ALLOWED_ORIGINS=https://<your-app>.vercel.app
fly status        # machine restarted and healthy
```

Vercel **preview** deployments have different URLs and are refused by the server unless you add them to `ALLOWED_ORIGINS`. That is intentional; only production can play online by default.

If you used a different Fly app name, also update `connect-src` in `apps/web/vercel.json` and redeploy the web app.

## 4. Smoke check

```sh
pnpm install
pnpm --filter @chessweeper/server smoke -- \
  --server https://chessweeper-server.fly.dev \
  --web https://<your-app>.vercel.app
```

It checks `/healthz`, the web app and its SPA fallback and headers, that the web bundle points at the Fly server, that a foreign Origin is refused, and that two clients can create, join and resign a throwaway game without any mine data in the frames. Add `--wait-close` to also wait about 2 minutes and confirm a finished room is freed. Exit code 0 means everything passed.

Then open the site in two browser windows and play a real game: Game → Online… → Create game, copy the link into the second window.

## 5. Rolling back

**Server** (Fly keeps every release):

```sh
fly releases                       # list versions; note the last good one
fly releases --image               # shows the image reference per release
fly deploy --image <registry.fly.io/chessweeper-server:deployment-XXXX> --ha=false
```

A bad `ALLOWED_ORIGINS` is fixed with `fly secrets set ...` again (no rebuild).

**Web**: Vercel dashboard → Project → **Deployments** → open the last good deployment → **… → Promote to Production** (instant, no rebuild). If the problem is `VITE_SERVER_URL`, fix the variable and redeploy.

## 6. Operating notes

- **Restarts end live games.** Rooms live in memory. Every `fly deploy`, secret change or crash drops all games, so deploy when nobody is playing.
- **Rooms are freed 2 minutes after a game ends** (`FINISHED_ROOM_MS`), 5 minutes after everyone leaves, and 30 minutes after the last activity.
- **Limits** (all optional env vars, positive integers; set with `fly secrets set` or in `fly.toml` `[env]`): `MAX_ROOMS_PER_IP` (default 30 live rooms per IP), `MAX_CONNS_PER_IP` (100), `MAX_ROOMS` (1000 in total), `FINISHED_ROOM_MS` (120000). The per-IP values are generous so friends on shared wifi are fine; tighten them if you see abuse.
- **Logs** hold event names and counts only: no IPs, seat tokens, invite codes or origins. `fly logs` is safe to paste.
- **Cost/size**: one `shared-cpu-1x` with 256 MB is plenty for hundreds of rooms.
- Never commit real values. `.env.example` files list the variables; real values live in `fly secrets` and Vercel's dashboard.
