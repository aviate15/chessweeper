# Chessweeper

Chess meets Minesweeper. Mines hide on the board, landing on a square reveals how many mines surround it, and pieces that step on a mine blow up. Kings have three lives. Numbers are public, flags are private, and every 6 turns without a capture the mines reshuffle. Online and local pass-and-play, in an old-school Windows Minesweeper look.

Status: early development. Rules live in [`docs/GAME_DESIGN.md`](docs/GAME_DESIGN.md).

## Quickstart

Requires Node 24 (see `.nvmrc`) and pnpm.

```sh
pnpm install
pnpm check   # format check, lint, typecheck, tests
```

## Layout

- `packages/engine`: pure TypeScript rules engine (no DOM, network or clock).
- `packages/protocol`: wire protocol shared by server and client.
- `apps/server`: server-authoritative WebSocket game server.
- `apps/web`: browser client (coming later).

## License

MIT
