/* A single invitation after five seconds of visible browsing, stored locally. */
(() => {
  'use strict';
  const dialog = document.getElementById('previewOffer');
  if (!dialog || typeof dialog.showModal !== 'function') return;

  const storageKey = 'rolle-preview-offer-seen';
  let pending = true;
  try { pending = sessionStorage.getItem(storageKey) !== '1'; } catch { /* Storage can be disabled. */ }
  let remaining = 5000;
  let startedAt = null;
  let timer;

  function remember() {
    pending = false;
    pause();
    try { sessionStorage.setItem(storageKey, '1'); } catch { /* In-memory state still prevents repeats. */ }
  }

  function pause() {
    clearTimeout(timer);
    if (startedAt !== null) remaining = Math.max(0, remaining - (performance.now() - startedAt));
    startedAt = null;
  }

  function schedule() {
    if (!pending || document.hidden || startedAt !== null) return;
    startedAt = performance.now();
    timer = setTimeout(() => {
      pause();
      // Do not stack dialogs or interrupt someone who has already started designing.
      if (document.querySelector('dialog[open]')) return;
      if (location.hash === '#customizer') { remember(); return; }
      dialog.showModal();
      remember();
    }, remaining);
  }

  document.addEventListener('visibilitychange', () => document.hidden ? pause() : schedule());
  // Resume a pending offer once another modal closes, without polling.
  document.addEventListener('close', schedule, true);
  // Reaching the intended destination makes the invitation unnecessary.
  document.addEventListener('focusin', event => {
    if (event.target.closest('#customizer')) remember();
  });
  addEventListener('hashchange', () => {
    if (location.hash === '#customizer') remember();
  });
  addEventListener('pagehide', pause);
  addEventListener('pageshow', schedule);

  for (const button of dialog.querySelectorAll('.preview-offer-close, .preview-offer-later')) {
    button.addEventListener('click', () => dialog.close());
  }
  dialog.addEventListener('click', event => {
    if (event.target !== dialog) return;
    const rect = dialog.getBoundingClientRect();
    if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) dialog.close();
  });
  dialog.querySelector('.preview-offer-cta').addEventListener('click', () => {
    dialog.close();
    // Let native anchor navigation focus the destination after leaving the modal.
    document.getElementById('customizer').tabIndex = -1;
  });
  schedule();
})();
