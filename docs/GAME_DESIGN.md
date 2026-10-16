# Chessweeper: Game Design (living document)

This file is the single source of truth for game rules. Claude Code must not invent or change mechanics; it proposes options and records decisions here.

**Status key:** `[D]` decided · `[T]` tentative (assumed, needs confirmation) · `[Q]` open question · `[I]` idea / parked

Last updated: 2026-10-16

---

## 1. Vision

Chess meets Minesweeper. Mines are hidden on the board. Placing pieces reveals numbers, and things blow up.

### Design pillars
- **Tension and progress for both sides.** Danger is shared; nobody gets a free ride.
- **Guessing and deduction, not chaos.** Mines are sparse: enough to keep players guessing.
- **Minesweeper skill is tested.** Numbers are public, flags are private.
- **Danger never runs out.** Concern: if the mines in ranks 3-6 get exhausted, the game becomes plain chess. The full reset every 10 turns keeps danger alive and keeps covering new positions as the game moves on.
- **The game keeps moving.** The reshuffle doubles as an anti-stall mechanism.
- **King placement is strategic.** Mined escape squares make king safety a real decision.
- **Rules are experimental.** Expect to tune after playtesting ("we can change as we experiment").

---

## 2. Project and process

- Working name: **Chessweeper**. Web game, public GitHub repo, MIT license.
- Multiplayer wanted: online play and local pass-and-play.
- AI opponent: optional, deferred. Useful for solo play and balance testing once rules are stable. `[I]`
- Visual direction: **old-school Windows Minesweeper**. Beveled gray panels, pixel art, LED-style counters, pixel typeface. Authentic retro, not a modern take.
- Goal: take it all the way to production, with Opus driving Claude Code.
- Workflow: Aviate is involved in the entire design process (game design, UI/UX, mechanics). Order of work: repo + Claude Code setup, then base prompt, then design brainstorm, then final plan. Claude Code does not write game logic or UI until the design doc is approved.

---

## 3. Rules

### 3.1 Board and mines
- `[D]` Standard chess board and pieces, plus hidden mines.
- `[D]` Mines are **sparse**: just enough to keep players guessing.
- `[D]` At the start, mines sit on ranks 3-6 only, on a sparse subset of squares. A mine is never under a piece. Ranks 1-2 and 7-8 start with no mines.
- `[T]` Starting count: about **8 mines**, which is 25% of the 32 squares in ranks 3-6. To be tuned in playtesting.
- `[D]` **Safe start**: guaranteed-safe first move(s), like Minesweeper's safe first click.
- `[T]` Default: each player's first move cannot hit a mine. If a mine sits on a first-move destination, the server moves it to another unoccupied square. Tune in playtesting.
- `[D]` Idle mines are **not part of this version** (parked, see section 5).

### 3.2 Information
- `[D]` **Complete information** for revealed data: both players see the same reveals.
- `[D]` A revealed number = count of mines in the **8 adjacent squares**.
- `[D]` Numbers are **public**.
- `[T]` **Reveal trigger**: a square's number is revealed when a piece lands on it and survives (normal Minesweeper style).
- `[T]` Only **landing** triggers mines or reveals; sliders passing over squares do nothing.
- `[D]` **No zero flood-fill**: landing on a square with a 0 reveals only that square, not its neighbors. Revisit after playtesting (could become a toggle).

### 3.3 Flags
- `[D]` Players can flag suspected mines.
- `[D]` Flags are **private**: the opponent cannot see them.
- `[D]` Flags are **only notes**: no rules effect, no limit, no penalty for wrong flags. They are cleared on a reshuffle (3.7).

### 3.4 Triggering a mine
- `[D]` A non-king piece landing on a live mine is **destroyed**. The move is wasted (no benefit) and play passes to the opponent.
- `[T]` The mine is consumed when triggered. Confirmed for kings; assumed for all pieces.
- `[D]` **Check exception**: if a piece dies on a mine and that leaves the mover's **own king** in check (e.g. a blocker explodes), the mover does not lose the turn. They must immediately make another move that resolves the check: move the king, or force some other resolving move (block or capture the checker). Original wording: "if you put a bishop somewhere and it blows up and it causes a discovered check on the king, then the king gets to move".
- `[T]` If the mover has no move that resolves the check after the explosion, that is checkmate (see 3.6).
- `[D]` The follow-up move can itself hit another mine (any landing counts), so chain reactions are possible.
- `[D]` A triggered mine leaves a public **crater** on the square. The mine is consumed, so pieces can land on a crater safely afterwards.

