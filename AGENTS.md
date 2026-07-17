# Thinking Hub — Agent Context

**The canonical project context for ALL agents (Claude, Codex, or any other) is [`CLAUDE.md`](CLAUDE.md). Read that file — it is the single source of truth.**

## Why this file is a pointer

Until 2026-07-17 this file was a full parallel copy of the project context maintained by a
Codex agent. The two files forked: each accumulated its own backlog history with **colliding
priority numbers** (both had a "Priority 79" and "Priority 80" describing different work), and
list drift here caused a real data-safety bug (backup key lists missing live tools). The unique
content this file had — the Machi Hub build history (Codex Priorities 79–86) — was condensed
into `CLAUDE.md` under **"Machi Hub history"**, and the decisions that still bind
(stamped-copy rule for `machi-engine.js`/`machi-achievements.js`, `machi-milestones-v1`
ephemerality, the isolated-tab pattern for Machi visual experiments) live there now.

## Rules for agents reading this file

1. Read `CLAUDE.md` in full before making changes — all conventions (CSS tokens, script load
   order, file-editing safety, storage keys, the decision-log schema) live there.
2. Record new work in `CLAUDE.md`'s backlog, continuing its priority numbering.
3. Do **not** re-expand this file into a second context copy — update `CLAUDE.md` instead.
