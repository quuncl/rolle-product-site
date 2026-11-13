import { createRequestValidation } from './request-validation.js?v=53';
import { printFrameAt, PRINT_TIMING } from './roller-print-motion.js?v=66';

/* Логокат — product photography, scroll presentation and local customizer. */
(() => {
'use strict';
const $ = (q, root=document) => root.querySelector(q);
const $$ = (q, root=document) => [...root.querySelectorAll(q)];
const clamp = (x,min,max) => Math.min(max,Math.max(min,x));
const motionPreference = window.matchMedia('(prefers-reduced-motion: reduce)');
let reducedMotion = motionPreference.matches;
motionPreference.addEventListener('change', event => { reducedMotion = event.matches; });

// Navigation and scroll UI
const progress = $('#scroll-progress');
let ticking = false;
function updateProgress(){const height=document.documentElement.scrollHeight-innerHeight;progress.style.width=(height>0?scrollY/height*100:0)+'%';ticking=false;}
window.addEventListener('scroll',()=>{if(!ticking){requestAnimationFrame(updateProgress);ticking=true;}},{passive:true});updateProgress();
$('#menuToggle').addEventListener('click',e=>{const open=$('#mobileMenu').classList.toggle('open');e.currentTarget.setAttribute('aria-expanded',String(open));e.currentTarget.textContent=open?'×':'☰';});
$$('#mobileMenu a').forEach(a=>a.addEventListener('click',()=>{$('#mobileMenu').classList.remove('open');$('#menuToggle').setAttribute('aria-expanded','false');$('#menuToggle').textContent='☰';}));

// Keep native details/summary semantics while animating both directions.
$$('.faq details').forEach(details => {
  const summary = $('summary', details);
  let animation = null;
  let textAnimations = [];
  let expanded = details.open;

  function settle(){
    animation?.cancel();
    textAnimations.forEach(item => item.cancel());
    textAnimations = [];
    animation = null;
    details.open = expanded;
    details.style.removeProperty('height');
    details.style.removeProperty('overflow');
  }

  summary.setAttribute('aria-expanded', String(expanded));
  details.dataset.expanded = String(expanded);
  summary.addEventListener('click', event => {
    event.preventDefault();
    const startHeight = details.getBoundingClientRect().height;
    const wasAnimating = Boolean(animation);
    const answers = [...details.children].filter(child => child !== summary);
    const textStates = answers.map(answer => ({
      opacity: getComputedStyle(answer).opacity,
      transform: getComputedStyle(answer).transform,
    }));
    animation?.cancel();
    textAnimations.forEach(item => item.cancel());
    expanded = !expanded;
    summary.setAttribute('aria-expanded', String(expanded));
    details.dataset.expanded = String(expanded);
    if (reducedMotion || !details.animate){
      settle();
      return;
    }

    // Measure the destination before holding the content open for the transition.
    details.style.removeProperty('height');
    details.open = expanded;
    const endHeight = details.getBoundingClientRect().height;
    details.open = true;
    details.style.height = `${endHeight}px`;
    details.style.overflow = 'hidden';
    animation = details.animate(
      [{height: `${startHeight}px`}, {height: `${endHeight}px`}],
      {duration: 480, easing: 'cubic-bezier(.4, 0, .2, 1)'}
    );
    textAnimations = answers.map((answer, index) => answer.animate([
      wasAnimating ? textStates[index] : {
        opacity: expanded ? 0 : 1,
        transform: expanded ? 'translateY(-8px)' : 'translateY(0)',
      },
      {opacity: expanded ? 1 : 0, transform: expanded ? 'translateY(0)' : 'translateY(-8px)'},
    ], {duration: 480, easing: 'cubic-bezier(.4, 0, .2, 1)', fill: 'both'}));
    animation.onfinish = settle;
  });
  motionPreference.addEventListener('change', () => {
    if (motionPreference.matches) settle();
  });
});

// Two photographed views blend as the visitor scrolls through the product.
function showPhotoViews(sidePhoto, frontPhoto, progress){
  const motion = reducedMotion ? 0 : progress;
  const blend = clamp(.5 + (motion - .5) / .4, 0, 1);
  const frontOpacity = frontPhoto.complete && frontPhoto.naturalWidth
    ? blend * blend * (3 - 2 * blend)
    : 0;
  const transform = `translateY(${-8 * motion}px) rotate(${-9 + 18 * motion}deg) scale(${1 + .06 * motion})`;
  sidePhoto.style.transform = transform;
  frontPhoto.style.transform = transform;
  sidePhoto.style.opacity = 1 - frontOpacity;
  frontPhoto.style.opacity = frontOpacity;
  sidePhoto.alt = frontOpacity > .5
    ? 'Прототип роллера Логокат, вид спереди'
    : 'Прототип роллера Логокат, вид сбоку';
}

const engineering = $('#engineering');
if (engineering){
  const engineeringStage = $('.engineering-photo-stage', engineering);
  const colorMatrix = $('#rollerBodyTint');
  // Each channel maps the source luminance to a preview color, retaining surface detail.
  const bodyColors = {
    black: [[.56, .02], [.56, .02], [.58, .025]],
    yellow: [[1.15, .54], [1.04, .34], [.42, .012]],
    green: [[.56, .04], [1.16, .29], [.72, .09]],
    white: [[1.05, .58], [1.05, .58], [1.05, .59]],
  };
  const colorOptions = $('.roller-colors');
  const colorName = $('#rollerColorName');
  const backgroundOptions = $('.roller-background');
  function updateBodyColor(){
    const selected = $('input:checked', colorOptions);
    const color = selected.value;
    colorName.value = selected.getAttribute('aria-label');
    if (color === 'blue'){
      engineeringStage.style.removeProperty('--body-color-filter');
      return;
    }
    const channels = bodyColors[color].map(([scale, offset]) =>
      `${.2126 * scale} ${.7152 * scale} ${.0722 * scale} 0 ${offset}`
    );
    colorMatrix.setAttribute('values', channels.join(' ') + ' 0 0 0 1 0');
    engineeringStage.style.setProperty('--body-color-filter', 'url(#rollerBodyColor)');
  }
  colorOptions.addEventListener('change', updateBodyColor);
  function updatePreviewBackground(){
    engineeringStage.dataset.background = $('input:checked', backgroundOptions).value;
  }
  backgroundOptions.addEventListener('change', updatePreviewBackground);
  function restorePreview(){
    updateBodyColor();
    updatePreviewBackground();
  }
  window.addEventListener('pageshow', restorePreview);
  restorePreview();
  const sections = $$('main > section');
  const engineeringPhoto = $('#engineeringPhoto');
  const engineeringFront = $('#engineeringPhotoFront');
  let frame = 0;
  function updateShot(){
    frame = 0;
    const sectionTops = sections.map(section => section.getBoundingClientRect().top);
    sections.forEach((section, index) => {
      const handoff = reducedMotion ? 0 : clamp(
        (innerHeight - sectionTops[index]) / (innerHeight * .8), 0, 1
      );
      const easedHandoff = handoff * handoff * (3 - 2 * handoff);
      const reveal = reducedMotion ? 1 : clamp((handoff - .04) / .42, 0, 1);
      section.style.setProperty('--handoff', easedHandoff);
      section.style.setProperty('--paper-reveal', reveal * reveal * (3 - 2 * reveal));
    });
    const engineeringBounds = engineering.getBoundingClientRect();
    const engineeringProgress = clamp(
      (innerHeight * .65 - engineeringBounds.top) / (engineeringBounds.height * .65), 0, 1
    );
    showPhotoViews(engineeringPhoto, engineeringFront, engineeringProgress);
  }
  function queueShot(){
    if (!frame) frame = requestAnimationFrame(updateShot);
  }
  engineeringFront.addEventListener('load', queueShot);
  sections.forEach(section => section.classList.add('section-handoff'));
  window.addEventListener('scroll', queueShot, {passive: true});
  window.addEventListener('resize', queueShot);
  motionPreference.addEventListener('change', queueShot);
  queueShot();
}

// Actual interactive print demo (a stylized motion simulation).
const demoPath = $('#printPath'), demoRoller = $('#demoRoller'), demoText = $('#printContent');
const demoInks = ['#262924', '#ce503f', '#346a9f'];
let demoInk = demoInks[0];
function edgeLabel(){return cfg.brand || 'ЛОГОКАТ';}
function makeStamp(logoClass, ink){
  const stamp = document.createElement('span');
  stamp.className = 'stamp-unit';
  if (cfg.logo){
    const logo = document.createElement('span');
    logo.className = logoClass;
    logo.style.backgroundColor = ink;
    logo.style.mask = `url("${cfg.logo}") center / contain no-repeat`;
    logo.style.webkitMask = logo.style.mask;
    logo.setAttribute('role', 'img');
    logo.setAttribute('aria-label', cfg.logoName || 'Логотип');
    stamp.append(logo);
  }
  const label = cfg.logo ? cfg.brand.trim() : edgeLabel();
  if (label){
    const text = document.createElement('span');
    text.textContent = label;
    stamp.append(text);
  }
  return stamp;
}
function fillEdge(container, available, split){
  container.replaceChildren();
  container.style.fontSize = '';
  const gap = densityGap(cfg.density, 40, 24, 12);
  container.style.gap = gap + 'px';
  const box = getComputedStyle(container);
  available = Math.max(0, available - parseFloat(box.paddingLeft || 0) - parseFloat(box.paddingRight || 0));
  if (!available) return;
  const ink = container === demoText ? demoInk : cfg.ink;
  const make = () => makeStamp('edge-logo', ink);
  const probe = make();
  container.append(probe);
  let item = probe.offsetWidth || 1;
  if (item > available){
    const base = parseFloat(getComputedStyle(container).fontSize) || 18;
    container.style.fontSize = Math.max(12, base * available / item * 0.9) + 'px';
    item = probe.offsetWidth || available;
  }
  probe.remove();
  let used = 0;
  const limit = split ? 1 : 6;
  while (used + item <= available + 1 && container.childElementCount < limit){
    container.append(make());
    used += item + gap;
  }
  if (!container.childElementCount) container.append(make());
  container.style.justifyContent = split ? 'center' : 'flex-start';
}
function paintEdges(){
  fillEdge(demoText, demoPath.clientWidth, false);
  const comparePrint = $('#comparePrint');
  if (comparePrint){
    $('#compare').dataset.surface = cfg.surface;
    $('#comparisonPrintSurface').style.mixBlendMode = cfg.ink.toLowerCase() === '#f8f6e9' ? 'normal' : 'multiply';
    comparePrint.style.color = cfg.ink;
    comparePrint.style.borderColor = cfg.ink;
    comparePrint.style.top = cfg.position + '%';
    fillEdge(comparePrint, comparePrint.clientWidth, true);
  }
  demoPath.style.setProperty('--paint', demoInk);
  demoPath.style.mixBlendMode = demoInk.toLowerCase() === '#f8f6e9' ? 'normal' : 'multiply';
  emitDemoDesign();
}
const demoBoard = $('#craftBoard');
const demoBoxPhoto = $('#demoBoxPhoto');
const runDemo = $('#runDemo');
const demoPlaybackLabel = $('span', runDemo);
const demoStatus = $('#demoStatus');
const demoInvitation = $('#demoInvitation');
const demoResultHold = 1400;
let demoAutoplayPending = true;
let demoStartTimer = 0;
let demoVisibility = 0;
let upcomingInks = [];
let demoFrame = 0;
let demoPose = printFrameAt(0);
let demoPhase = 'loading';
let demoElapsed = 0;
let demoRunning = false;
let demoLastNow;
const demoPhases = {
  loading:'Загружаем демонстрацию печати…',
  ready:'Показ начнётся при появлении коробки на экране.',
  press:'Колесо опускается на крышку коробки.',
  roll:'Роллер печатает на крышке.',
  'top-lift':'Оттиск на крышке готов.',
  transfer:'Роллер переходит на боковую грань.',
  'front-press':'Колесо прижимается к боковой грани.',
  'front-roll':'Роллер печатает на боковой грани.',
  'front-lift':'Оттиск на боковой грани готов.',
  pause:'Показ приостановлен.',
  finish:'Оттиск готов.',
};

function emitDemoDesign(){
  demoBoard.dispatchEvent(new CustomEvent('roller-demo-design', {detail:{brand:cfg.brand, ink:demoInk, logo:cfg.logo}}));
}
demoBoard.addEventListener('roller-demo-request-design', emitDemoDesign);

function positionDemo(pose, phase = pose.phase){
  demoPose = pose;
  demoPhase = phase;
  const {progress, frontProgress, lift, turn} = pose;
  if (demoBoard.dataset.modelReady !== 'true') {
    // Locate the front edge of the fallback photograph after responsive sizing.
    const photoBounds = demoBoxPhoto.getBoundingClientRect();
    const boardBounds = demoBoard.getBoundingClientRect();
    const contact = photoBounds.top - boardBounds.top + photoBounds.height * .275;
    demoBoard.style.setProperty('--contact', contact + 'px');
    const distance = demoPath.clientWidth * progress;
    const contactX = demoRoller.offsetWidth / 2;
    const contactY = demoRoller.offsetHeight * .97;
    demoRoller.style.left = (demoPath.offsetLeft + distance - contactX) + 'px';
    demoRoller.style.top = (contact + demoPath.offsetHeight / 2 - contactY) + 'px';
    demoPath.style.clipPath = `inset(0 ${(1 - progress) * 100}% 0 0)`;
  }
  demoBoard.dataset.printProgress = String(progress);
  demoBoard.dataset.frontPrintProgress = String(frontProgress);
  demoBoard.dataset.printLift = String(lift);
  demoBoard.dataset.printTurn = String(turn);
  demoBoard.dataset.demoPhase = phase;
  demoBoard.dispatchEvent(new CustomEvent('roller-demo-state', {detail:pose}));
  const message = demoPhases[phase];
  if (demoStatus.textContent !== message) demoStatus.textContent = message;
}

demoBoard.addEventListener('roller-demo-ready', () => {
  runDemo.disabled = reducedMotion;
  if (reducedMotion) finishDemo();
  else if (demoPhase === 'loading') positionDemo(demoPose, 'ready');
  else if (demoBoard.dataset.modelReady === 'false') positionDemo(demoPose, demoPhase);
  syncDemoPlayback();
});

function finishDemo(){
  suspendDemo();
  demoAutoplayPending = false;
  upcomingInks = [];
  demoRunning = false;
  demoElapsed = PRINT_TIMING.total;
  positionDemo(printFrameAt(demoElapsed));
  demoPath.classList.add('printed');
  demoPlaybackLabel.textContent = 'Повторить показ';
  // Only the completed sequence reveals the invitation, after every ink variant.
  demoInvitation.hidden = false;
}

function rollDemo(now){
  demoFrame = 0;
  if (!demoRunning) return;
  const previousElapsed = demoElapsed;
  const duration = demoBoard.dataset.modelReady === 'false' ? PRINT_TIMING.pass : PRINT_TIMING.total;
  const end = duration + (upcomingInks.length ? demoResultHold : 0);
  if (demoLastNow != null) demoElapsed = Math.min(end, demoElapsed + Math.min(now - demoLastNow, 80));
  demoLastNow = now;
  if (previousElapsed < duration || demoPhase !== 'finish') {
    const state = printFrameAt(Math.min(demoElapsed, duration));
    positionDemo(state, demoElapsed >= duration ? 'finish' : state.phase);
  }
  if (demoElapsed >= end) {
    const nextInk = upcomingInks.shift();
    if (!nextInk) {
      finishDemo();
      return;
    }
    demoElapsed = 0;
    positionDemo(printFrameAt(0));
    demoInk = nextInk;
    paintEdges();
  }
  demoFrame = requestAnimationFrame(rollDemo);
}

function suspendDemo(){
  cancelAnimationFrame(demoFrame);
  demoFrame = 0;
  demoLastNow = null;
}

function syncDemoPlayback(){
  const visible = !document.hidden && demoVisibility >= .01 && !document.querySelector('dialog[open]');
  if (!visible) suspendDemo();
  else if (demoRunning && !demoFrame) demoFrame = requestAnimationFrame(rollDemo);

  if (!visible || !demoAutoplayPending || runDemo.disabled || reducedMotion || demoVisibility < .4) {
    clearTimeout(demoStartTimer);
    demoStartTimer = 0;
  } else if (!demoStartTimer) {
    // Let a fast scroll past the scene finish without consuming the first play.
    demoStartTimer = setTimeout(() => {
      demoStartTimer = 0;
      startDemo();
    }, 250);
  }
}

function startDemo(){
  demoAutoplayPending = false;
  demoInvitation.hidden = true;
  if (demoPhase !== 'pause') {
    demoElapsed = 0;
    upcomingInks = demoInks.slice(1);
    demoInk = demoInks[0];
    positionDemo(printFrameAt(0));
    paintEdges();
  }
  demoPath.classList.remove('printed');
  demoRunning = true;
  demoLastNow = null;
  demoPlaybackLabel.textContent = 'Приостановить показ';
  syncDemoPlayback();
}

runDemo.addEventListener('click', () => {
  if (demoRunning) {
    suspendDemo();
    demoRunning = false;
    positionDemo(demoPose, 'pause');
    demoPlaybackLabel.textContent = 'Продолжить показ';
  } else startDemo();
});

if ('IntersectionObserver' in window) {
  const observer = new IntersectionObserver(([entry]) => {
    demoVisibility = entry.intersectionRatio;
    syncDemoPlayback();
  }, {threshold:[0, .01, .4]});
  observer.observe(demoBoard);
} else {
  function measureDemoVisibility(){
    const {top, bottom, height} = demoBoard.getBoundingClientRect();
    demoVisibility = height ? Math.max(0, Math.min(innerHeight, bottom) - Math.max(0, top)) / height : 0;
    syncDemoPlayback();
  }
  window.addEventListener('scroll', measureDemoVisibility, {passive:true});
  window.addEventListener('resize', measureDemoVisibility);
  measureDemoVisibility();
}
document.addEventListener('visibilitychange', syncDemoPlayback);
const demoDialogObserver = new MutationObserver(syncDemoPlayback);
$$('dialog').forEach(dialog => demoDialogObserver.observe(dialog, {attributes:true, attributeFilter:['open']}));
window.addEventListener('resize', () => {positionDemo(demoPose, demoPhase); paintEdges();});
async function markDemoBoxLoaded(){
  try { await demoBoxPhoto.decode(); } catch { /* Keep the embedded preview as a fallback. */ }
  if (demoBoxPhoto.naturalWidth) demoBoxPhoto.parentElement.classList.add('is-loaded');
  positionDemo(demoPose, demoPhase);
  paintEdges();
}
demoBoxPhoto.addEventListener('load', markDemoBoxLoaded);
motionPreference.addEventListener('change', () => {
  if (demoPhase === 'loading') return;
  runDemo.disabled = reducedMotion;
  if (reducedMotion) finishDemo();
  syncDemoPlayback();
});
positionDemo(demoPose, demoPhase);

// Customizer with real controls, local image upload and SVG export.
const cfg={brand:'ЛОГОКАТ',ink:'#252923',surface:'kraft',density:2,position:50,logo:null,logoName:null,logoNote:null};
let customizerUI;
const densityNames={1:'Редкий',2:'Средний',3:'Частый'};
const densityLabel=v=>{
  const n=Number(v);
  if(n<1.5) return densityNames[1];
  if(n<2.5) return densityNames[2];
  return densityNames[3];
};
const densityGap=(v,rare,mid,dense)=>{
  const n=Math.min(3,Math.max(1,Number(v)||2));
  if(n<=2) return rare+(mid-rare)*(n-1);
  return mid+(dense-mid)*(n-2);
};
const logoIdle='';
function setLogoCheck(message, state){
  const note=$('#logoCheck');
  if(!note) return;
  note.textContent=message;
  note.hidden=!message;
  note.classList.toggle('is-warn', state==='warn');
  note.classList.toggle('is-ok', state==='ok');
}
function loadImageSize(src){
  return new Promise((resolve,reject)=>{
    const img=new Image();
    img.onload=()=>resolve({width:img.naturalWidth||img.width,height:img.naturalHeight||img.height});
    img.onerror=()=>reject(new Error('image'));
    img.src=src;
  });
}
function svgHasThinStrokes(text){
  const view=text.match(/viewBox=["']?\s*([-\d.]+)[,\s]+([-\d.]+)[,\s]+([-\d.]+)[,\s]+([-\d.]+)/i);
  const height=Math.max(view?Math.abs(Number(view[4])):100, 1);
  const widths=[];
  for(const match of text.matchAll(/stroke-width\s*[:=]\s*["']?\s*([0-9]*\.?[0-9]+)/gi)) widths.push(Number(match[1]));
  for(const match of text.matchAll(/strokeWidth\s*[:=]\s*["']?\s*([0-9]*\.?[0-9]+)/gi)) widths.push(Number(match[1]));
  // Thin if a stroke is under ~1.2% of the artwork height (about 0.4 mm on a 12 mm band).
  if(widths.some(width=>width>0 && width/height < 0.012)) return true;
  return !widths.length && /stroke\s*[:=]/i.test(text) && height>80;
}
function rasterHasThinMarks(src){
  return new Promise(resolve=>{
    const img=new Image();
    img.onload=()=>{
      const size=220;
      const canvas=document.createElement('canvas');
      canvas.width=size;
      canvas.height=size;
      const ctx=canvas.getContext('2d',{willReadFrequently:true});
      if(!ctx){resolve(false);return;}
      ctx.clearRect(0,0,size,size);
      ctx.drawImage(img,0,0,size,size);
      const data=ctx.getImageData(0,0,size,size).data;
      let thin=0,runs=0;
      for(let y=0;y<size;y+=3){
        let run=0;
        for(let x=0;x<size;x++){
          const alpha=data[(y*size+x)*4+3];
          if(alpha>36) run+=1;
          else if(run){
            runs+=1;
            if(run<=2) thin+=1;
            run=0;
          }
        }
        if(run){
          runs+=1;
          if(run<=2) thin+=1;
        }
      }
      resolve(runs>24 && thin/runs>0.22);
    };
    img.onerror=()=>resolve(false);
    img.src=src;
  });
}
async function inspectLogo(file, src){
  const notes=[];
  let state='ok';
  try{
    const size=await loadImageSize(src);
    const band=$('#previewBand');
    const bandH=Math.max(band?.clientHeight||48, 36);
    const bandW=Math.max(band?.clientWidth||240, 160);
    const previewH=Math.min(bandH*0.72, 68);
    const previewW=previewH*(size.width/Math.max(size.height,1));
    if(previewW>bandW*0.92){
      notes.push('Знак шире полосы предпросмотра: повтор придётся уменьшить, детали могут потеряться.');
      state='warn';
    }
    if(size.height>size.width*1.35){
      notes.push('Логотип выше полосы печати: в оттиске он сплющится по высоте.');
      state='warn';
    }
    if(file.type!=='image/svg+xml' && size.width<420){
      notes.push('Растр мелковат для клише. Перед производством нужен более крупный файл.');
      state='warn';
    }
    if(file.type==='image/svg+xml'){
      const svgText=await file.text();
      if(svgHasThinStrokes(svgText)){
        notes.push('В SVG есть линии тоньше ориентира ~0,4 мм. Для клише их обычно утолщают.');
        state='warn';
      }
    }else if(await rasterHasThinMarks(src)){
      notes.push('На растре заметны тонкие штрихи. На клише они могут пропасть или рваться.');
      state='warn';
    }
  }catch{
    notes.push('Файл загружен, но автоматическая проверка не удалась. Толщину линий нужно оценить вручную.');
    state='warn';
  }
  if(!notes.length){
    notes.push('Предварительно: знак помещается в полосу. Финальная проверка толщины линий — перед производством.');
  }
  return {state, message:notes.join(' ')};
}
function repeatNode(){
  const container = $('#previewRepeat');
  const band = container.parentElement;
  const board = $('#previewPrintSurface');
  band.style.left = '4%';
  band.style.width = '92%';
  band.style.top = cfg.position + '%';
  band.style.height = 'auto';
  band.style.transform = 'translateY(-50%)';
  band.style.overflow = 'hidden';
  const available = board.clientWidth ? band.clientWidth : 0;
  container.replaceChildren();
  container.style.fontSize = '';
  container.style.width = 'max-content';
  container.style.maxWidth = '100%';
  container.style.marginInline = 'auto';
  const gap = densityGap(cfg.density, 48, 28, 12);
  container.style.gap = gap + 'px';
  if (!available) return;

  const addCopy = () => makeStamp('mask-logo', cfg.ink);

  const probe = addCopy();
  container.append(probe);
  let itemWidth = probe.offsetWidth;
  if (itemWidth > available){
    const base = parseFloat(getComputedStyle(container).fontSize) || 24;
    container.style.fontSize = Math.max(13, base * available / itemWidth * 0.92) + 'px';
    itemWidth = probe.offsetWidth;
  }
  probe.remove();
  if (!itemWidth) return;

  let used = 0;
  while (used + itemWidth <= available + 1 && container.childElementCount < 8){
    container.append(addCopy());
    used += itemWidth + gap;
  }
  while (container.childElementCount > 1 && container.scrollWidth > available + 1){
    container.lastElementChild.remove();
  }
}
function paintDensity(range){
  const min=Number(range.min)||1;
  const max=Number(range.max)||3;
  const value=Number(range.value)||2;
  const pct=((value-min)/(max-min))*100;
  range.style.setProperty('--density-fill', pct + '%');
  range.setAttribute('aria-valuetext', densityLabel(value));
}
function renderConfig(){const board=$('#previewBoard');board.dataset.surface=cfg.surface;$('#previewBand').style.setProperty('--ink',cfg.ink);$('#previewBand').style.mixBlendMode=cfg.ink.toLowerCase()==='#f8f6e9'?'normal':'multiply';repeatNode();paintEdges();$('#densityValue').textContent=densityLabel(cfg.density);paintDensity($('#densityRange'));customizerUI?.onConfigChange();}
$('#brandInput').addEventListener('input',e=>{cfg.brand=e.target.value.slice(0,22).toUpperCase();renderConfig();});
$$('#builderSwatches .builder-swatch').forEach(s=>s.addEventListener('click',()=>{cfg.ink=s.dataset.color;$$('#builderSwatches .builder-swatch').forEach(t=>{t.classList.toggle('active',t===s);t.setAttribute('aria-pressed',String(t===s));});renderConfig();}));
$$('.surface-switch button').forEach(s=>s.addEventListener('click',()=>{cfg.surface=s.dataset.surface;$$('.surface-switch button').forEach(t=>{t.classList.toggle('active',t===s);t.setAttribute('aria-pressed',String(t===s));});renderConfig();}));
$('#densityRange').addEventListener('input',e=>{cfg.density=Number(e.target.value);renderConfig();});
$('#logoUpload').addEventListener('change',e=>{const f=e.target.files?.[0];if(!f)return;if(f.size>3*1024*1024){alert('Логотип должен быть не больше 3 МБ.');e.target.value='';setLogoCheck(logoIdle,'');return;}const ok=['image/png','image/jpeg','image/svg+xml'].includes(f.type);if(!ok){alert('Поддерживаются PNG, JPG и SVG.');e.target.value='';setLogoCheck(logoIdle,'');return;}setLogoCheck('Проверяем логотип для полосы печати…','');const reader=new FileReader();reader.onload=async()=>{const src=String(reader.result);const check=await inspectLogo(f,src);cfg.logo=src;cfg.logoName=f.name;cfg.logoNote=check.message;$('#resetLogo').hidden=false;setLogoCheck(check.message,check.state);renderConfig();};reader.readAsDataURL(f);});
$('#resetLogo').addEventListener('click',()=>{cfg.logo=null;cfg.logoName=null;cfg.logoNote=null;$('#logoUpload').value='';$('#resetLogo').hidden=true;setLogoCheck(logoIdle,'');renderConfig();});
setLogoCheck(logoIdle,'');
renderConfig();
if (demoBoxPhoto.complete) markDemoBoxLoaded();
import('./customizer-interactions.js?v=85').then(({initCustomizerInteractions}) => {
  customizerUI = initCustomizerInteractions({
    config: cfg,
    onPositionChange(position){ cfg.position = position; $('#comparePrint').style.top = position + '%'; },
  });
}).catch(error => console.warn('Дополнительные жесты предпросмотра недоступны.', error));
if ('ResizeObserver' in window){
  let fittedWidth = 0;
  new ResizeObserver(() => {
    const width = $('#previewBand').clientWidth;
    if (width && width !== fittedWidth){
      fittedWidth = width;
      repeatNode();
    }
  }).observe($('#previewBand'));
}

// Refit ink once the bundled fonts replace the initial fallback metrics.
document.fonts.ready.then(() => { repeatNode(); paintEdges(); });
function download(name,content,type){const blob=new Blob([content],{type}),url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),2000);}


// Before / after drag interaction.
const compareRange=$('#compareRange');function updateCompare(v){const percent=clamp(Number(v)||0,0,100);$('#compareBefore').style.clipPath=`inset(0 ${100-percent}% 0 0)`;$('#compareDivider').style.left=percent+'%';compareRange.setAttribute('aria-valuetext',`${percent}% чистой коробки, ${100-percent}% с оттиском`);}compareRange.addEventListener('input',e=>updateCompare(e.target.value));updateCompare(compareRange.value);

// Order flow: prepare a genuine downloadable request, no false promise of sending a purchase.
const surfaceNames={kraft:'Крафт',white:'Белая бумага',dark:'Тёмный картон'};
const inkNames={'#252923':'Чёрный','#ce503f':'Красный','#f8f6e9':'Белый','#b68d3a':'Золотой'};
const inkLabel=()=>inkNames[String(cfg.ink).toLowerCase()]||cfg.ink;
const surfaceLabel=()=>surfaceNames[cfg.surface]||cfg.surface;
const logoLabel=()=>cfg.logoName||'Не загружен';
function requestText(){return `Логокат — ЗАЯВКА НА ПЕРСОНАЛЬНЫЙ РОЛЛЕР\n\nЭто макет для обсуждения с производителем, не заказ и не счёт.\n\nБренд: ${cfg.brand||'без названия'}\nЦвет оттиска: ${inkLabel()}\nПоверхность: ${surfaceLabel()}\nИнтервал повторения: ${densityLabel(cfg.density)}\nПоложение оттиска: ${cfg.position}% высоты упаковки (эскиз)\nЗагруженный логотип: ${logoLabel()}\nИмя: ${$('#customerName').value.trim()||'не указано'}\nКонтакт: ${$('#customerContact').value.trim()||'не указан'}\n\nДальше: файл можно переслать производителю. Цена, срок, наличие и гарантия цвета печати не зафиксированы — их подтверждают отдельно после проверки макета.\n`;}
$('#requestBtn').addEventListener('click',()=>{
  const summary=$('#requestSummary');
  summary.replaceChildren();
  const title=document.createElement('div');
  title.className='request-summary-title';
  const caption=document.createElement('span');
  caption.textContent='Ваш оттиск';
  const edit=document.createElement('button');
  edit.type='button';
  edit.textContent='Изменить';
  edit.addEventListener('click',()=>{
    $('#requestDialog').close();
    $('#brandInput').focus();
  });
  title.append(caption,edit);
  summary.append(title);
  const proof=document.createElement('div');
  proof.className='request-imprint';
  proof.dataset.surface=cfg.surface;
  proof.style.setProperty('--proof-ink',cfg.ink);
  const stamp=document.createElement('div');
  stamp.className='request-imprint-band';
  stamp.append(makeStamp('request-imprint-logo', cfg.ink));
  proof.append(stamp);
  summary.append(proof);
  const facts=document.createElement('dl');
  facts.className='request-summary-facts';
  const details=[['Цвет печати',inkLabel()],['Материал',surfaceLabel()],['Повторение',densityLabel(cfg.density)],['Положение',cfg.position===50?'По центру':cfg.position+'% высоты']];
  if(cfg.logo) details.push(['Логотип',logoLabel()],['Название',cfg.brand||'—']);
  details.forEach(([key,value])=>{
    const row=document.createElement('div');
    row.className='request-summary-row';
    const label=document.createElement('dt');
    label.className='request-summary-key';
    label.textContent=key;
    const val=document.createElement('dd');
    val.className='request-summary-val';
    val.textContent=value;
    row.append(label,val);
    facts.append(row);
  });
  summary.append(facts);
  $('#requestDialog').showModal();
  $('#requestDialog .request-content').scrollTop = 0;
  $('#requestTitle').focus({preventScroll:true});
});
const requestValidation = createRequestValidation($('#requestForm'));
$('#requestForm').addEventListener('submit', event => {
  event.preventDefault();
  if (!requestValidation.validateAndNormalize()) return;
  const val = requestText();
  download('logokat-zayavka.txt', val, 'text/plain;charset=utf-8');
  $('#requestDialog').close();
});
$('#requestDialog .close-dialog').addEventListener('click', () => $('#requestDialog').close());
$('#requestDialog').addEventListener('click',e=>{if(e.target===$('#requestDialog'))$('#requestDialog').close();});

})();
