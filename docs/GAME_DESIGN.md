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
- **Danger never runs out.** Concern: if the mines in ranks 3-6 get exhausted, the game becomes plain chess. The full reset every 8 turns keeps danger alive and keeps covering new positions as the game moves on.
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
- `[D]` The relocated mine goes to a uniformly random free square (no piece, no mine, not the landing square) on ranks 3-6 that touches **exactly the same set of revealed squares as the old square**, so every revealed number stays identical. When the old square touches no revealed square, this means the new square is not adjacent to any revealed square.
- `[D]` A relocated mine never lands on a revealed square or a crater square, so revealed squares stay safe and craters stay consumed.
- `[D]` If no such square exists on ranks 3-6, the search widens to any free square on any rank (same condition). If still none, the mine is silently removed (one fewer mine until the next reshuffle). Revealed numbers next to it then update as usual (the one case where a safe-start change can show). The first move is always safe.
- `[D]` Safe start applies only to each side's first move of the game, never after a reshuffle. A relocation is not a reshuffle and does not affect the reshuffle counter.
- `[D]` Idle mines are **not part of this version** (parked, see section 5).

### 3.2 Information

- `[D]` **Complete information** for revealed data: both players see the same reveals.
- `[D]` A revealed number = count of mines in the **8 adjacent squares**.
- `[D]` Numbers are **live**: a revealed number always shows the current count of adjacent live mines, so it goes down when a neighboring mine is consumed.
- `[D]` Numbers are **public**.
- `[D]` **Reveal trigger**: a square's number is revealed when a piece lands on it and survives (normal Minesweeper style). This includes captures, both castling destinations, en passant and promotion. It also applies to crater squares: when a piece survives a landing on a crater (including a king surviving the explosion that made it), the square's number is revealed and shown alongside the crater.
- `[D]` A revealed number **stays visible until the next reshuffle**, even after the piece leaves the square.
- `[D]` Starting squares (ranks 1-2 and 7-8) start **hidden**. They are revealed only by a later landing.
- `[D]` Only **landing** triggers mines or reveals; sliders passing over squares do nothing.
- `[D]` Public meta-information: the **live mine count**, **turns until the next reshuffle**, and both kings' **lives**.
- `[D]` Also public, all derived from public data: the **pieces each side has lost** (captured or killed by a mine, with the cause), the **public move log** (the public events of every move), whether the side to move is **in check**, and which **seat** a client's view is for.
- `[D]` **No zero flood-fill**: landing on a square with a 0 reveals only that square, not its neighbors. Revisit after playtesting (could become a toggle).

### 3.3 Flags

- `[D]` Players can flag suspected mines.
- `[D]` Flags are **private**: the opponent cannot see them.
- `[D]` Flags are **only notes**: no rules effect, no limit, no penalty for wrong flags. They are cleared on a reshuffle (3.7).

### 3.4 Triggering a mine

- `[D]` A non-king piece landing on a live mine is **destroyed**. The move is wasted (no benefit) and play passes to the opponent.
- `[D]` The mine is consumed when triggered, for every piece type.
- `[D]` **Check exception**: if a piece dies on a mine and that leaves the mover's **own king** in check (e.g. a blocker explodes), the mover does not lose the turn. They must immediately make another move that resolves the check: move the king, or force some other resolving move (block or capture the checker). Original wording: "if you put a bishop somewhere and it blows up and it causes a discovered check on the king, then the king gets to move".
- `[D]` If the mover has no move that resolves the check after the explosion, that is **checkmate and the mover loses** (see 3.6).
- `[D]` The follow-up move can itself hit another mine (any landing counts), so chain reactions are possible.
- `[D]` The explosion and all its follow-up moves form **one turn** (one tick of the reshuffle counter). The fullmove number advances once for the whole chain.
- `[D]` A triggered mine leaves a public **crater** on the square. The mine is consumed, so pieces can land on a crater safely afterwards.
- `[D]` An exploded piece still counts as having moved: **castling rights are lost** whenever the king or a rook moves, even when the move ends in an explosion.
- `[D]` A double-pushed pawn destroyed on a mine sets **no en passant target**.
- `[D]` An en passant chance that stood before an explosion **still stands for the mover's follow-up move** (same turn, see check exception above).

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
- `[D]` Moves are **rejected once the game is over**.
- `[D]` When the game ends, the **final mine layout is revealed to both players**. It is sent only after the game is over, never during play.
- `[D]` Castling lands the king first, then the rook. If the king's landing ends the game (last life lost), nothing else resolves.
- `[D]` **No other automatic draws**: no threefold repetition, no 50-move rule, no insufficient-material draw.
- `[D]` Players can **resign** or **offer a draw** (the opponent accepts or declines).
- `[D]` **No clocks** in v1.
- `[D]` Online disconnect: the disconnected player has a **60-second grace period** to reconnect. After that the opponent may claim the win.
- `[D]` **Non-move endings**: resigning ends the game at once; the resigning side loses (reason `resignation`). An accepted draw offer ends it as a draw (reason `agreement`). A win claimed after the 60-second grace ends it with the absent side losing (reason `abandonment`). Each produces a public `GameOver` event and a public log entry (colour = the side that resigned, accepted the draw, or was absent). The no-capture counter does not change, no reshuffle fires, and a pending check-exception chain is cleared.
- `[D]` **Draw offers**: either side may offer at any time. At most one offer is pending. It lapses when any move is made or when the opponent declines. The offerer cannot offer again until they have made a move. Offers are session state (server or local client), not game state.

