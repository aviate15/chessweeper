# Chessweeper

Chess meets Minesweeper. Mines hide on the board, landing on a square reveals how many mines surround it, and pieces that step on a mine blow up. Kings have three lives. Numbers are public, flags are private, and every 8 turns without a capture the mines reshuffle. Online and local pass-and-play, in an old-school Windows Minesweeper look.

Status: early development. Local pass-and-play works in the browser; the online server exists but has no web lobby yet. Rules live in [`docs/GAME_DESIGN.md`](docs/GAME_DESIGN.md).

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
- **Game → Options** sets the reshuffle interval (default 8 turns) and mine density (default 25%). Changes apply at the next New game.
- Right-click (or the flag button) places private flags. Sound and board flipping are toggles in the Game menu.

## Layout

- `packages/engine`: pure TypeScript rules engine (no DOM, network or clock).
- `packages/protocol`: wire protocol shared by server and client.
- `apps/server`: server-authoritative WebSocket game server.
- `apps/web`: browser client (Vite + React): local pass-and-play, retro pixel skin, sound and animations.
- `docs/GAME_DESIGN.md`: the rules (single source of truth). `docs/IDEAS.md`: parked ideas that are not in the current rules.

## License

MIT
