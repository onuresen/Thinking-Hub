# Tutorial alignment: gated steps + replay entry point

**Date:** 2026-07-12
**Status:** Approved
**Related:** onexus repo gets a matching change (first-run auto-trigger) — see that repo's own spec under the same date.

## Context

Thinking Hub (`hub-tutorial.js` + two tours defined in `index.html`) and Onexus
(`graph-ui.tour.js`) both have interactive tours, but they diverged:

- Onexus tours can *gate* a step on a real user action (click, node tap) before
  auto-advancing, and expose a permanent toolbar button + `T` hotkey to replay
  the tour any time.
- Thinking Hub's tour is a passive click-through (Back/Skip/Next only) with no
  way to replay it after the two auto-triggered runs (first visit, first
  project created).

This spec covers bringing Thinking Hub's tour up to parity on both fronts,
without changing its existing visual design (dark surface, accent-lime,
CSS-var themed) or the content of the two existing tours.

## 1. Gated steps in `hub-tutorial.js`

Add an optional `waitFor: { selector, event }` field to a step object.

- If absent, behavior is unchanged (Next button advances immediately).
- If present:
  - The tooltip's primary button label becomes `Next (or do it) →` instead of
    `Next →`, matching Onexus's affordance-hint pattern.
  - A one-time listener is attached for `event` on `document`, filtered to
    `event.target.matches(selector) || event.target.closest(selector)`.
  - Firing that listener advances the tour exactly like clicking Next
    (`next()`), and detaches itself.
  - Clicking Next manually still works at all times (no hard gate) — this
    matches Onexus's own design ("Next is still available (manual
    override)").
  - The listener must be torn down on `prev()`, `end()`, and when a step
    changes, so stale listeners never fire late.

No existing step objects need to gain `waitFor` as part of this change — the
two existing tours (`startTour()`, `startWorkflowTour()` in `index.html`) keep
working exactly as today. `waitFor` is available for future tour authors to
use where it earns its keep.

## 2. Replay entry point

Thinking Hub is a shell (`index.html`) that hosts sub-tools, including
`help-hub.html`, inside an iframe, communicating by `postMessage` (existing
convention: `hub-navigate`, `hub-first-project`, `hub-project-active`, etc.).
Tour steps target elements that only exist on the shell's home dashboard
(`.home-greeting`, `[data-app="project-hub"]`), so replay must be triggered
from the shell, not from within `help-hub.html` itself.

- `help-hub.html` gets a "▶ Replay Tour" button in its top bar. On click, it
  posts `{ type: 'hub-replay-tour' }` to `parent` (same origin-guard pattern
  as existing messages).
- `index.html`'s existing `window.addEventListener('message', ...)` handler
  (~line 2473) gets a new branch: on `hub-replay-tour`, call the existing
  `startTour()` function (which already does `goHome()` + a short delay before
  starting — reused as-is).
- `index.html`'s existing keydown handler (~line 2514, already guards against
  firing while an input/select/textarea is focused) gets a new case: `?` key
  calls `startTour()` directly (no need to leave the home view first if
  already there; `startTour()` calling `goHome()` is idempotent).

No new storage keys, no changes to the auto-trigger logic for the two existing
tours.

## Out of scope

- No visual/theme changes to either tutorial.
- No shared/extracted library between Thinking Hub and Onexus — they remain
  independent implementations (per explicit decision).
- No tutorials added to any other tool.
