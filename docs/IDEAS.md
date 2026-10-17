# Ideas (parking lot)

Ideas that are NOT in the current rules. `docs/GAME_DESIGN.md` stays the single source of truth for v1. Nothing here is implemented until Aviate says go.

---

# Idea: Manual Mine mode (second game mode)

> **Moved (2026-10-17):** the spec now lives in `docs/GAME_DESIGN.md` section 3.10. The text below is the original idea, kept for history.

Status: [I] parked until auto mode has shipped online. Decided in design chat, 2026-10-16. Do not implement until Aviate says go.

Modes: "Auto mine" (the current game) and "Manual mine".
Manual mine: players place mines for the opponent instead of random placement. Same rules otherwise.

- Total mines = 25% (the game now defaults to 30%) of the free (unoccupied) squares, split evenly: 12.5% each (about 4 each at game start, which matches the 8 total of auto mode).
- Each player places at most one mine per square, on any empty square.
- Both players placing on the same square creates a stacked "big mine".
- Placement happens at game start and again at every reshuffle (the board reset: all live mines are cleared and both players place anew).
- Players CAN land on their own mines and die. A player's own placements are hidden from them once the placement round ends (memory skill).
- Public numbers count all mines around a square, both players', and a stacked square counts as 2. Players who remember their own mines can subtract them to deduce the opponent's: that is the core skill.
  Decisions made (Aviate):

1. A stacked mine stays hidden. When any piece lands on it, it blasts the 3x3 area.
2. The blast destroys every piece in the 3x3 (both sides, including the mover's own), kings lose one life each instead of dying, and every square in the 3x3 becomes a crater.
3. Placement: online, both players place secretly and simultaneously with a 20-second timer; local pass-and-play, White places, a handoff screen hides the board, then Black places.
4. No safe start in manual mode (both sides placed blind, so the first move is equally risky for both).
   Defaults assumed, still to confirm: the reshuffle interval may differ per mode, so keep it a named config setting; placement counts rounded half-up per player; a reshuffle clears every live mine before both players place again.
   Open questions: placement pacing (a placement round every reshuffle may feel slow; consider a longer interval in this mode); what the UI shows during the placement phase and the hidden-own-mines step; disconnects and timeouts during placement online; what the opponent sees of the placement phase.
   Rough build scope (do later): engine (per-owner mines with stack counts, a placement phase, the 3x3 blast, new events), the client projection (the placer sees only their own placements, only during placement), protocol and server (placement messages, timer, phase state), UI (placement screens, handoff, hidden-own-mines, blast animation), tests, and a rules-page update. When approved, move the final spec into GAME_DESIGN.md as a mode.
