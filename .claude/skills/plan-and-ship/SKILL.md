---
description: Read the backlog, propose a ranked plan in 2–4 efficient groups, wait for approval, then implement one group at a time with verification. Update CLAUDE.md when done.
---

## Steps

1. **Read context** — Read `CLAUDE.md` (backlog section + any open improvement items). Note which items are already ✓ Done.

2. **Propose a ranked plan** — List all open items ranked by impact-to-effort. Group into 2–4 batches (Group A, B, C…) where items in the same group share context or touch the same files. For each group state:
   - Items included
   - Files that will be touched
   - Estimated session size (small / medium / large)
   - One-line verification step

3. **Wait for approval** — Present the plan and stop. Do not implement anything yet. Ask: "Which group should I start with?"

4. **Implement one group at a time** — After approval, implement the approved group completely before moving on. Follow the File Editing Safety rules in CLAUDE.md (use Edit tool with literal strings; no bulk PowerShell regex; read files before editing).

5. **Verify** — After each group, do a quick sanity check: confirm changed storage keys match the localStorage keys list in CLAUDE.md, confirm no new hex colors were hardcoded, confirm script load order is still correct.

6. **Update CLAUDE.md** — Mark completed items ✓ Done. Add any new file-map entries, storage keys, or conventions introduced. Note any follow-up items discovered during implementation.

7. **Report and pause** — Summarize what shipped, then ask: "Ready for the next group?"
