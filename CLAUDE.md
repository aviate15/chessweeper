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
Fill this in once the scaffold exists: install, dev, test, lint, typecheck, build.
