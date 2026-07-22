# Accessibility statement

This is a good-faith self-assessment of Thinking Hub's accessibility posture.
It is **not** a formal WCAG certification or third-party audited VPAT. It
describes what the application does today, and where the known gaps are, so a
reviewer can make an informed judgement.

Target: [WCAG 2.1](https://www.w3.org/TR/WCAG21/) Level AA as a design goal.
Conformance is **partial** — see "Known limitations" below.

## What is implemented

**Keyboard operation**
- Global command palette (search + quick actions) via `Cmd/Ctrl+K`.
- Primary navigation, buttons, form controls, and links are native, focusable
  elements reachable and operable by keyboard.
- Modal dialogs (the Data & Backup modal, the cross-tool link picker) trap
  focus with `Tab` / `Shift+Tab` cycling and restore focus on close
  (`HubUtils.trapFocus`), and close on `Escape`.

**Focus and structure**
- The active sidebar navigation item is marked with `aria-current="page"`.
- Dialog surfaces expose `role="dialog"` with an accessible name
  (`aria-modal` / `aria-labelledby` / `aria-label`).
- Icon-only controls carry `aria-label`s; the app identity mark is decorative
  (`alt=""`).

**Motion**
- A global `@media (prefers-reduced-motion: reduce)` rule near-instantly
  collapses animations and transitions and caps looping animations, so users
  who request reduced motion at the OS level are respected across every tool
  (the rule lives in the single shared `theme.css`).

**Color and contrast**
- Three fully-defined themes (dark, light, and the "ink" paper theme) let users
  pick a comfortable contrast. All colors are theme tokens, kept in sync across
  themes; status meaning is not conveyed by color alone (icons/labels
  accompany color cues in most surfaces).

**Text and zoom**
- Layouts use relative units and responsive breakpoints; content reflows to a
  single column on small viewports (audited for zero horizontal overflow at
  390 px), which also aids browser zoom / reflow.

## Known limitations

- No formal external WCAG audit or published VPAT has been performed; this is a
  self-assessment.
- Spatial and visualization tools — the infinite Canvas, the dependency Graph
  (vis-network), and 2×2 matrix boards — are inherently visual and pointer-
  oriented; their canvas-drawn content is not fully exposed to assistive
  technology, and some interactions (drag-to-reposition, drag-to-link) have no
  keyboard-equivalent yet.
- Screen-reader labeling has not been comprehensively verified across all 30
  tool surfaces; coverage is strongest in the shell and the most-used tools.
- Some decorative color tints have not been contrast-measured against every
  theme background.

## Feedback

Accessibility issues can be reported through the channels in
[`SECURITY.md`](../SECURITY.md#reporting-a-vulnerability) (for a private
channel) or via a normal GitHub issue for non-sensitive reports. Concrete
reproduction steps and the assistive technology / browser used are appreciated.
