/**
 * hub-toast.js — Lightweight toast notification utility
 *
 * Usage:
 *   showToast('Saved!');
 *   showToast('Export ready', 'success');
 *   showToast('Something went wrong', 'error');
 */
window.showToast = function (message, type = 'default') {
  const existing = document.querySelectorAll('.hub-toast');
  existing.forEach(t => t.remove());

  const toast = document.createElement('div');
  toast.className = 'hub-toast' + (type !== 'default' ? ' hub-toast-' + type : '');
  toast.textContent = message;
  document.body.appendChild(toast);

  requestAnimationFrame(() => {
    requestAnimationFrame(() => toast.classList.add('hub-toast-visible'));
  });

  setTimeout(() => {
    toast.classList.remove('hub-toast-visible');
    setTimeout(() => toast.remove(), 300);
  }, 2600);
};
