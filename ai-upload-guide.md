# Thinking Hub — Backup Schema Guide (for external AI uploads)

Upload this file alongside a Thinking Hub backup JSON when asking an external AI
(Claude, ChatGPT, etc.) to review your data and recommend updates. It tells the AI
the exact shape of each section so it proposes edits that match the real schema
instead of guessing field names.

Exports no longer include your Anthropic API key (it's stripped automatically as of
2026-06-17) — if you're working from an older backup file, delete
`data["⚙️ Settings"].anthropicKey` from the JSON before uploading it anywhere, since
older files still have it in plaintext. New exports are safe to share as-is.

## Top-level shape

```json
{
  "version": 2,
  "app": "Thinking Hub",
  "exportedAt": "ISO timestamp",
  "scope": "full" | "curated" | "tool",
  "storageKeys": { "<label>": "<localStorage key>", ... },
  "data": { "<label>": <section data, shape below>, ... }
}
```

`data` keys use human-readable labels (e.g. `"projects"`, `"decisions"`). A section
is only present if that tool has ever been used — an absent key means the tool has
no data yet, not that something broke.

## Sections

### `projects` (project-hub-v1)
```json
{
  "members": [ { "id": "m1", "name": "Esen", "role": "Engineer", "color": "#hex,#hex", "department": "", "managerId": "m0" } ],
  "projects": [ {
    "id", "name", "desc", "status": "planning|active|onhold|maintenance|done",
    "color": "#hex", "group": "free-text bucket name (optional)",
    "members": ["memberId", ...],
    "goals": [ { "id", "name", "desc", "progress": 0-100 } ],
    "milestones": [ { "id", "name", "date": "YYYY-MM-DD or ''", "color" } ],
    "tasks": [ {
      "id", "title", "milestoneId": "or ''", "assigneeId": "or ''",
      "priority": "high|medium|low", "due": "YYYY-MM-DD or ''",
      "done": bool, "status": "todo|inprogress|done (free-ish)",
      "blockedReason": "", "completedAt": "ISO or unset",
      "taskCode": "", "taskType": "", "workstreamId": "(disabled feature, ignore)"
    } ]
  } ],
  "groupOrder": ["GROUP NAME", ...]   // drag order for the Groupings view
}
```
Note: `group` is free text you've typed per project (e.g. `BASE`, `STRATEGY`,
`TECH`, `GLOBAL`, `R&D`, `ONUR`, `OPERATION` in current use) — not an enum.

### `goals` (goals-hub-v1) — OKRs
```json
{ "quarters": [ {
  "id", "label": "e.g. Q2 2026",
  "objectives": [ {
    "id", "title", "why", "color": "#hex",
    "type": "committed|aspirational",
    "projectId": "or unset", "projectName": "or unset",
    "createdAt": "ISO",
    "keyResults": [ {
      "id", "title", "type": "checkbox|number",
      "done": bool, "current": number, "target": number, "unit": "",
      "score": 0.0-1.0 (optional), "updatedAt": "ISO (optional)"
    } ]
  } ]
} ] }
```

### `decisions` (decision-hub-v1) — flat array, not wrapped in an object
```json
[ {
  "id": "dh-...", "projectId": "or unset", "title", "summary", "reason",
  "type": "open|decision|...", "confidence": "low|medium|high",
  "cynefin": "clear|complicated|complex|chaotic|disorder (optional)",
  "tags": "comma, separated, string — NOT an array",
  "links": "", "obsidianNote": "",
  "alternative": "alternative considered (optional, rarely used so far)",
  "revisitWhen": "condition text (optional)",
  "revisitDate": "YYYY-MM-DD (optional — drives the Resurface card)",
  "outcome": { "result": "held|partly|didnt|too-early", "note": "", "scoredAt": "ISO" },
  "createdAt": "ISO (new decisions only)",
  "problemLens": {}, "decisionCanvas": {}, "optionMap": [], "alignment": []
} ]
```
`alternative`/`revisitWhen`/`revisitDate`/`outcome` exist in the schema but are
currently unused in practice — fine to suggest filling them in only when a specific
decision genuinely warrants a future check-in, not as a blanket recommendation.

### `risks` (risk-hub-v1)
```json
{ "risks": [ {
  "id", "title", "category": "technical|...", "status": "open|mitigating|closed",
  "probability": 1-5, "impact": 1-5,
  "mitigation": "", "treatment": "", "owner": "", "reviewDate": "YYYY-MM-DD",
  "projectId", "projectName", "createdAt": "ISO"
} ] }
```

### `meetings` (meetings-hub-v1)
```json
{ "meetings": [ {
  "id", "title", "date": "YYYY-MM-DD", "time": "HH:MM or ''", "durationMins",
  "type": "standup|weekly|1on1|planning|kickoff|decision|retro|review|custom",
  "desiredOutcome": "", "attendees": "comma-separated names (legacy)",
  "attendeesList": [ { "name", "role": "decision-maker|lead|contributor|..." } ],
  "agenda": "", "notes": "", "projectId": "or unset",
  "decisions": [ ... ],       // decision register — currently unused, 0 entries logged
  "actionItems": [ { "text", "done": bool, "dueDate": "YYYY-MM-DD optional" } ], // also unused
  "icsUid": "if imported from .ics", "icsKey": "..."
}, ... ], "templates": [...] }
```
You log substance in free-text `notes`/`agenda` rather than the structured
`decisions`/`actionItems` arrays — don't assume those arrays reflect what actually
happened in a meeting; check `notes` too.

