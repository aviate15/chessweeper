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
- `[T]` Starting count: `mineDensity` × 32 squares of ranks 3-6, using the same rounding and cap as 3.7. With the default `mineDensity = 0.25` that is **8 mines**.
- `[D]` **Safe start**: each player's first move of the game cannot hit a mine, like Minesweeper's safe first click.
- `[D]` Safe start uses **lazy relocation**: only the square the first move actually lands on is protected. If it holds a mine, the server moves that mine before the landing resolves. Players never see the relocation. (Protecting every possible first-move destination is impossible: White's and Black's first moves together reach all 32 squares of ranks 3-6.)
- `[D]` The relocated mine goes to a uniformly random free square on ranks 3-6 that is **not adjacent to any revealed square**, so no number already on the board changes.
- `[D]` Safe start applies only to each side's first move of the game, never after a reshuffle. A relocation is not a reshuffle and does not affect the reshuffle counter.
- `[D]` Idle mines are **not part of this version** (parked, see section 5).

### 3.2 Information
- `[D]` **Complete information** for revealed data: both players see the same reveals.
- `[D]` A revealed number = count of mines in the **8 adjacent squares**.
- `[D]` Numbers are **live**: a revealed number always shows the current count of adjacent live mines, so it goes down when a neighboring mine is consumed.
- `[D]` Numbers are **public**.
- `[D]` **Reveal trigger**: a square's number is revealed when a piece lands on it and survives (normal Minesweeper style). This includes captures, both castling destinations, en passant and promotion.
- `[D]` A revealed number **stays visible until the next reshuffle**, even after the piece leaves the square.
- `[D]` Starting squares (ranks 1-2 and 7-8) start **hidden**. They are revealed only by a later landing.
- `[D]` Only **landing** triggers mines or reveals; sliders passing over squares do nothing.
- `[D]` Public meta-information: the **live mine count**, **turns until the next reshuffle**, and both kings' **lives**.
- `[D]` **No zero flood-fill**: landing on a square with a 0 reveals only that square, not its neighbors. Revisit after playtesting (could become a toggle).

### 3.3 Flags
- `[D]` Players can flag suspected mines.
- `[D]` Flags are **private**: the opponent cannot see them.
- `[D]` Flags are **only notes**: no rules effect, no limit, no penalty for wrong flags. They are cleared on a reshuffle (3.7).

### 3.4 Triggering a mine
- `[D]` A non-king piece landing on a live mine is **destroyed**. The move is wasted (no benefit) and play passes to the opponent.
- `[D]` The mine is consumed when triggered, for every piece type.
- `[D]` **Check exception**: if a piece dies on a mine and that leaves the mover's **own king** in check (e.g. a blocker explodes), the mover does not lose the turn. They must immediately make another move that resolves the check: move the king, or force some other resolving move (block or capture the checker). Original wording: "if you put a bishop somewhere and it blows up and it causes a discovered check on the king, then the king gets to move".
- `[T]` If the mover has no move that resolves the check after the explosion, that is checkmate (see 3.6).
- `[D]` The follow-up move can itself hit another mine (any landing counts), so chain reactions are possible.
- `[D]` The explosion and all its follow-up moves form **one turn** (one tick of the reshuffle counter).
- `[D]` A triggered mine leaves a public **crater** on the square. The mine is consumed, so pieces can land on a crater safely afterwards.

### 3.5 Captures and special moves
- `[D]` Normal captures never hit a mine: no mine ever sits under a piece, including after reshuffles. Only the captured piece is lost.
- `[D]` **Castling, en passant and promotion** follow standard chess rules. If any of them lands on a mine, the piece **pays the price** like any other landing.
- `[D]` Castling: the king's and the rook's destination squares can each hold a mine. A king there loses a life, the mine is consumed and it stays; a rook there is destroyed. Passing over squares triggers nothing.
- `[D]` If the castling rook is destroyed, the check exception (3.4) applies as for any piece. Note: this case is **unreachable**. The rook's destination (f1/d1) only shields the king along the back rank. Any attacker that could use that line would already have attacked the king's start square (e1), which makes castling illegal. A blocked line stays blocked.
- `[D]` En passant: the capturing pawn lands on the empty square behind the captured pawn. If that square is mined, the capturing pawn is destroyed; the captured pawn is still removed.
- `[D]` Promotion: if the promotion square is mined, the pawn is destroyed and does not promote.

