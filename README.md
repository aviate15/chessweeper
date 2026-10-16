# Chessweeper

Chess meets Minesweeper. Mines hide on the board, landing on a square reveals how many mines surround it, and pieces that step on a mine blow up. Kings have three lives. Numbers are public, flags are private, and every few turns (6 by default) without a capture the mines reshuffle. Online and local pass-and-play, in an old-school Windows Minesweeper look.

Status: playable. Local pass-and-play and online two-player games (lobby, invite links, reconnect) work; play with friends from your laptop via [`docs/PLAY_ONLINE.md`](docs/PLAY_ONLINE.md); Fly.io and Vercel config is kept in [`docs/DEPLOY.md`](docs/DEPLOY.md). Rules live in [`docs/GAME_DESIGN.md`](docs/GAME_DESIGN.md).

## Quickstart

Requires Node 24 (see `.nvmrc`) and pnpm.

```sh
pnpm install
pnpm check   # format check, lint, typecheck, tests
pnpm --filter @chessweeper/web dev   # play local pass-and-play in the browser
```

## Playing

- A rules page opens on first load. Reopen it any time from **Help → Rules** or the **?** button.
- A revealed number counts the mines in the 8 neighbouring squares. Hover or focus a number to see what it counts and which landing revealed it. When a piece stands on a numbered square the number shows in a small corner badge.
- **Game → New game...** sets the reshuffle interval (default 6 turns) and mine density (default 30%) for the new game. Online, the creator picks them in the Create game dialog and both players see them.
- Right-click (or the flag button) places private flags. Sound and board flipping are toggles in the Game menu.

## Play online with friends

One command runs the server on your laptop and shares it through a free public tunnel (Cloudflare, or SSH-based fallbacks for networks that block it; no account, no cost): `pnpm play`. Steps and limits are in [`docs/PLAY_ONLINE.md`](docs/PLAY_ONLINE.md).

## Deploying (later)

Server on Fly.io, web on Vercel. Step-by-step commands, rollback and a post-deploy smoke check are in [`docs/DEPLOY.md`](docs/DEPLOY.md).

## Layout

- `packages/engine`: pure TypeScript rules engine (no DOM, network or clock).
- `packages/protocol`: wire protocol shared by server and client.
- `apps/server`: server-authoritative WebSocket game server.
- `apps/web`: browser client (Vite + React): local pass-and-play, retro pixel skin, sound and animations.
- `docs/GAME_DESIGN.md`: the rules (single source of truth). `docs/IDEAS.md`: parked ideas that are not in the current rules.

## License

MIT
