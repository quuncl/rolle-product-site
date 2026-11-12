import { createRequestValidation } from './request-validation.js?v=53';

/* ROLLÉ — product photography, scroll presentation and local customizer. */
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
function showPhotoViews(sidePhoto, frontPhoto, progress, dimOverlap = false){
  const motion = reducedMotion ? 0 : progress;
  const blendWidth = dimOverlap ? .32 : .4;
  const blend = clamp(.5 + (motion - .5) / blendWidth, 0, 1);
  const frontOpacity = frontPhoto.complete && frontPhoto.naturalWidth
    ? blend * blend * (3 - 2 * blend)
    : 0;
  const transform = `translateY(${-8 * motion}px) rotate(${-9 + 18 * motion}deg) scale(${1 + .06 * motion})`;
  sidePhoto.style.transform = transform;
  frontPhoto.style.transform = transform;
  const sideOpacity = 1 - frontOpacity;
  sidePhoto.style.opacity = dimOverlap ? sideOpacity ** 2.25 : sideOpacity;
  frontPhoto.style.opacity = dimOverlap ? frontOpacity ** 2.25 : frontOpacity;
  sidePhoto.alt = frontOpacity > .5
    ? 'Прототип роллера ROLLÉ, вид спереди'
    : 'Прототип роллера ROLLÉ, вид сбоку';
}

