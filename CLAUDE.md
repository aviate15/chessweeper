# Chessweeper

Chess + Minesweeper web game. Hidden mines, public numbers, private flags, kings with 3 lives. Multiplayer (online and local pass-and-play). Old-school Windows Minesweeper look.

Game rules: @docs/GAME_DESIGN.md

## Working agreement

- `docs/GAME_DESIGN.md` is the single source of truth for mechanics. Never invent, change, or "fix" a rule on your own.
- If a rule is missing, ambiguous, or seems wrong, stop and ask me. Offer 2-3 options with tradeoffs. Once I decide, record it in the design doc before coding it.
- I (Aviate) co-design everything: mechanics, UI/UX, visuals. Propose, don't decide, on design questions.
- Do not write game logic or UI until I have approved the design doc and your architecture plan.
- Use plan mode for anything non-trivial. Ask before large or irreversible changes.

## Architecture

- Monorepo, pnpm workspaces, TypeScript everywhere (strict mode).
- `packages/engine`: pure rules engine. No DOM, no network, no clock. RNG is injected (seedable in tests, cryptographically random in production).
- `apps/server`: Node + `ws` WebSocket server. Server-authoritative. Mine positions never leave the server; clients only receive revealed numbers, craters, and their own flags.
- `apps/web`: browser client. Local pass-and-play runs the engine in the browser.
- Flags are private per player. Numbers and craters are public.

## Conventions

- Work on branches, make small commits, open PRs with `gh`. Never push to main.
- Every engine rule has a unit test (Vitest) that names its design-doc section, e.g. `// 3.4 check exception`.
- Before saying work is done: tests, lint, and typecheck all pass.
- After any change under `packages/engine`, run the `rules-auditor` subagent.
- Visual style: authentic old-school Windows Minesweeper (beveled gray panels, pixel art, LED counters, pixel typeface). No modern UI defaults.

## Commands

Node 24 (`.nvmrc`; >=22 works), pnpm 12. Run from the repo root.

- `pnpm install`: install all workspace dependencies.
- `pnpm test`: run every Vitest project once (`pnpm test:watch` to watch).
- `pnpm --filter @chessweeper/engine test`: test a single package.
- `pnpm --filter @chessweeper/engine perft:deep`: opt-in deep perft (slow; not run in CI).
- `pnpm lint`: ESLint (strict type-checked; engine purity rules).
- `pnpm typecheck`: `tsc --noEmit` for root configs and every package.
- `pnpm format` / `pnpm format:check`: Prettier.
- `pnpm check`: format:check, lint, typecheck and test. Must pass before saying work is done.
- `pnpm build`: build packages that define a build script (none yet).
- Dev servers (online play): `pnpm --filter @chessweeper/server dev` (ws://localhost:8080, allows the Vite dev origin) and `pnpm --filter @chessweeper/web dev` (http://localhost:5173). Open two browser windows to play. Set `VITE_SERVER_URL` for a non-default server; production builds need it for Online... to be enabled.
- `pnpm play`: build, serve the game and web app from this machine and share it with a free Cloudflare quick tunnel (`--local` for no tunnel, `--verbose` for cloudflared's log). See `docs/PLAY_ONLINE.md`.
- Deploy (kept for later): `docs/DEPLOY.md`. `pnpm --filter @chessweeper/server build` bundles the server to `dist/main.js` (`start` runs it); `pnpm --filter @chessweeper/server smoke -- --server <url> --web <url>` is the post-deploy check.
- `pnpm --filter @chessweeper/web e2e`: builds the client against a local server and runs Playwright, including the two-player online test.

Hooks in `.claude/settings.json` auto-format edited files and block `git commit` when typecheck fails.
