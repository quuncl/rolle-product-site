// The tool and ink share the same horizontal progress on the print surface.
export function initCustomizerInteractions({config, onPositionChange}) {
  const board = document.getElementById('previewBoard');
  const surface = document.getElementById('previewPrintSurface');
  const band = document.getElementById('previewBand');
  const tool = document.getElementById('previewPrintCursor');
  const run = document.getElementById('previewRun');
  const status = document.getElementById('previewLiveStatus');
  const center = document.getElementById('previewCenter');
  const motion = matchMedia('(prefers-reduced-motion: reduce)');
  const surfaces = {kraft:'Крафт', white:'Белая бумага', dark:'Тёмный картон'};
  let frame = 0;
  let progress = 0;
  let rolling = null;
  let drag = null;

  function stopPrint() {
    cancelAnimationFrame(frame);
    frame = 0;
    run.disabled = false;
    run.innerHTML = 'Прокатить <span aria-hidden="true">↗</span>';
    board.removeAttribute('aria-busy');
  }

  function reveal(value) {
    progress = Math.max(0, Math.min(100, value));
    band.style.clipPath = `inset(0 ${100 - progress}% 0 0)`;
    tool.style.left = progress + '%';
    tool.setAttribute('aria-valuenow', String(Math.round(progress)));
  }

  function parkTool() {
    progress = 0;
    tool.style.left = '0%';
    tool.setAttribute('aria-valuenow', '0');
  }

  function updatePosition() {
    band.style.top = tool.style.top = `${config.position}%`;
    band.setAttribute('aria-valuenow', String(config.position));
    band.setAttribute('aria-valuetext', `${config.position}% высоты упаковки`);
    center.disabled = config.position === 50;
  }

  function setPosition(value) {
    stopPrint();
    onPositionChange(Math.max(15, Math.min(85, Math.round(value))));
    updatePosition();
    band.style.removeProperty('clip-path');
  }

  tool.addEventListener('pointerdown', event => {
    if (event.button !== 0) return;
    event.preventDefault();
    stopPrint();
    tool.focus({preventScroll:true});
    rolling = {id:event.pointerId, x:event.clientX, progress:progress === 100 ? 0 : progress, width:surface.getBoundingClientRect().width};
    reveal(rolling.progress);
    tool.setPointerCapture(event.pointerId);
    tool.classList.add('is-rolling');
  });
  tool.addEventListener('pointermove', event => {
    if (rolling?.id !== event.pointerId || !rolling.width) return;
    reveal(Math.max(progress, rolling.progress + (event.clientX - rolling.x) / rolling.width * 100));
  });
  for (const event of ['pointerup', 'pointercancel', 'lostpointercapture']) tool.addEventListener(event, () => {
    if (!rolling) return;
    rolling = null;
    tool.classList.remove('is-rolling');
    status.textContent = progress === 100 ? 'Оттиск готов.' : 'Продолжите прокатку вправо.';
    if (progress === 100) parkTool();
  });
  tool.addEventListener('keydown', event => {
    const values = {ArrowLeft:progress-5, ArrowRight:progress+5, Home:0, End:100};
    if (!(event.key in values)) return;
    event.preventDefault();
    stopPrint();
    reveal(values[event.key]);
    status.textContent = `Прокатка ${Math.round(progress)}%.`;
  });

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
  for (const event of ['pointerup', 'pointercancel', 'lostpointercapture']) band.addEventListener(event, () => {
    if (!drag) return;
    drag = null;
    band.classList.remove('is-dragging');
    status.textContent = 'Положение оттиска сохранено.';
  });
  band.addEventListener('keydown', event => {
    const step = event.shiftKey ? 10 : 2;
    const values = {ArrowUp:config.position-step, ArrowDown:config.position+step, Home:15, End:85};
    if (!(event.key in values)) return;
    event.preventDefault();
    setPosition(values[event.key]);
  });
  center.addEventListener('click', () => setPosition(50));

  run.addEventListener('click', () => {
    stopPrint();
    rolling = null;
    tool.classList.remove('is-rolling');
    if (motion.matches) {
      reveal(100);
      parkTool();
      status.textContent = 'Оттиск готов.';
      return;
    }
    reveal(0);
    run.disabled = true;
    run.textContent = 'Печатаем…';
    board.setAttribute('aria-busy', 'true');
    let started;
    function print(now) {
      started ??= now;
      reveal((now - started) / 1800 * 100);
      if (progress < 100) frame = requestAnimationFrame(print);
      else {
        stopPrint();
        status.textContent = 'Оттиск готов. Потяните роллер, чтобы начать снова.';
        parkTool();
      }
    }
    frame = requestAnimationFrame(print);
  });
  motion.addEventListener('change', () => {
    if (motion.matches && frame) { stopPrint(); reveal(100); }
  });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) stopPrint();
  });
  if ('ResizeObserver' in window) new ResizeObserver(() => {
    if (frame) stopPrint();
  }).observe(board);

  function onConfigChange() {
    stopPrint();
    rolling = drag = null;
    tool.classList.remove('is-rolling');
    band.classList.remove('is-dragging');
    updatePosition();
    reveal(0);
    band.style.removeProperty('clip-path');
    document.getElementById('previewMaterial').textContent = surfaces[config.surface];
    status.textContent = 'Возьмите роллер и потяните вправо. Или нажмите «Прокатить».';
  }
  onConfigChange();
  return {onConfigChange};
}