### 3.7 Reshuffle (full reset, anti-stall)

- `[D]` Every **8 total turns** (4 per player) without a capture, all mines are randomly reshuffled. This keeps the game moving. It replaces the original idea ("a mine flagged for more than 5 moves triggers a random reset"). Starting value, tunable after playtesting.
- `[D]` The counter starts at 0 at game start and resets to 0 after each reshuffle. It counts completed turns; a check-exception chain counts as one turn. Any turn in which a piece is captured resets it to 0, including an en passant capture whose capturer then explodes. A turn with an explosion counts as a normal turn and does not reset it. The counter does not change while a chain is pending or on the turn that ends the game.
- `[D]` **Timing**: the reshuffle fires at the very end of a turn, after the whole check-exception chain and the game-end checks, and only if the game continues.
- `[D]` Placement is **truly random**: uniform over all unoccupied squares, with no exclusions (not even near kings). Never on an occupied square. Mines may land on empty squares on ranks 1-2 and 7-8.
- `[D]` After a reshuffle the mine count is **`mineDensity` × the free (unoccupied) squares at that moment**, rounded **half-up** (e.g. 7.5 → 8), then capped at `mineCap` if one is set. It grows denser as pieces leave the board, matching "mines everywhere in the endgame". Not just the survivors from before.
- `[T]` Tunable config values: `mineDensity = 0.25`, `mineCap = none`, `reshuffleInterval = 8` (one named setting, `DEFAULT_RESHUFFLE_INTERVAL`, so per-mode values can be added later). Add a cap if endgames get too brutal.
- `[D]` A reshuffle **re-hides all revealed numbers**, **clears all craters** (mines moved, so old craters would be stale) and **clears all private flags**.

### 3.8 Turn resolution (derived from the rules above)

1. Mover plays a chess-legal move. Hidden mines are ignored for legality. During a check-exception follow-up, the move must resolve the check.
2. Safe start (3.1): on a side's first move of the game, a mine on the landing square is relocated first.
3. Pieces move; a captured piece is removed.
4. Each landing square (two for castling): if it holds a live mine, the piece is destroyed (a king loses a life and stays), the mine is consumed and a crater is left. Otherwise the piece survives and the square's number is revealed. Revealed numbers stay live.
5. If a king reaches 0 lives, the game ends and that side loses (3.6 precedence).
6. If an explosion left the mover's own king in check, the same side moves again (3.4). This is still the same turn: go back to step 1. No resolving move = checkmate.
7. Otherwise the turn passes. Check, checkmate and stalemate are evaluated for the opponent.
8. End of turn, only if the turn passed and the game continues: the no-capture counter updates (a capture resets it). At `reshuffleInterval` (8) turns a reshuffle fires and the counter resets. Events: `Reshuffled` is public; `MineRelocated` (safe start) is server-only and never sent to clients.

---

## 4. Open questions (priority order)

1. `[Q]` UI/UX brainstorm (section 6).
2. `[T]` Tuning in playtesting: `mineDensity`, `mineCap`, the reshuffle interval (8 turns), the 3 king lives.

---

## 5. Parked: idle mines