### 3.5 Captures and special moves
- `[D]` Normal captures never hit a mine: no mine ever sits under a piece, including after reshuffles. Only the captured piece is lost.
- `[D]` **Castling, en passant and promotion** follow standard chess rules. If any of them lands on a mine, the piece **pays the price** like any other landing.
- `[T]` Castling: the king's and the rook's destination squares can each hold a mine. A king there loses a life, the mine is consumed and it stays; a rook there is destroyed. Passing over squares triggers nothing.
- `[T]` En passant: the capturing pawn lands on the empty square behind the captured pawn. If that square is mined, the capturing pawn is destroyed; the captured pawn is still removed.
- `[T]` Promotion: if the promotion square is mined, the pawn is destroyed and does not promote.

### 3.6 Kings and game end
- `[D]` Kings have **3 lives**.
- `[D]` A king landing on a live mine loses 1 life, the **mine is consumed**, and the king **stays on that square**.
- `[D]` If the king's only escape square is mined, the king can still go there and pays a life. Strategic king placement matters.
- `[D]` **The game ends** when either (a) a king loses its last life (that king's side loses), or (b) checkmate, whichever happens first.
- `[T]` Checkmate is judged by standard chess rules and ignores hidden mines. A mined escape square still counts as an escape (the king pays a life to use it), so a king is only checkmated when it has no chess-legal move at all.
- `[D]` Stalemate is a draw, as in normal chess.

### 3.7 Reshuffle (full reset, anti-stall)
- `[D]` Every **10 total turns** (5 per player) without a capture, all mines are randomly reshuffled. This keeps the game moving. It replaces the original idea ("a mine flagged for more than 5 moves triggers a random reset"). Starting value, tunable after playtesting.
- `[D]` Placement is **truly random** and **never on an occupied square**. Mines may land on any unoccupied square, including empty squares on ranks 1-2 and 7-8.
- `[D]` After a reshuffle the mine count is **25% of the free (unoccupied) squares at that moment**. At the start of the game that is 8 (25% of 32), and it grows denser as pieces leave the board, matching "mines everywhere in the endgame". Not just the survivors from before.
- `[D]` A reshuffle **re-hides all revealed numbers** and **clears all private flags**.
- `[T]` Default rounding: round to the nearest whole mine. No cap at first; if endgames get too brutal, add one. `[I]`
- `[Q]` Do craters stay after a reshuffle? Recommendation: clear them, since old craters would be stale information.

### 3.8 Turn resolution (draft, derived from the rules above)
1. Mover plays a chess-legal move. Hidden mines are ignored for legality.
2. Destination: if it holds a live mine, the piece is destroyed (a king loses a life and stays) and the mine is consumed. Otherwise the piece survives and the square's number is revealed.
3. Check is evaluated, with the exception in 3.4.
4. The no-capture counter updates (a capture resets it); a reshuffle fires at 10 turns.

---

## 4. Open questions (priority order)
1. `[Q]` Confirm the special-move details in 3.5 (castling, en passant, promotion).
2. `[Q]` Craters after a reshuffle (3.7).
3. `[Q]` UI/UX brainstorm (section 6).
4. `[Q]` UI framework (Vite + React vs plain canvas): Claude Code proposes in plan mode, Aviate approves (section 7).
5. `[T]` Tuning defaults (safe start, rounding, cap): confirm in playtesting.

---

## 5. Parked: idle mines
Parked on 2026-10-16. Aviate is unsure of the mechanics, and the 10-turn full reset already covers new positions as the game goes on. The full spec is kept here in case we revive it after playtesting. None of it applies to the current version.

- Idea: each side's last two ranks (1-2 and 7-8) hold **idle mines** on a sparse subset of squares, under starting pieces. They are dormant and **arm** (become live) when the piece standing on them leaves. Purpose: danger grows toward the endgame ("mines everywhere"), and the board never runs out of mines.
- Capture on an idle mine: the mine arms under the capturer and detonates immediately. The captured piece is removed, the capturer is destroyed (a king capturer loses a life and stays), the mine is consumed. A deliberate suspense mechanic and a forced trade.
- Dormant idle mines would count in neighbors' numbers, so players can deduce booby-trapped back-rank pieces. Numbers would not change when a mine arms.
- Reshuffle would treat dormant idle mines as untouched (they sit under pieces) and relocate only live ones.
- Variant: idle mines also arm on a timer, not only when the piece leaves.
- Open if revived: do armed idle mines count toward the reshuffle total, or are they extra?

---

## 6. UI/UX (to brainstorm together, nothing decided)
- Retro look: beveled gray panels, pixel art, LED counters, pixel typeface. Possible building blocks: 98.css for bevels, a 7-segment font for counters.
- Topics: how numbers and pieces share a square; how flags are placed on desktop and mobile; what the LED counters show (flags left? mines left? turns until reshuffle?); explosion and king-life feedback; reshuffle animation; lobby and online flow.

---

## 7. Build setup (in progress)
- Repo: `gh repo create chessweeper --public --clone --license mit --gitignore Node`, then `claude`, Opus in plan mode. Run `/init` after the scaffold exists, so it picks up real commands.
- Setup kit files: `CLAUDE.md` (imports `docs/GAME_DESIGN.md`) and `.claude/agents/rules-auditor.md`.
- Plugins: `frontend-design`, `commit-commands`, a TypeScript code-intelligence plugin; optional `code-review`.
- MCP: Playwright, project scope (`claude mcp add --scope project playwright -- npx -y @playwright/mcp@latest`).
- Hooks: format/lint after edits; typecheck before commits. Subagent: read-only rules auditor that checks the engine against this file. Permission allowlist for routine `npm`/`git`/`gh`.
- CLAUDE.md rule: mechanics live in `docs/GAME_DESIGN.md`; never invent rules; ask first.
- `[D]` Architecture: server-authoritative hidden state; one pure TypeScript rules engine shared by server and browser; pnpm-workspaces monorepo with TypeScript everywhere (`packages/engine`, `apps/web`, `apps/server`).
- `[D]` Hosting (delegated to Claude by Aviate): small Node + `ws` WebSocket server on Fly.io; static web client on Cloudflare Pages or Vercel, final pick at deploy time.
- Custom rules engine likely needed: destruction, lives and reshuffles conflict with off-the-shelf chess legality libraries.

---

## 8. Change log
- 2026-10-16: Flags are notes only. Exploded mines leave a public crater, safe to land on afterwards. Tech: pnpm monorepo, TypeScript, Node + `ws` on Fly.io. Tuning defaults added (tentative). Setup kit created.
- 2026-10-16: Locked: reshuffle count = 25% of free squares; no zero flood-fill; stalemate is a draw; the follow-up move after an explosion can hit another mine.
- 2026-10-16: Idle mines parked (section 5). Castling, en passant and promotion are standard; landing on a mine costs the piece. Rules, turn resolution and pillars updated to match.
- 2026-10-16: Reshuffle: 10 total turns, mine count restored, any unoccupied square eligible, flags cleared. Starting active mines about 8 (25% of ranks 3-6).
- 2026-10-16: Game ends on king death (0 lives) or checkmate, whichever comes first. Reshuffle starts at N = 10.
- 2026-10-16: Confirmed the check exception (own king, must resolve check with another move). Confirmed idle mines count in numbers (now parked).
- 2026-10-16: Reorganized into sections. Added all earlier points (pillars, process, visuals, multiplayer, AI deferral). Decided: idle-capture detonates the capturer, reshuffle re-hides numbers, move-wasted meaning, landing reveals (tentative).
- 2026-10-16: Initial draft from design chat.