const heroPhoto = $('#heroProductPhoto');
if (heroPhoto){
  const frontPhoto = $('#heroProductPhotoFront');
  const story = $('#hero');
  const stage = $('.hero', story);
  const photoStage = $('.hero-photo-stage', stage);
  const engineeringStage = $('.engineering-photo-stage');
  const photoStages = [photoStage, engineeringStage];
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
      photoStages.forEach(preview => preview.style.removeProperty('--body-color-filter'));
      return;
    }
    const channels = bodyColors[color].map(([scale, offset]) =>
      `${.2126 * scale} ${.7152 * scale} ${.0722 * scale} 0 ${offset}`
    );
    colorMatrix.setAttribute('values', channels.join(' ') + ' 0 0 0 1 0');
    photoStages.forEach(preview => preview.style.setProperty('--body-color-filter', 'url(#rollerBodyColor)'));
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
  const engineering = $('#engineering');
  const sections = $$('main > section');
  const engineeringPhoto = $('#engineeringPhoto');
  const engineeringFront = $('#engineeringPhotoFront');
  let frame = 0;
  function updateShot(){
    frame = 0;
    const storyBounds = story.getBoundingClientRect();
    const stageBounds = stage.getBoundingClientRect();
    const travel = storyBounds.height - stageBounds.height;
    const progress = travel > 0
      ? clamp((stageBounds.top - storyBounds.top) / travel, 0, 1)
      : 0;
    stage.style.setProperty('--shot-progress', progress);
    showPhotoViews(heroPhoto, frontPhoto, progress, true);
    photoStage.style.setProperty('--hero-wheel-pose', heroPhoto.style.transform);
    photoStage.style.setProperty('--hero-wheel-side-opacity', heroPhoto.style.opacity);
    photoStage.style.setProperty('--hero-wheel-front-opacity', frontPhoto.style.opacity);
    const sectionTops = sections.map(section => section.getBoundingClientRect().top);
    sections.forEach((section, index) => {
      const handoff = reducedMotion ? 0 : clamp(
        (innerHeight - sectionTops[index]) / (innerHeight * .8), 0, 1
      );
      const easedHandoff = handoff * handoff * (3 - 2 * handoff);
      const reveal = reducedMotion ? 1 : clamp((handoff - .04) / .42, 0, 1);
      section.style.setProperty('--handoff', easedHandoff);
      section.style.setProperty('--paper-reveal', reveal * reveal * (3 - 2 * reveal));
      if (index === 0) story.style.setProperty('--handoff', easedHandoff);
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
  function measureStage(){
    story.style.setProperty('--hero-height', stage.offsetHeight + 'px');
    queueShot();
  }
  frontPhoto.addEventListener('load', queueShot);
  engineeringFront.addEventListener('load', queueShot);
  story.classList.add('is-animated');
  sections.forEach(section => section.classList.add('section-handoff'));
  window.addEventListener('scroll', queueShot, {passive: true});
  window.addEventListener('resize', measureStage);
  motionPreference.addEventListener('change', queueShot);
  if ('ResizeObserver' in window) new ResizeObserver(measureStage).observe(stage);
  measureStage();
}

// Actual interactive print demo (a stylized motion simulation).
const demoPath=$('#printPath'), demoRoller=$('#demoRoller'), demoText=$('#printContent');let demoInk='#262924';
function edgeLabel(){return cfg.brand || 'ВАШ БРЕНД';}
function fillEdge(container, available, split){
  container.replaceChildren();
  container.style.fontSize = '';
  const gap = densityGap(cfg.density, 40, 24, 12);
  container.style.gap = gap + 'px';
  const box = getComputedStyle(container);
  available = Math.max(0, available - parseFloat(box.paddingLeft || 0) - parseFloat(box.paddingRight || 0));
  if (!available) return;
  const ink = container === demoText ? demoInk : cfg.ink;
  const make = () => {
    if (cfg.logo){
      const mark = document.createElement('span');
      mark.className = 'edge-logo';
      mark.style.backgroundColor = ink;
      mark.style.mask = `url("${cfg.logo}") center / contain no-repeat`;
      mark.style.webkitMask = mark.style.mask;
      return mark;
    }
    const copy = document.createElement('span');
    copy.textContent = edgeLabel();
    return copy;
  };
  const probe = make();
  container.append(probe);
  let item = probe.offsetWidth || 1;
  if (!cfg.logo && item > available){
    const base = parseFloat(getComputedStyle(container).fontSize) || 18;
    container.style.fontSize = Math.max(12, base * available / item * 0.9) + 'px';
    item = probe.offsetWidth || available;
  }
  probe.remove();
  let used = 0;
  const limit = split ? 2 : 6;
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
}
const demoBoard = $('#craftBoard');
const demoBoxPhoto = $('#demoBoxPhoto');
let demoFrame = 0;
let demoProgress = 0;

function positionDemo(progress){
  demoProgress = progress;
  // The photograph stays proportional. Locate its front edge after responsive sizing.
  const photoBounds = demoBoxPhoto.getBoundingClientRect();
  const boardBounds = demoBoard.getBoundingClientRect();
  const contact = photoBounds.top - boardBounds.top + photoBounds.height * .275;
  demoBoard.style.setProperty('--contact', contact + 'px');
  const distance = demoPath.clientWidth * progress;
  demoRoller.style.left = (demoPath.offsetLeft + distance) + 'px';
  demoRoller.style.top = (contact + demoPath.offsetHeight / 2 - demoRoller.offsetHeight * .32) + 'px';
  demoPath.style.clipPath = `inset(0 ${(1 - progress) * 100}% 0 0)`;
  // No-slip rolling: the angle is the distance travelled divided by wheel radius.
  const radius = demoRoller.offsetHeight * .15;
  demoRoller.style.setProperty('--wheel-angle', `${distance / radius}rad`);
}

function finishDemo(){
  demoFrame = 0;
  positionDemo(1);
  demoPath.classList.add('printed');
  $('#runDemo').textContent = 'Повторить печать ↗';
  $('#demoStatus').textContent = 'Прокат завершён. Повторы легли вдоль края коробки.';
}

$('#runDemo').addEventListener('click', () => {
  cancelAnimationFrame(demoFrame);
  demoPath.classList.remove('printed');
  $('#runDemo').textContent = 'Начать заново ↗';
  $('#demoStatus').textContent = 'Роллер наносит рисунок.';
  positionDemo(0);
  if (reducedMotion){
    finishDemo();
    return;
  }
  let started;
  function roll(now){
    started ??= now;
    const progress = clamp((now - started) / 3400, 0, 1);
    positionDemo(progress);
    if (progress < 1){
      demoFrame = requestAnimationFrame(roll);
    } else {
      finishDemo();
    }
  }
  demoFrame = requestAnimationFrame(roll);
});
window.addEventListener('resize', () => {positionDemo(demoProgress); paintEdges();});
demoBoxPhoto.addEventListener('load', () => {positionDemo(demoProgress); paintEdges();});
motionPreference.addEventListener('change', () => {
  if (reducedMotion && demoFrame){
    cancelAnimationFrame(demoFrame);
    finishDemo();
  }
});
positionDemo(0);
$$('#demoSwatches .swatch').forEach(s=>s.addEventListener('click',()=>{demoInk=s.dataset.ink;$$('#demoSwatches .swatch').forEach(t=>t.classList.toggle('active',t===s));paintEdges();}));

// Customizer with real controls, local image upload and SVG export.
const cfg={brand:'ВАШ БРЕНД',ink:'#252923',surface:'kraft',density:2,position:50,logo:null,logoName:null,logoNote:null};
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
const logoIdle='После загрузки покажем, влезает ли знак в полосу и нет ли слишком тонких линий.';
function setLogoCheck(message, state){
  const note=$('#logoCheck');
  if(!note) return;
  note.textContent=message;
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

  const addCopy = () => {
    if (cfg.logo){
      const img = document.createElement('span');
      img.className = 'mask-logo';
      img.style.display = 'inline-block';
      img.style.backgroundColor = cfg.ink;
      img.style.mask = `url("${cfg.logo}") center / contain no-repeat`;
      img.style.webkitMask = img.style.mask;
      return img;
    }
    const text = document.createElement('span');
    text.textContent = cfg.brand || 'ВАШ БРЕНД';
    return text;
  };

  const probe = addCopy();
  container.append(probe);
  let itemWidth = probe.offsetWidth;
  if (!cfg.logo && itemWidth > available){
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
function renderConfig(){const board=$('#previewBoard');board.dataset.surface=cfg.surface;$('#previewBand').style.setProperty('--ink',cfg.ink);$('#previewPrintSurface').style.mixBlendMode=cfg.ink.toLowerCase()==='#f8f6e9'?'normal':'multiply';repeatNode();paintEdges();$('#densityValue').textContent=densityLabel(cfg.density);paintDensity($('#densityRange'));customizerUI?.onConfigChange();}
$('#brandInput').addEventListener('input',e=>{cfg.brand=e.target.value.slice(0,22).toUpperCase();renderConfig();});
$$('#builderSwatches .builder-swatch').forEach(s=>s.addEventListener('click',()=>{cfg.ink=s.dataset.color;$$('#builderSwatches .builder-swatch').forEach(t=>{t.classList.toggle('active',t===s);t.setAttribute('aria-pressed',String(t===s));});renderConfig();}));
$$('.surface-switch button').forEach(s=>s.addEventListener('click',()=>{cfg.surface=s.dataset.surface;$$('.surface-switch button').forEach(t=>{t.classList.toggle('active',t===s);t.setAttribute('aria-pressed',String(t===s));});renderConfig();}));
$('#densityRange').addEventListener('input',e=>{cfg.density=Number(e.target.value);renderConfig();});
$('#logoUpload').addEventListener('change',e=>{const f=e.target.files?.[0];if(!f)return;if(f.size>3*1024*1024){alert('Логотип должен быть не больше 3 МБ.');e.target.value='';setLogoCheck(logoIdle,'');return;}const ok=['image/png','image/jpeg','image/svg+xml'].includes(f.type);if(!ok){alert('Поддерживаются PNG, JPG и SVG.');e.target.value='';setLogoCheck(logoIdle,'');return;}setLogoCheck('Проверяем логотип для полосы печати…','');const reader=new FileReader();reader.onload=async()=>{const src=String(reader.result);const check=await inspectLogo(f,src);cfg.logo=src;cfg.logoName=f.name;cfg.logoNote=check.message;$('#resetLogo').hidden=false;setLogoCheck(check.message,check.state);renderConfig();};reader.readAsDataURL(f);});
$('#resetLogo').addEventListener('click',()=>{cfg.logo=null;cfg.logoName=null;cfg.logoNote=null;$('#logoUpload').value='';$('#resetLogo').hidden=true;setLogoCheck(logoIdle,'');renderConfig();});
setLogoCheck(logoIdle,'');
renderConfig();
import('./customizer-interactions.js?v=55').then(({initCustomizerInteractions}) => {
  customizerUI = initCustomizerInteractions({
    config: cfg,
    onPreset(text){
      if(cfg.logo) $('#resetLogo').click();
      cfg.brand = text;
      $('#brandInput').value = text;
      renderConfig();
    },
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
const escapeXML=s=>String(s).replace(/[<>&"']/g,c=>({'<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;',"'":'&apos;'}[c]));
function download(name,content,type){const blob=new Blob([content],{type}),url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),2000);}
$('#downloadSvg').addEventListener('click',()=>{const col=cfg.ink;const gap=Math.round(densityGap(cfg.density,320,240,170));let repeat='';for(let i=0;i<5;i++){const x=20+i*gap;if(cfg.logo){repeat+=`<image x="${x}" y="30" width="145" height="80" href="${escapeXML(cfg.logo)}" preserveAspectRatio="xMidYMid meet" />`;}else{repeat+=`<text x="${x}" y="84" fill="${col}" font-size="39" font-family="Arial, sans-serif" font-weight="900">${escapeXML(cfg.brand||'ВАШ БРЕНД')}</text>`;}}const bg=cfg.surface==='kraft'?'#c9a575':cfg.surface==='dark'?'#3c413c':'#ece9df';const note=escapeXML(cfg.logoNote||'Эскиз для обсуждения. Не использовать как файл для изготовления клише.');const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="180" viewBox="0 0 1200 180"><rect width="1200" height="180" fill="${bg}"/><path d="M0 18H1200 M0 142H1200" stroke="${col}" stroke-width="4"/>${repeat}<text x="24" y="168" fill="#6e6e73" font-size="14" font-family="Arial, sans-serif">${note}</text></svg>`;download('rolle-eskiz.svg',svg,'image/svg+xml;charset=utf-8');});

// Before / after drag interaction.
const compareRange=$('#compareRange');function updateCompare(v){const percent=clamp(Number(v)||0,0,100);$('#compareBefore').style.clipPath=`inset(0 ${100-percent}% 0 0)`;$('#compareDivider').style.left=percent+'%';compareRange.setAttribute('aria-valuetext',`${percent}% чистой коробки, ${100-percent}% с оттиском`);}compareRange.addEventListener('input',e=>updateCompare(e.target.value));updateCompare(compareRange.value);

// Order flow: prepare a genuine downloadable request, no false promise of sending a purchase.
const surfaceNames={kraft:'Крафт',white:'Белая бумага',dark:'Тёмный картон'};
const inkNames={'#252923':'Чёрный','#ce503f':'Красный','#f8f6e9':'Белый','#b68d3a':'Золотой'};
const inkLabel=()=>inkNames[String(cfg.ink).toLowerCase()]||cfg.ink;
const surfaceLabel=()=>surfaceNames[cfg.surface]||cfg.surface;
const logoLabel=()=>cfg.logoName||'Не загружен';
function requestText(){return `ROLLÉ — ЗАЯВКА НА ПЕРСОНАЛЬНЫЙ РОЛЛЕР\n\nЭто макет для обсуждения с производителем, не заказ и не счёт.\n\nБренд: ${cfg.brand||'без названия'}\nЦвет оттиска: ${inkLabel()}\nПоверхность: ${surfaceLabel()}\nИнтервал повторения: ${densityLabel(cfg.density)}\nПоложение оттиска: ${cfg.position}% высоты упаковки (эскиз)\nЗагруженный логотип: ${logoLabel()}\nИмя: ${$('#customerName').value.trim()||'не указано'}\nКонтакт: ${$('#customerContact').value.trim()||'не указан'}\n\nДальше: файл можно переслать производителю. Цена, срок, наличие и гарантия цвета печати не зафиксированы — их подтверждают отдельно после проверки макета.\n`;}
$('#requestBtn').addEventListener('click',()=>{
  const summary=$('#requestSummary');
  summary.replaceChildren();
  const title=document.createElement('p');
  title.className='request-summary-title';
  title.textContent='Параметры оттиска';
  summary.append(title);
  [['Название',cfg.brand||'—'],['Цвет',inkLabel()],['Материал',surfaceLabel()],['Повторение',densityLabel(cfg.density)],['Расположение',cfg.position===50?'По центру':cfg.position+'% высоты'],['Логотип',logoLabel()]].forEach(([key,value])=>{
    const row=document.createElement('div');
    row.className='request-summary-row';
    const label=document.createElement('span');
    label.className='request-summary-key';
    label.textContent=key;
    const val=document.createElement('span');
    val.className='request-summary-val';
    val.textContent=value;
    row.append(label,val);
    summary.append(row);
  });
  $('#requestDialog').showModal();
  $('#requestDialog .request-content').scrollTop = 0;
  $('#requestTitle').focus({preventScroll:true});
});
const requestValidation = createRequestValidation($('#requestForm'));
$('#requestForm').addEventListener('submit', event => {
  event.preventDefault();
  if (!requestValidation.validateAndNormalize()) return;
  const val = requestText();
  download('ROLLE-order-request.txt', val, 'text/plain;charset=utf-8');
  $('#requestDialog').close();
});
$('#requestDialog .close-dialog').addEventListener('click', () => $('#requestDialog').close());
$('#requestDialog').addEventListener('click',e=>{if(e.target===$('#requestDialog'))$('#requestDialog').close();});

})();
