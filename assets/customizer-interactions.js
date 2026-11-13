// The tool and ink share the same horizontal progress on the print surface.
export function initCustomizerInteractions({config, onPositionChange}) {
  const surface = document.getElementById('previewPrintSurface');
  const band = document.getElementById('previewBand');
  const tool = document.getElementById('previewPrintCursor');
  let progress = 0;
  let rolling = null;
  let drag = null;

  function reveal(value) {
    progress = Math.max(0, Math.min(100, value));
    band.style.clipPath = `inset(0 ${100 - progress}% 0 0)`;
    tool.style.left = progress + '%';
    tool.setAttribute('aria-valuenow', String(Math.round(progress)));
    tool.dispatchEvent(new CustomEvent('roller-preview-progress', {detail:{progress:progress / 100}}));
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
  }

  function setPosition(value) {
    onPositionChange(Math.max(15, Math.min(85, Math.round(value))));
    updatePosition();
    band.style.removeProperty('clip-path');
  }

  tool.addEventListener('pointerdown', event => {
    if (event.button !== 0) return;
    event.preventDefault();
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
    if (progress === 100) parkTool();
  });
  tool.addEventListener('keydown', event => {
    const values = {ArrowLeft:progress-5, ArrowRight:progress+5, Home:0, End:100};
    if (!(event.key in values)) return;
    event.preventDefault();
    reveal(values[event.key]);
  });

  band.addEventListener('pointerdown', event => {
    if (event.button !== 0) return;
    event.preventDefault();
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
  });
  band.addEventListener('keydown', event => {
    const step = event.shiftKey ? 10 : 2;
    const values = {ArrowUp:config.position-step, ArrowDown:config.position+step, Home:15, End:85};
    if (!(event.key in values)) return;
    event.preventDefault();
    setPosition(values[event.key]);
  });

  function onConfigChange() {
    rolling = drag = null;
    tool.classList.remove('is-rolling');
    band.classList.remove('is-dragging');
    updatePosition();
    reveal(0);
    band.style.removeProperty('clip-path');
  }
  onConfigChange();
  return {onConfigChange};
}
