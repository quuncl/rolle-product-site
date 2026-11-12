// Preview gestures and print playback; configuration and file handling stay in app.js.
export function initCustomizerInteractions({config, onPreset, onPositionChange}) {
  const board = document.getElementById('previewBoard');
  const surface = document.getElementById('previewPrintSurface');
  const band = document.getElementById('previewBand');
  const cursor = document.getElementById('previewPrintCursor');
  const run = document.getElementById('previewRun');
  const status = document.getElementById('previewLiveStatus');
  const center = document.getElementById('previewCenter');
  const examples = [...document.querySelectorAll('[data-brand-example]')];
  const motion = matchMedia('(prefers-reduced-motion: reduce)');
  const surfaces = {kraft:'Крафт', white:'Белая бумага', dark:'Тёмный картон'};
  let printAnimation = null;
  let cursorAnimation = null;
  let drag = null;

  function stopPrint(message) {
    printAnimation?.cancel();
    cursorAnimation?.cancel();
    printAnimation = cursorAnimation = null;
    cursor.hidden = true;
    run.disabled = false;
    run.innerHTML = 'Прокатить <span aria-hidden="true">↗</span>';
    board.removeAttribute('aria-busy');
    if (message) status.textContent = message;
  }

  function updatePosition() {
    band.style.top = `${config.position}%`;
    band.setAttribute('aria-valuenow', String(config.position));
    band.setAttribute('aria-valuetext', `${config.position === 50 ? 'По центру, ' : ''}${config.position}% высоты упаковки`);
    center.disabled = config.position === 50;
  }

  function setPosition(value) {
    stopPrint();
    onPositionChange(Math.max(15, Math.min(85, Math.round(value))));
    updatePosition();
  }

  band.addEventListener('pointerdown', event => {
    if (event.button !== 0) return;
    event.preventDefault();
    stopPrint();
    band.focus({preventScroll:true});
    drag = {id:event.pointerId, y:event.clientY, position:config.position, height:surface.getBoundingClientRect().height};
    band.setPointerCapture(event.pointerId);
    band.classList.add('is-dragging');
  });
  band.addEventListener('pointermove', event => {
    if (drag?.id !== event.pointerId || !drag.height) return;
    setPosition(drag.position + (event.clientY - drag.y) / drag.height * 100);
  });
  for (const event of ['pointerup','pointercancel','lostpointercapture']) band.addEventListener(event, () => {
    if (!drag) return;
    drag = null;
    band.classList.remove('is-dragging');
    status.textContent = `Оттиск на ${config.position}% высоты упаковки. Положение сохранится в заявке.`;
  });
  band.addEventListener('keydown', event => {
    const step = event.shiftKey ? 10 : 2;
    const values = {ArrowUp:config.position-step, ArrowDown:config.position+step, Home:15, End:85};
    if (!(event.key in values)) return;
    event.preventDefault();
    setPosition(values[event.key]);
  });
  center.addEventListener('click', () => {
    setPosition(50);
    status.textContent = 'Оттиск по центру упаковки.';
  });
  for (const button of examples) button.addEventListener('click', () => onPreset(button.dataset.brandExample));

  run.addEventListener('click', () => {
    stopPrint();
    if (motion.matches || typeof band.animate !== 'function') {
      status.textContent = 'Оттиск готов. Это эскиз нанесения, не результат испытаний.';
      return;
    }
    const duration = 1800;
    run.disabled = true;
    run.textContent = 'Прокатываем…';
    status.textContent = 'Наносим ваш рисунок слева направо…';
    board.setAttribute('aria-busy', 'true');
    cursor.style.top = `${config.position}%`;
    cursor.style.height = `${band.offsetHeight + 12}px`;
    cursor.hidden = false;
    const options = {duration, easing:'linear', fill:'both'};
    printAnimation = band.animate([{clipPath:'inset(0 100% 0 0)'}, {clipPath:'inset(0 0 0 0)'}], options);
    cursorAnimation = cursor.animate([{left:'4%'}, {left:'96%'}], options);
    printAnimation.onfinish = () => stopPrint('Оттиск готов. Меняйте настройки и попробуйте ещё раз.');
  });
  motion.addEventListener('change', () => {
    if (motion.matches && printAnimation) stopPrint('Оттиск готов. Это эскиз нанесения.');
  });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && printAnimation) stopPrint();
  });
  if ('ResizeObserver' in window) new ResizeObserver(() => {
    if (printAnimation) stopPrint('Размер предпросмотра изменился. Можно прокатить снова.');
  }).observe(board);

  function onConfigChange() {
    stopPrint();
    updatePosition();
    document.getElementById('previewMaterial').textContent = surfaces[config.surface];
    for (const button of examples) button.setAttribute('aria-pressed', String(!config.logo && config.brand === button.dataset.brandExample));
    status.textContent = config.logo ? 'Логотип в макете. Нажмите «Прокатить», чтобы увидеть нанесение.' : 'Макет обновлён. Нажмите «Прокатить», чтобы увидеть нанесение.';
  }
  onConfigChange();
  return {onConfigChange};
}