### 3.6 Kings and game end
- `[D]` Kings have **3 lives**.
- `[D]` A king landing on a live mine loses 1 life, the **mine is consumed**, and the king **stays on that square**.
- `[D]` If the king's only escape square is mined, the king can still go there and pays a life. Strategic king placement matters.
- `[D]` **The game ends** when either (a) a king loses its last life (that king's side loses), or (b) checkmate, whichever happens first.
- `[D]` **Precedence**: landings resolve before check is evaluated. If a move costs the mover's king its last life, the mover loses, even if the same move would have checkmated the opponent.
- `[D]` Checkmate is judged by standard chess rules and ignores hidden mines. A mined escape square still counts as an escape (the king pays a life to use it), so a king is only checkmated when it has no chess-legal move at all.
- `[D]` A king on 1 life follows normal chess rules. It may step onto any unrevealed square at its own risk.
- `[D]` Stalemate is a draw, as in normal chess.
- `[D]` **No other automatic draws**: no threefold repetition, no 50-move rule, no insufficient-material draw.
- `[D]` Players can **resign** or **offer a draw** (the opponent accepts or declines).
- `[D]` **No clocks** in v1.
- `[D]` Online disconnect: the disconnected player has a **60-second grace period** to reconnect. After that the opponent may claim the win.

### 3.7 Reshuffle (full reset, anti-stall)
- `[D]` Every **10 total turns** (5 per player) without a capture, all mines are randomly reshuffled. This keeps the game moving. It replaces the original idea ("a mine flagged for more than 5 moves triggers a random reset"). Starting value, tunable after playtesting.
- `[D]` The counter starts at 0 at game start and resets to 0 after each reshuffle. Only a capture resets it otherwise. A turn with an explosion counts as a normal turn and does not reset it.
- `[D]` **Timing**: the reshuffle fires at the very end of a turn, after the whole check-exception chain and the game-end checks, and only if the game continues.
- `[D]` Placement is **truly random**: uniform over all unoccupied squares, with no exclusions (not even near kings). Never on an occupied square. Mines may land on empty squares on ranks 1-2 and 7-8.
- `[D]` After a reshuffle the mine count is **`mineDensity` × the free (unoccupied) squares at that moment**, rounded **half-up** (e.g. 7.5 → 8), then capped at `mineCap` if one is set. It grows denser as pieces leave the board, matching "mines everywhere in the endgame". Not just the survivors from before.
- `[T]` Tunable config values: `mineDensity = 0.25`, `mineCap = none`. Add a cap if endgames get too brutal.
- `[D]` A reshuffle **re-hides all revealed numbers**, **clears all craters** (mines moved, so old craters would be stale) and **clears all private flags**.

### 3.8 Turn resolution (derived from the rules above)
1. Mover plays a chess-legal move. Hidden mines are ignored for legality. During a check-exception follow-up, the move must resolve the check.
2. Safe start (3.1): on a side's first move of the game, a mine on the landing square is relocated first.
3. Pieces move; a captured piece is removed.
4. Each landing square (two for castling): if it holds a live mine, the piece is destroyed (a king loses a life and stays), the mine is consumed and a crater is left. Otherwise the piece survives and the square's number is revealed. Revealed numbers stay live.
5. If a king reaches 0 lives, the game ends and that side loses (3.6 precedence).
6. If an explosion left the mover's own king in check, the same side moves again (3.4). This is still the same turn: go back to step 1. No resolving move = checkmate.
7. Otherwise the turn passes. Check, checkmate and stalemate are evaluated for the opponent.
8. End of turn: the no-capture counter updates (a capture resets it). At 10 turns a reshuffle fires, if the game continues.

---

## 4. Open questions (priority order)
1. `[Q]` UI/UX brainstorm (section 6).
2. `[T]` Tuning in playtesting: `mineDensity`, `mineCap`, the reshuffle interval (10 turns), the 3 king lives.

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
- `[D]` UI framework: Vite + React, rendered with DOM/CSS and hand-rolled bevels. Add a canvas overlay only if an animation needs it.
- Custom rules engine likely needed: destruction, lives and reshuffles conflict with off-the-shelf chess legality libraries.

---

## 8. Change log
- 2026-10-16: Design-gap audit resolved. Safe start is now lazy relocation of the landed-on square's mine, to a free square on ranks 3-6 not next to a revealed square, first move only (the old "any first-move destination" wording was impossible). Numbers are live and persist until a reshuffle; starting squares start hidden; mine count, reshuffle countdown and lives are public. Explosion plus follow-ups = one turn; explosions count toward the counter; the reshuffle fires at the very end of a turn. Reshuffle clears craters, placement is uniform with no exclusions, rounding is half-up, and `mineDensity` (0.25) and `mineCap` (none) are tunable config. Special moves (3.5) confirmed. Castling-rook check exception applies but is unreachable. King death beats checkmate on the same move. No repetition, 50-move or insufficient-material draws; resign and draw offers in v1; no clocks; 60s disconnect grace. UI framework: Vite + React with DOM/CSS.
- 2026-10-16: Flags are notes only. Exploded mines leave a public crater, safe to land on afterwards. Tech: pnpm monorepo, TypeScript, Node + `ws` on Fly.io. Tuning defaults added (tentative). Setup kit created.
- 2026-10-16: Locked: reshuffle count = 25% of free squares; no zero flood-fill; stalemate is a draw; the follow-up move after an explosion can hit another mine.
- 2026-10-16: Idle mines parked (section 5). Castling, en passant and promotion are standard; landing on a mine costs the piece. Rules, turn resolution and pillars updated to match.
- 2026-10-16: Reshuffle: 10 total turns, mine count restored, any unoccupied square eligible, flags cleared. Starting active mines about 8 (25% of ranks 3-6).
- 2026-10-16: Game ends on king death (0 lives) or checkmate, whichever comes first. Reshuffle starts at N = 10.
- 2026-10-16: Confirmed the check exception (own king, must resolve check with another move). Confirmed idle mines count in numbers (now parked).
- 2026-10-16: Reorganized into sections. Added all earlier points (pillars, process, visuals, multiplayer, AI deferral). Decided: idle-capture detonates the capturer, reshuffle re-hides numbers, move-wasted meaning, landing reveals (tentative).
- 2026-10-16: Initial draft from design chat.
