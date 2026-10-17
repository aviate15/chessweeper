# Chessweeper

Chess meets Minesweeper. Mines hide on the board, landing on a square reveals how many mines surround it, and pieces that step on a mine blow up. Kings have three lives. Numbers are public, flags are private. Play locally (pass-and-play) or online with a friend, in an old-school Windows Minesweeper look.

Rules live in [`docs/GAME_DESIGN.md`](docs/GAME_DESIGN.md), the single source of truth.

## Two modes

- **Auto mine** (default): the game places the mines at random, about 30% of the free squares. Every **6 turns** (both players counted together) without a capture, the mines are reshuffled. A capture restarts the count.
- **Manual mine**: the players place the mines for each other. Before play and after every reshuffle, each player secretly places up to their quota on empty squares (5 each at the default density). Online there is a 20-second timer; locally White places, the device is handed over, then Black places. A square both players mark is a big mine that counts double and blasts the 3x3 area around it. The mines reshuffle (a new placement round) every **10 turns** regardless of captures.

Both settings (turns between reshuffles, mine density) are chosen per game in **Game → New game...** or, online, in the Create game dialog; both players can see them. Details: sections 3.7, 3.9 and 3.10 of the design doc.

## Play

Needs Node 24 (see `.nvmrc`; 22 or newer works) and [pnpm](https://pnpm.io/installation). Run everything from the repo root.

### On your own machine (solo or pass-and-play)

```sh
pnpm install
pnpm play --local
```

Then open <http://localhost:8080>. The first run builds the game, which takes a moment. Set `PLAY_PORT=<other port>` to use another port.

- **Auto mine:** the game hides the mines for you. Just play.
- **Manual mine:** you and your opponent place mines for each other. Locally, White places, hands the device over, then Black places.

### Host an online game for friends

You need a free [ngrok](https://ngrok.com) account and **your own authtoken** (dashboard.ngrok.com). Never put a token or a personal domain in the repo.

One-time setup (macOS with Homebrew):

```sh
brew install ngrok
ngrok config add-authtoken <YOUR_TOKEN>   # your own token; keep it private
```

Every time you host:

```sh
pnpm play
```

Share the printed public link (it is also copied to your clipboard). In the game choose **Game → Online... → Create game**, then send your friend the link or the code. The first time your friend opens an ngrok link they see a warning page and click **Visit Site** once.

Without ngrok, `pnpm play` tries Cloudflare, then Pinggy, then localhost.run, and uses the first that works. Fallbacks you can force:

- `pnpm play --tunnel pinggy`: free, no account, but the link ends after 60 minutes (restart for a new one).
- `pnpm play --local`: no tunnel, only this machine.

Notes:

- ngrok's free plan allows 1 GB of transfer and 20,000 requests per month.
- Your laptop must stay awake and online while you host. On macOS `pnpm play` already runs `caffeinate`; running `caffeinate -dims` yourself also works.
- Ctrl+C or closing the lid ends every live game, and each run gets a new link.

Troubleshooting:

- **ngrok can't connect (strict wifi):** switch to a phone hotspot or another network, or try `--tunnel pinggy`.
- **Origin or "not allowed" errors:** the server only accepts the exact public link the launcher passed it. Restart `pnpm play` and use the new link; old links never work again.
- **"Port 8080 is busy":** run `PLAY_PORT=<other port> pnpm play`.

More detail in [`docs/PLAY_ONLINE.md`](docs/PLAY_ONLINE.md). Fly.io and Vercel hosting config exists in [`docs/DEPLOY.md`](docs/DEPLOY.md); it is optional and not used for now.

## Playing

- A rules page opens on first load. Reopen it from **Help → Rules** or the **?** button.
- A revealed number counts the mines in the 8 neighbouring squares. Hover or focus a number to see what it counts.
- Right-click (or the flag button) places private flags. Sound and board flipping are toggles in the Game menu.
- **Game → Online...** opens the lobby: create a game and share the code or link, or join with a code.

## Tests and contributing

```sh
pnpm check   # format check, lint, typecheck and all tests (run this before a PR)
pnpm test    # Vitest only
pnpm --filter @chessweeper/web dev   # Vite dev server, http://localhost:5173 (pass-and-play only)
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
