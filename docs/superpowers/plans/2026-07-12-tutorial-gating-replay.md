# Tutorial Gating + Replay Entry Point Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give Thinking Hub's tour engine (`hub-tutorial.js`) an optional gated-step mode, and add a way to replay the tour after the two existing auto-triggered runs.

**Architecture:** `hub-tutorial.js` gains an optional `waitFor: { selector, event }` field per step that attaches a one-shot DOM listener to auto-advance; unchanged when absent. `help-hub.html` gets a button that posts `{type:'hub-replay-tour'}` to `parent`; `index.html`'s existing message listener and keydown handler get one new branch each to call the existing `startTour()`.

**Tech Stack:** Vanilla JS, no build step, no test runner in this repo — verification is manual in-browser (open the files, click through).

## Global Constraints

- No visual/theme changes — keep existing CSS classes and `var(--...)` theming as-is.
- No changes to the two existing tour step arrays (`startTour()`, `startWorkflowTour()` in `index.html`) — `waitFor` is additive and optional.
- No new localStorage/HubStorage keys.
- Keep the `Next` button always clickable, even on a gated step (manual override, never a hard block).

---

### Task 1: Add gated-step support to `hub-tutorial.js`

**Files:**
- Modify: `E:\GitHub\Thinking-Hub\hub-tutorial.js`

**Interfaces:**
- Consumes: nothing new.
- Produces: step objects may now include `waitFor: { selector: string, event: string }`. `window.HubTutorial.start(steps)`, `.next()`, `.prev()`, `.end()` keep their existing signatures — no caller needs to change.

This repo has no test runner, so verification is a manual checklist at the end of the task (open `index.html` locally, run a tour with a gated step).

- [ ] **Step 1: Add gate-tracking state and a teardown helper**

At the top of the IIFE in `hub-tutorial.js`, alongside the existing `let steps = [];` / `let currentIdx = 0;` (lines 7-8), add a variable to track the active gate listener so it can always be torn down:

```javascript
window.HubTutorial = (() => {
  let steps = [];
  let currentIdx = 0;

  let overlayEl = null;
  let tooltipEl = null;
  let activeGate = null; // { target, event, handler } for the current step's waitFor, if any

  function clearGate() {
    if (activeGate) {
      activeGate.target.removeEventListener(activeGate.event, activeGate.handler, true);
      activeGate = null;
    }
  }
```

- [ ] **Step 2: Call `clearGate()` at every point a step ends**

In `next()`, `prev()`, and `end()`, call `clearGate()` first so a listener from the previous step can never fire late. Replace:

```javascript
  function next() {
    if (currentIdx < steps.length - 1) {
      currentIdx++;
      renderStep();
    } else {
      end();
    }
  }

  function prev() {
    if (currentIdx > 0) {
      currentIdx--;
      renderStep();
    }
  }

  function end() {
    if (overlayEl) {
```

with:

```javascript
  function next() {
    clearGate();
    if (currentIdx < steps.length - 1) {
      currentIdx++;
      renderStep();
    } else {
      end();
    }
  }

  function prev() {
    clearGate();
    if (currentIdx > 0) {
      currentIdx--;
      renderStep();
    }
  }

  function end() {
    clearGate();
    if (overlayEl) {
```

Also call `clearGate()` at the top of `start()`, right after the existing `end(); // always start from a clean slate` line, so starting a fresh tour can't inherit a stale gate (defensive — `end()` already clears it, but keep the call explicit since `start()` is the public entry point):

```javascript
  function start(tourSteps) {
    if (!tourSteps || tourSteps.length === 0) return;
    end(); // always start from a clean slate
    clearGate();
    steps = tourSteps;
```

- [ ] **Step 3: Wire up the gate and the hint label in `renderStep()`**

Find the `nextLabel` line and the `tooltipEl.innerHTML` assignment:

```javascript
    const nextLabel = currentIdx === steps.length - 1 ? 'Finish' : 'Next →';
```

Replace with a version that accounts for `step.waitFor`:

```javascript
    const isLast = currentIdx === steps.length - 1;
    const nextLabel = isLast ? 'Finish' : (step.waitFor ? 'Next (or do it) →' : 'Next →');
```

