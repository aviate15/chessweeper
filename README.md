# Chessweeper

Chess meets Minesweeper. Mines hide on the board, landing on a square reveals how many mines surround it, and pieces that step on a mine blow up. Kings have three lives. Numbers are public, flags are private. Play locally (pass-and-play) or online with a friend, in an old-school Windows Minesweeper look.

Rules live in [`docs/GAME_DESIGN.md`](docs/GAME_DESIGN.md), the single source of truth.

## Two modes

- **Auto mine** (default): the game places the mines at random, about 30% of the free squares. Every **6 turns** (both players counted together) without a capture, the mines are reshuffled. A capture restarts the count.
- **Manual mine**: the players place the mines for each other. Before play and after every reshuffle, each player secretly places up to their quota on empty squares (5 each at the default density). Online there is a 20-second timer; locally White places, the device is handed over, then Black places. A square both players mark is a big mine that counts double and blasts the 3x3 area around it. The mines reshuffle (a new placement round) every **10 turns** regardless of captures.

Both settings (turns between reshuffles, mine density) are chosen per game in **Game → New game...** or, online, in the Create game dialog; both players can see them. Details: sections 3.7, 3.9 and 3.10 of the design doc.

## Quickstart

Requires Node 24 (see `.nvmrc`; 22 or newer works) and pnpm.

```sh
pnpm install
pnpm --filter @chessweeper/web dev   # local pass-and-play at http://localhost:5173
```

## Playing

- A rules page opens on first load. Reopen it from **Help → Rules** or the **?** button.
- A revealed number counts the mines in the 8 neighbouring squares. Hover or focus a number to see what it counts.
- Right-click (or the flag button) places private flags. Sound and board flipping are toggles in the Game menu.
- **Game → Online...** opens the lobby: create a game and share the code or link, or join with a code.

## Play online with friends

`pnpm play` builds the game, serves it from your machine and shares it through a free public tunnel (ngrok if configured, else Cloudflare, Pinggy or localhost.run; `--tunnel <name>` forces one, `--local` skips the tunnel). No account is needed except for ngrok. Steps and limits are in [`docs/PLAY_ONLINE.md`](docs/PLAY_ONLINE.md).

Fly.io and Vercel hosting config exists in [`docs/DEPLOY.md`](docs/DEPLOY.md). It is optional and not used for now.

## Tests and contributing

```sh
pnpm check   # format check, lint, typecheck and all tests (run this before a PR)
pnpm test    # Vitest only
pnpm --filter @chessweeper/web e2e   # Playwright, including a two-player online game
```

Work on a branch and open a PR; never push to `main`. Every engine rule has a unit test that names its design-doc section (for example `// 3.4 check exception`). Rule changes are recorded in `docs/GAME_DESIGN.md` before they are coded.

## Layout

- `packages/engine`: pure TypeScript rules engine (no DOM, network or clock).
- `packages/protocol`: wire protocol shared by server and client.
- `apps/server`: server-authoritative WebSocket game server. Mine positions never leave it during play.
- `apps/web`: browser client (Vite + React): retro pixel skin, sound and animations.
- `docs/`: design doc, ideas (parked), online-play and deploy guides.

## License

MIT