### `schedule` (schedule-v1)
```json
{ "items": [ {
  "id", "title", "type": "task|milestone|event", "start": "YYYY-MM-DD", "end": "YYYY-MM-DD",
  "startTime": "HH:MM or null (time-block grid — currently unused, all items are all-day)",
  "endTime": "HH:MM or null", "color": "#hex",
  "projectId", "projectRef": "project name", "sourceId", "sourceTool": "project-hub|...",
  "done": bool, "createdAt": "ISO"
} ], "settings": {} }
```

### `learning_log` (learning-hub-v1)
```json
{ "items": [ {
  "id", "title", "author", "type": "book|article|course|video|...",
  "status": "to-read|reading|done", "platform": "", "url": "",
  "progress": 0-100, "owned": bool, "tags": ["array"],
  "highlights": [], "notes": "", "keyInsight": "Feynman-style plain-language summary",
  "createdAt": "ISO"
} ] }
```

### `stakeholders` (stakeholder-hub-v1)
```json
{ "stakeholders": [ {
  "id", "name", "role", "stance": "supporter|neutral|opponent (free-ish)",
  "power": 1-5, "interest": 1-5,
  "engagement": "Unaware|Resistant|Neutral|Supportive|Leading or ''",
  "projectIds": ["projectId", ...], "notes": "",
  "createdAt": "ISO", "updatedAt": "ISO"
} ] }
```

### `retrospectives` (retro-hub-v1)
```json
{ "retros": [ { "id", "name", "createdAt", "items": { "well": [], "improve": [], "actions": [] } } ], "activeId": "" }
```

### `focus_sessions` (focus-hub-v1)
```json
{ "sessions": [ {
  "id", "taskId": "or null", "taskTitle": "or null", "projectId": "or null", "projectName": "or null",
  "durationMin", "elapsedSec", "completed": bool, "startedAt": "ISO", "endedAt": "ISO",
  "energy": "high|medium|low (optional)", "context": "@deep-work|@admin|... (optional)",
  "pomodoroEst": number (optional)
} ] }
```

### `daily_log` (log-hub-v1)
```json
{ "entries": { "YYYY-MM-DD": { "mood": 1-5, "text": "free-form journal", "learning": "(optional)", "updatedAt": "ISO" } } }
```
Keyed by date, not an array.

### `weekly_reviews` (review-hub-v1)
```json
{ "YYYY-Www": { "wins": "", "learn": "", "block": "", "notes": "", "rocks": ["task refs"] } }
```
Keyed by ISO week, not an array.

### `canvas` (canvas-v1) — spatial board, barely used
```json
{ "nodes": [ { "id", "x", "y", "text": "HTML, may contain <!-- obsidian --> markers", "color": "c-gray|..." } ], "edges": [], "panX", "panY", "zoom" }
```

### `idea_swiper` (ideaswipe_history_v6) — flat array
```json
[ { "idea": "text", "vote": "like|super|nope", "ts": epoch_ms, "sessionId": "" } ]
```
No link back to a project even when liked — the "→ Hub" pipeline that would set
that link is built but not used in practice. Don't assume a `like`/`super` idea
became a real task; check Project Hub separately.

### `cross_tool_links` (hub-links-v1) — flat array
```json
[ { "id", "a": { "tool": "project-hub|schedule|...", "itemId", "label" }, "b": { same shape }, "createdAt" } ]
```
Undirected — `a`/`b` order doesn't imply causality.

### `tool_portfolio` (tool-portfolio-v1) — flat array
```json
[ { "id", "name", "icon", "url", "status": "using|trial|considering|...", "ring": "adopt|trial|assess|hold", "archLayer": "business|data|application|technology", "category", "note", "projectIds": [...], "order": number } ]
```

### `tag_registry` (hub-tags-v1)
```json
{ "tags": [ { "name", "createdAt": "ISO" } ] }
```
This is the canonical tag list; actual tag usage also lives inline on items in
`decisions` (comma string), `learning_log`, `meetings`, `kmqt_board` (array fields).

### `activity_log` (hub-activity-v1)
```json
{ "log": [ ... ], "seenAchievements": ["achievementId", ...] }
```
Internal/UI bookkeeping — low value for recommendations, mostly noise.

### `settings` (hub-settings-v1)
```json
{ "obsidianVault": "vault name", "profile": { "name", "role", "selfMemberId" } }
```
(`anthropicKey` is stored locally but stripped from every export — it will never
appear in a backup file.)

### `kmqt_board` (kmqt_current_v2) — retired tool, import-only source now
```json
{ "v": 1, "labels": { "K": "Keep", "M": "MoyaMoya", "Q": "Question", "T": "Try" }, "columns": { "K": [...], "M": [...], "Q": [...], "T": [...] }, "links": [] }
```

## Sections that exist in the schema but had zero data as of 2026-06-17
These tools/views are fully built and wired in but you haven't used them yet — an
empty result for these is expected, not a sign of a missing feature:
- `assumptions-hub-v1` (Decision Hub → Assumptions tab)
- `matrix-hub-v1` (Project Hub → Priority Matrix view)
- `argument-hub-v1` (Argument Hub — Pyramid Principle tool)
- `reflection-hub-v1` (Reflection Board)

## What to ask the AI to actually do
Given the above, useful prompts paired with a backup upload:
- "Here's my Thinking Hub backup + schema guide. Based on `projects`/`risks`/`schedule`,
  what's stale, overdue, or contradictory?"
- "Cross-reference `decisions` and `meetings.notes` — did anything get *decided* in
  notes that never made it into the decision log?"
- "Look at `idea_swiper` likes/supers and `projects` — which liked ideas never became
  a task anywhere?"
Avoid asking it to "fill in calibration/revisit fields" by default — that part of
the schema isn't part of your real workflow yet.