Then, at the end of `renderStep()` (after the existing `tooltipEl.innerHTML = ...` assignment and the `tooltipEl.classList.remove('ht-show')` / `setTimeout` block), attach the gate:

```javascript
    // Remove ht-show first so the fade-in transition re-triggers on every step
    tooltipEl.classList.remove('ht-show');
    setTimeout(function() { tooltipEl.classList.add('ht-show'); }, 50);

    clearGate();
    if (step.waitFor && step.waitFor.selector && step.waitFor.event) {
      const handler = function(e) {
        const hit = e.target && (e.target.matches?.(step.waitFor.selector) || e.target.closest?.(step.waitFor.selector));
        if (!hit) return;
        clearGate();
        next();
      };
      document.addEventListener(step.waitFor.event, handler, true);
      activeGate = { target: document, event: step.waitFor.event, handler: handler };
    }
  }
```

(That closing `}` matches the existing end of `renderStep()` — do not duplicate it.)

- [ ] **Step 4: Manual verification**

Open `E:\GitHub\Thinking-Hub\index.html` directly in a browser (file:// is fine, no server needed). In the browser devtools console, run:

```javascript
HubTutorial.start([
  { title: 'Step 1', text: 'Click the search bar to continue.', element: '#search-input', waitFor: { selector: '#search-input', event: 'focus' } },
  { title: 'Step 2', text: 'No gate here — Next works immediately.' }
]);
```

Expected:
- Step 1's Next button reads "Next (or do it) →".
- Clicking into the search bar (not Next) auto-advances to Step 2.
- Step 2's button reads "Next →" (no gate).
- Pressing Escape or clicking Skip at any point removes the overlay/tooltip and leaves no stray event listeners (re-running the same `HubTutorial.start(...)` call afterward should not double-fire).

- [ ] **Step 5: Commit**

```bash
cd "E:/GitHub/Thinking-Hub"
git add hub-tutorial.js
git commit -m "Add optional gated-step support to HubTutorial"
```

---

### Task 2: Add a "Replay Tour" button to `help-hub.html`

**Files:**
- Modify: `E:\GitHub\Thinking-Hub\help-hub.html`

**Interfaces:**
- Consumes: nothing new (uses the browser's `parent.postMessage`, same pattern as `project-hub.html`'s existing `parent.postMessage({type:'hub-navigate',...})` calls).
- Produces: posts `{ type: 'hub-replay-tour' }` to the parent window — Task 3 makes `index.html` handle it.

- [ ] **Step 1: Add the button to the top bar**

In `help-hub.html`, find the top bar block (around line 196-199):

```html
    <div class="search-wrap">
      <span class="search-icon">🔎</span>
      <input class="search-input" id="search-input" type="text" placeholder="Search tools, frameworks…" oninput="onSearch()" />
    </div>
  </div>
```

Add a button right after the `search-wrap` div, still inside `.topbar`:

```html
    <div class="search-wrap">
      <span class="search-icon">🔎</span>
      <input class="search-input" id="search-input" type="text" placeholder="Search tools, frameworks…" oninput="onSearch()" />
    </div>
    <button class="view-btn" id="btn-replay-tour" onclick="replayTour()" title="Replay the guided tour on the Thinking Hub home screen">▶ Replay Tour</button>
  </div>
```

- [ ] **Step 2: Add the `replayTour()` function**

In `help-hub.html`, find `closeSidebar()` (around line 653-656):

```javascript
function closeSidebar() {
  document.getElementById('sidebar').classList.remove('open');
  document.getElementById('hh-backdrop').classList.remove('open');
}
```

Add the new function right after it:

```javascript
function closeSidebar() {
  document.getElementById('sidebar').classList.remove('open');
  document.getElementById('hh-backdrop').classList.remove('open');
}

function replayTour() {
  parent.postMessage({ type: 'hub-replay-tour' }, window.location.origin || '*');
}
```

- [ ] **Step 3: Manual verification (button exists and posts correctly)**

Open devtools console on `help-hub.html` loaded standalone (file:// is fine) and run:

```javascript
window.addEventListener('message', e => console.log('got message:', e.data));
replayTour();
```

Expected: since there's no real parent window when loaded standalone, this won't throw (postMessage to `parent` when there is no parent frame is a no-op, not an error) — this step just confirms `replayTour` is defined and doesn't throw. Full end-to-end verification happens in Task 3, Step 3, where `help-hub.html` runs inside the actual `index.html` iframe shell.

- [ ] **Step 4: Commit**

```bash
cd "E:/GitHub/Thinking-Hub"
git add help-hub.html
git commit -m "Add Replay Tour button to help-hub.html"
```

---

### Task 3: Handle replay message + add `?` hotkey in `index.html`

**Files:**
- Modify: `E:\GitHub\Thinking-Hub\index.html:2473-2492` (message listener)
- Modify: `E:\GitHub\Thinking-Hub\index.html:2514-2519` (keydown listener)

**Interfaces:**
- Consumes: `{ type: 'hub-replay-tour' }` postMessage from Task 2; existing `startTour()` function (already defined at `index.html:3713`, takes no arguments).
- Produces: nothing new for later tasks — this is the last task in the plan.

- [ ] **Step 1: Handle the `hub-replay-tour` message**

In `index.html`, find the message listener:

```javascript
    window.addEventListener('message', e => {
      if (!e.data) return;
      if (e.origin !== window.location.origin) return;
      if (e.data.type === 'hub-navigate') {
        const { tool, itemId } = e.data;
        if (!tool) return;
        _pendingHighlight = itemId || null;
        openApp(tool);
      }
      if (e.data.type === 'hub-first-project') {
        if (!HubStorage.get('quick-tour-seen-v1')) {
          HubStorage.set('quick-tour-seen-v1', true);
          goHome();
          setTimeout(startWorkflowTour, 400);
        }
      }
      if (e.data.type === 'hub-project-active') {
        updateProjectContextPanel(e.data.project || null);
      }
    });
```

Add a new branch for `hub-replay-tour`, right after the `hub-navigate` branch:

```javascript
    window.addEventListener('message', e => {
      if (!e.data) return;
      if (e.origin !== window.location.origin) return;
      if (e.data.type === 'hub-navigate') {
        const { tool, itemId } = e.data;
        if (!tool) return;
        _pendingHighlight = itemId || null;
        openApp(tool);
      }
      if (e.data.type === 'hub-replay-tour') {
        startTour();
      }
      if (e.data.type === 'hub-first-project') {
        if (!HubStorage.get('quick-tour-seen-v1')) {
          HubStorage.set('quick-tour-seen-v1', true);
          goHome();
          setTimeout(startWorkflowTour, 400);
        }
      }
      if (e.data.type === 'hub-project-active') {
        updateProjectContextPanel(e.data.project || null);
      }
    });
```

(`startTour()` already calls `goHome()` internally before starting, so this works whether the user is currently viewing help-hub or any other tool.)

- [ ] **Step 2: Add the `?` hotkey**

Find the keydown listener:

```javascript
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape') {
        if (document.getElementById('data-modal').style.display === 'flex') { closeDataModal(); return; }
        if (activeAppId && document.activeElement.tagName !== 'INPUT') goHome();
      }
    });
```

Add a `?` branch, guarding against typing in a form field (matching the guard style Onexus uses in its own tour hotkey):

```javascript
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape') {
        if (document.getElementById('data-modal').style.display === 'flex') { closeDataModal(); return; }
        if (activeAppId && document.activeElement.tagName !== 'INPUT') goHome();
      }
      if (e.key === '?') {
        const tag = (document.activeElement && document.activeElement.tagName) || '';
        if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') return;
        e.preventDefault();
        startTour();
      }
    });
```

- [ ] **Step 3: Manual end-to-end verification**

Serve the repo locally (any static server works, e.g. `npx serve` from the repo root) and open `index.html` in a browser:

1. Navigate into Help & Guide (whatever nav item opens `help-hub.html` in the iframe).
2. Click "▶ Replay Tour". Expected: the iframe switches back to the home dashboard and the welcome tour starts (same 4-step tour as `startTour()`'s first run).
3. Skip/finish the tour, click into any text input on the home screen, and press `?`. Expected: nothing happens (typing guard works) — the `?` character does NOT appear oddly or trigger the tour.
4. Click somewhere neutral (not a form field) and press `?`. Expected: the welcome tour starts again.

- [ ] **Step 4: Commit**

```bash
cd "E:/GitHub/Thinking-Hub"
git add index.html
git commit -m "Handle tour replay message and add ? hotkey"
```
