/**
 * hub-tutorial.js
 * A lightweight, vanilla JS library for guided interactive tours.
 */

window.HubTutorial = (() => {
  let steps = [];
  let currentIdx = 0;

  let overlayEl = null;
  let tooltipEl = null;

  function injectStyles() {
    if (document.getElementById('hub-tutorial-styles')) return;
    const style = document.createElement('style');
    style.id = 'hub-tutorial-styles';
    style.innerHTML = `
      .ht-mask {
        position: fixed;
        box-shadow: 0 0 0 9999px rgba(0, 0, 0, 0.65);
        border-radius: 8px;
        z-index: 9999;
        pointer-events: none;
        transition: all 0.3s ease;
      }

      .ht-tooltip {
        position: fixed;
        background: var(--surface, #1a1a1f);
        border: 1px solid var(--accent-glow);
        border-radius: 12px;
        width: 320px;
        padding: 20px;
        z-index: 10000;
        box-shadow: 0 12px 40px rgba(0,0,0,0.5);
        color: var(--text, #f0efe8);
        font-family: var(--font-body, 'DM Sans', sans-serif);
        opacity: 0;
        transform: translateY(10px);
        transition: opacity 0.3s ease, transform 0.3s ease;
      }
      .ht-tooltip.ht-show {
        opacity: 1;
        transform: translateY(0);
      }

      .ht-title {
        font-family: var(--font-display, 'Syne', sans-serif);
        font-size: 16px;
        font-weight: 700;
        margin-bottom: 8px;
        color: var(--accent, #b8f033);
      }

      .ht-desc {
        font-size: 13px;
        line-height: 1.5;
        color: var(--text2, #9998a0);
        margin-bottom: 20px;
      }

      .ht-footer {
        display: flex;
        justify-content: space-between;
        align-items: center;
      }

      .ht-dots {
        display: flex;
        gap: 4px;
      }
      .ht-dot {
        width: 6px; height: 6px; border-radius: 50%;
        background: var(--surface3, #383842);
      }
      .ht-dot.active {
        background: var(--accent, #b8f033);
      }

      .ht-btns {
        display: flex; gap: 8px;
      }
      .ht-btn {
        padding: 6px 12px;
        border-radius: 6px;
        border: none;
        font-size: 12px;
        font-weight: 600;
        cursor: pointer;
        font-family: inherit;
        transition: background 0.15s, color 0.15s;
      }
      .ht-btn-ghost {
        background: transparent;
        color: var(--text3, #6d6c78);
      }
      .ht-btn-ghost:hover { color: var(--text, #f0efe8); }

      .ht-btn-primary {
        background: var(--accent, #b8f033);
        color: #111;
      }
      .ht-btn-primary:hover { opacity: 0.85; }
    `;
    document.head.appendChild(style);
  }

  function start(tourSteps) {
    if (!tourSteps || tourSteps.length === 0) return;
    end(); // always start from a clean slate
    steps = tourSteps;
    currentIdx = 0;

    injectStyles();

    overlayEl = document.createElement('div');
    overlayEl.className = 'ht-mask';
    document.body.appendChild(overlayEl);

    tooltipEl = document.createElement('div');
    tooltipEl.className = 'ht-tooltip';
    document.body.appendChild(tooltipEl);

    renderStep();
  }

  function renderStep() {
    const step = steps[currentIdx];
    if (!step) { end(); return; }

    const target = step.element ? document.querySelector(step.element) : null;

    if (target) {
      target.scrollIntoView({ behavior: 'smooth', block: 'center' });
      const rect = target.getBoundingClientRect();
      const pad = step.padding || 8;

      overlayEl.style.top = (rect.top - pad) + 'px';
      overlayEl.style.left = (rect.left - pad) + 'px';
      overlayEl.style.width = (rect.width + pad * 2) + 'px';
      overlayEl.style.height = (rect.height + pad * 2) + 'px';

      let ttTop = rect.bottom + pad + 12;
      let ttLeft = rect.left;

      if (ttTop + 200 > window.innerHeight) {
        ttTop = rect.top - pad - 12 - 200;
      }
      if (ttLeft + 320 > window.innerWidth) {
        ttLeft = window.innerWidth - 320 - 20;
      }

      tooltipEl.style.top = ttTop + 'px';
      tooltipEl.style.left = ttLeft + 'px';
      tooltipEl.style.transform = '';
    } else {
      overlayEl.style.top = '50%';
      overlayEl.style.left = '50%';
      overlayEl.style.width = '0px';
      overlayEl.style.height = '0px';

      tooltipEl.style.top = '50%';
      tooltipEl.style.left = '50%';
      tooltipEl.style.transform = 'translate(-50%, -50%)';
    }

    const dots = steps.map(function(_, i) {
      return '<div class="ht-dot' + (i === currentIdx ? ' active' : '') + '"></div>';
    }).join('');

    const backBtn = currentIdx > 0
      ? '<button class="ht-btn ht-btn-ghost" onclick="HubTutorial.prev()">Back</button>'
      : '';
    const nextLabel = currentIdx === steps.length - 1 ? 'Finish' : 'Next →';

    tooltipEl.innerHTML =
      '<div class="ht-title">' + step.title + '</div>' +
      '<div class="ht-desc">' + step.text + '</div>' +
      '<div class="ht-footer">' +
        '<div class="ht-dots">' + dots + '</div>' +
        '<div class="ht-btns">' +
          '<button class="ht-btn ht-btn-ghost" onclick="HubTutorial.end()">Skip</button>' +
          backBtn +
          '<button class="ht-btn ht-btn-primary" onclick="HubTutorial.next()">' + nextLabel + '</button>' +
        '</div>' +
      '</div>';

    // Remove ht-show first so the fade-in transition re-triggers on every step
    tooltipEl.classList.remove('ht-show');
    setTimeout(function() { tooltipEl.classList.add('ht-show'); }, 50);
  }

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
      overlayEl.remove();
      overlayEl = null;
    }
    if (tooltipEl) {
      tooltipEl.remove();
      tooltipEl = null;
    }
  }

  return { start, next, prev, end };
})();