Parked on 2026-10-16. Aviate is unsure of the mechanics, and the 8-turn full reset already covers new positions as the game goes on. The full spec is kept here in case we revive it after playtesting. None of it applies to the current version.

- Idea: each side's last two ranks (1-2 and 7-8) hold **idle mines** on a sparse subset of squares, under starting pieces. They are dormant and **arm** (become live) when the piece standing on them leaves. Purpose: danger grows toward the endgame ("mines everywhere"), and the board never runs out of mines.
- Capture on an idle mine: the mine arms under the capturer and detonates immediately. The captured piece is removed, the capturer is destroyed (a king capturer loses a life and stays), the mine is consumed. A deliberate suspense mechanic and a forced trade.
- Dormant idle mines would count in neighbors' numbers, so players can deduce booby-trapped back-rank pieces. Numbers would not change when a mine arms.
- Reshuffle would treat dormant idle mines as untouched (they sit under pieces) and relocate only live ones.
- Variant: idle mines also arm on a timer, not only when the piece leaves.
- Open if revived: do armed idle mines count toward the reshuffle total, or are they extra?

---

## 6. UI/UX

- `[D]` Authentic old-school Windows Minesweeper look, much more colourful: classic number colours (1 blue, 2 green, 3 red, 4 navy, 5 maroon, 6 teal, 7 black, 8 gray), clearly distinct white (ivory/gold) and black (charcoal/crimson) pieces, coloured LEDs. Pixel art for pieces, tiles, flags, mines, craters, explosions, smileys, buttons, dialog chrome, icons and LED digits. Sprites are authored as pixel maps and approved on the `/sprites` style tile (2026-10-16).
- `[D]` Layout: board on the left, move log on the right, infographics bar on top (mines LED, smiley = new game, turns-until-reshuffle LED that blinks red at 2 left, lives per side as pixel king icons, captured and fallen rows). Fixed-size retro window, integer scaling, teal desktop.
- `[D]` Pass-and-play: after the handoff the board flips to the side to move (default on, toggle in the Game menu). Online: own side at the bottom.
- `[D]` Sound, generated in code with WebAudio (no asset files): move, capture, flag, reveal, explosion, king hit, check, reshuffle, game over, click. Mute toggle in the Game menu, persisted; audio starts only after the first user interaction.
- `[D]` Animations: on a mine hit the explosion graphic and sound play first, then the handoff screen (about 800 ms at most, skippable by click or key; game state updates instantly; online play never blocks input). Also: piece slide, capture pop, number flip-reveal, reshuffle wave, king-life crack, check flash, game-over mine reveal. All respect reduced-motion.
- `[D]` Game → Options (local play): reshuffle interval and mine density, applied at New game, so tuning needs no code change. Defaults come from the config (8 turns, 0.25).
- `[D]` Rules page: shown on first load ("Don't show again" saved locally), reachable from a Help menu or "?" button; written from this document only. Numbers show a tooltip (what they count, which piece's landing revealed them) and a corner-badge legend.
- `[D]` Online flow (2026-10-16). The app opens on local pass-and-play. **Game → Online...** opens a Win 3.1-style Lobby dialog with "Create game" and "Join game" (6-character invite code, input uppercased and stripped of spaces).
  - Creating shows a waiting room: the code, "Copy code" and "Copy link" (`?join=CODE` opens the Lobby with the code filled in), "Waiting for opponent..." and Cancel. Cancel is client-only (the socket closes and the seat token is forgotten; the server drops the empty room later).
  - Online play reuses the board, animations, sounds, status bar, move log and rules page. The board is fixed to the player's own colour at the bottom: no flipping and no handoff screen. Flip board and Options are disabled online (the server uses the default config).
  - The client renders only from the server's public view and projected events. The final mine layout arrives with game over and is shown then.
  - Flags stay private in the browser (localStorage, per game and seat) and are cleared on a reshuffle, including one missed while disconnected.
  - Reconnect: the seat token is stored per game. On reload or a dropped socket the client rejoins with the token and applies the snapshot, showing a "Reconnecting..." banner meanwhile. An "Opponent disconnected" notice shows while the other side is away; after the 60-second grace (3.6) it offers "Claim win".
  - Resign, offer draw, accept, decline and claim win each ask for confirmation online.
  - Server errors show as a short friendly message, never a crash.
  - The smiley and Game → New game become **Leave game**: during play they ask the player to resign first; after game over they go straight to the lobby. The game-over dialog offers "Back to lobby".

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

- 2026-10-16: Online client flow recorded in section 6 (lobby, waiting room, fixed orientation, reconnect, confirm dialogs, Leave game, invite link). No rule changes.
- 2026-10-16: Reshuffle interval raised from 6 to 8 total turns (4 per player) after the second playtest; one named config default (`DEFAULT_RESHUFFLE_INTERVAL`) so per-mode values can be added later (3.7). Local-play Game → Options added for interval and density (section 6).

- 2026-10-16: UI v2 decisions recorded in section 6 (retro skin, layout, board flip, sound, animations) after the style tile was approved.
- 2026-10-16: Reshuffle interval lowered from 10 to 6 total turns (3 per player) after the first pass-and-play playtest; still a tunable config value (3.7).
- 2026-10-16: Resign, draw agreement and abandonment are decided as non-move endings with their own reasons and a public log entry; draw offers lapse on the next move (3.6).
- 2026-10-16: Client projection (M8). Added to the public information (3.2): lost pieces with cause, the public move log, in-check and the viewer's seat. The final mine layout is revealed to both players when the game ends, and only then (3.6). The projected view carries no half-move clock (there is no 50-move rule).
- 2026-10-16: Safe-start relocation never targets a revealed square or a crater square (3.1).
- 2026-10-16: Safe-start relocation keeps every revealed number identical (new square touches the same revealed squares as the old one); widens to any rank, then drops the mine, if no square exists. The no-capture counter counts completed turns (a chain counts once), resets on any turn that captures a piece (including an en passant whose capturer explodes), and is frozen while a chain is pending or the game ends. `reshuffleInterval = 10` is a tunable config value. `MineRelocated` is a server-only event.

- 2026-10-16: Check-exception checkmate is decided: no resolving move after an explosion means checkmate and the mover loses. A chain of follow-up moves is one turn (fullmove advances once). Moves after game over are rejected. Castling resolves the king landing before the rook.

- 2026-10-16: Explosion side effects: castling rights are lost even if the king/rook move ends in an explosion; a double-pushed pawn destroyed on a mine sets no en passant target; an en passant chance still stands for the follow-up move. Craters reveal numbers like any other square when a piece survives a landing there.

- 2026-10-16: Design-gap audit resolved. Safe start is now lazy relocation of the landed-on square's mine, to a free square on ranks 3-6 not next to a revealed square, first move only (the old "any first-move destination" wording was impossible). Numbers are live and persist until a reshuffle; starting squares start hidden; mine count, reshuffle countdown and lives are public. Explosion plus follow-ups = one turn; explosions count toward the counter; the reshuffle fires at the very end of a turn. Reshuffle clears craters, placement is uniform with no exclusions, rounding is half-up, and `mineDensity` (0.25) and `mineCap` (none) are tunable config. Special moves (3.5) confirmed. Castling-rook check exception applies but is unreachable. King death beats checkmate on the same move. No repetition, 50-move or insufficient-material draws; resign and draw offers in v1; no clocks; 60s disconnect grace. UI framework: Vite + React with DOM/CSS.
- 2026-10-16: Flags are notes only. Exploded mines leave a public crater, safe to land on afterwards. Tech: pnpm monorepo, TypeScript, Node + `ws` on Fly.io. Tuning defaults added (tentative). Setup kit created.
- 2026-10-16: Locked: reshuffle count = 25% of free squares; no zero flood-fill; stalemate is a draw; the follow-up move after an explosion can hit another mine.
- 2026-10-16: Idle mines parked (section 5). Castling, en passant and promotion are standard; landing on a mine costs the piece. Rules, turn resolution and pillars updated to match.
- 2026-10-16: Reshuffle: 10 total turns, mine count restored, any unoccupied square eligible, flags cleared. Starting active mines about 8 (25% of ranks 3-6).
- 2026-10-16: Game ends on king death (0 lives) or checkmate, whichever comes first. Reshuffle starts at N = 10.
- 2026-10-16: Confirmed the check exception (own king, must resolve check with another move). Confirmed idle mines count in numbers (now parked).
- 2026-10-16: Reorganized into sections. Added all earlier points (pillars, process, visuals, multiplayer, AI deferral). Decided: idle-capture detonates the capturer, reshuffle re-hides numbers, move-wasted meaning, landing reveals (tentative).
- 2026-10-16: Initial draft from design chat.
