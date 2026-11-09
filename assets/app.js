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
  const colorMatrix = $('#rollerBodyTint');
  // Each channel maps the source luminance to a preview color, retaining surface detail.
  const bodyColors = {
    black: [[.56, .02], [.56, .02], [.58, .025]],
    yellow: [[1.15, .54], [1.04, .34], [.42, .012]],
    green: [[.56, .04], [1.16, .29], [.72, .09]],
    white: [[1.05, .58], [1.05, .58], [1.05, .59]],
  };
  const colorOptions = $('.roller-colors', stage);
  const colorName = $('#rollerColorName');
  const backgroundOptions = $('.roller-background', stage);
  function updateBodyColor(){
    const selected = $('input:checked', colorOptions);
    const color = selected.value;
    colorName.value = selected.getAttribute('aria-label');
    if (color === 'blue'){
      photoStage.style.removeProperty('--body-color-filter');
      return;
    }
    const channels = bodyColors[color].map(([scale, offset]) =>
      `${.2126 * scale} ${.7152 * scale} ${.0722 * scale} 0 ${offset}`
    );
    colorMatrix.setAttribute('values', channels.join(' ') + ' 0 0 0 1 0');
    photoStage.style.setProperty('--body-color-filter', 'url(#rollerBodyColor)');
  }
  colorOptions.addEventListener('change', updateBodyColor);
  function updatePreviewBackground(){
    photoStage.dataset.background = $('input:checked', backgroundOptions).value;
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
function fillDemo(){demoText.textContent='';for(let i=0;i<5;i++){const s=document.createElement('span');s.textContent='ROLLÉ × YOUR BRAND';demoText.append(s);}demoPath.style.setProperty('--paint',demoInk);}
fillDemo();
const demoBoard = $('#craftBoard');
let demoFrame = 0;
let demoProgress = 0;

function positionDemo(progress){
  demoProgress = progress;
  const start = 20;
  const span = 60;
  demoRoller.style.left = (start + span * progress) + '%';
  demoPath.style.clipPath = `inset(0 ${(1 - progress) * 100}% 0 0)`;
  // No-slip rolling: the angle is the distance travelled divided by wheel radius.
  const distance = demoBoard.clientWidth * (span / 100) * progress;
  const radius = demoRoller.offsetHeight * .15;
  demoRoller.style.setProperty('--wheel-angle', `${distance / radius}rad`);
}

function finishDemo(){
  demoFrame = 0;
  positionDemo(1);
  demoPath.classList.add('printed');
  $('#runDemo').textContent = 'Повторить печать ↗';
  $('#demoStatus').textContent = 'Прокат завершён. Оттиск нанесён по всей длине.';
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
window.addEventListener('resize', () => positionDemo(demoProgress));
motionPreference.addEventListener('change', () => {
  if (reducedMotion && demoFrame){
    cancelAnimationFrame(demoFrame);
    finishDemo();
  }
});
positionDemo(0);
$$('#demoSwatches .swatch').forEach(s=>s.addEventListener('click',()=>{demoInk=s.dataset.ink;$$('#demoSwatches .swatch').forEach(t=>t.classList.toggle('active',t===s));demoPath.style.setProperty('--paint',demoInk);}));

// Customizer with real controls, local image upload and SVG export.
const cfg={brand:'YOUR BRAND',ink:'#252923',surface:'kraft',density:2,logo:null,logoName:null};
const densityNames={1:'Редкий',2:'Средний',3:'Частый'};
function repeatNode(){
  const container = $('#previewRepeat');
  const available = container.parentElement.clientWidth;
  container.replaceChildren();
  container.style.fontSize = '';
  const gap = cfg.density === 1 ? 48 : cfg.density === 2 ? 28 : 12;
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
    text.textContent = cfg.brand || 'YOUR BRAND';
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

  let used = 0;
  while (used + itemWidth <= available + 1 && container.childElementCount < 8){
    container.append(addCopy());
    used += itemWidth + gap;
  }
}
function renderConfig(){const board=$('#previewBoard');board.dataset.surface=cfg.surface;$('#previewBand').style.setProperty('--ink',cfg.ink);repeatNode();$('#densityValue').textContent=densityNames[cfg.density];}
$('#brandInput').addEventListener('input',e=>{cfg.brand=e.target.value.slice(0,22).toUpperCase();renderConfig();});
$$('#builderSwatches .builder-swatch').forEach(s=>s.addEventListener('click',()=>{cfg.ink=s.dataset.color;$$('#builderSwatches .builder-swatch').forEach(t=>{t.classList.toggle('active',t===s);t.setAttribute('aria-pressed',String(t===s));});renderConfig();}));
$$('.surface-switch button').forEach(s=>s.addEventListener('click',()=>{cfg.surface=s.dataset.surface;$$('.surface-switch button').forEach(t=>{t.classList.toggle('active',t===s);t.setAttribute('aria-pressed',String(t===s));});renderConfig();}));
$('#densityRange').addEventListener('input',e=>{cfg.density=Number(e.target.value);renderConfig();});
$('#logoUpload').addEventListener('change',e=>{const f=e.target.files?.[0];if(!f)return;if(f.size>3*1024*1024){alert('Логотип должен быть не больше 3 МБ.');e.target.value='';return;}const ok=['image/png','image/jpeg','image/svg+xml'].includes(f.type);if(!ok){alert('Поддерживаются PNG, JPG и SVG.');e.target.value='';return;}const reader=new FileReader();reader.onload=()=>{cfg.logo=String(reader.result);cfg.logoName=f.name;$('#resetLogo').hidden=false;renderConfig();};reader.readAsDataURL(f);});
$('#resetLogo').addEventListener('click',()=>{cfg.logo=null;cfg.logoName=null;$('#logoUpload').value='';$('#resetLogo').hidden=true;renderConfig();});renderConfig();
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
$('#downloadSvg').addEventListener('click',()=>{const col=cfg.ink;const gap=cfg.density===1?320:cfg.density===2?240:170;let repeat='';for(let i=0;i<5;i++){const x=20+i*gap;if(cfg.logo){repeat+=`<image x="${x}" y="30" width="145" height="80" href="${escapeXML(cfg.logo)}" preserveAspectRatio="xMidYMid meet" />`;}else{repeat+=`<text x="${x}" y="84" fill="${col}" font-size="39" font-family="Arial, sans-serif" font-weight="900">${escapeXML(cfg.brand||'YOUR BRAND')}</text>`;}}const bg=cfg.surface==='kraft'?'#c9a575':cfg.surface==='dark'?'#3c413c':'#ece9df';const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="160" viewBox="0 0 1200 160"><rect width="1200" height="160" fill="${bg}"/><path d="M0 10H1200 M0 149H1200" stroke="${col}" stroke-width="4"/>${repeat}</svg>`;download('rolle-preview.svg',svg,'image/svg+xml;charset=utf-8');});

// Before / after drag interaction.
const compareRange=$('#compareRange');function updateCompare(v){const percent=Number(v);$('#compareBefore').style.clipPath=`inset(0 ${100-percent}% 0 0)`;$('#compareDivider').style.left=percent+'%';}compareRange.addEventListener('input',e=>updateCompare(e.target.value));updateCompare(compareRange.value);

// Order flow: prepare a genuine downloadable request, no false promise of sending a purchase.
function requestText(){return `ROLLÉ — ЗАЯВКА НА ПЕРСОНАЛЬНЫЙ РОЛЛЕР\n\nБренд: ${cfg.brand||'без названия'}\nЦвет оттиска: ${cfg.ink}\nПоверхность: ${cfg.surface}\nИнтервал повторения: ${densityNames[cfg.density]}\nЗагруженный логотип: ${cfg.logoName||'нет'}\nИмя: ${$('#customerName').value.trim()||'не указано'}\nКонтакт: ${$('#customerContact').value.trim()||'не указан'}\n\nСтатус: прототип конфигурации. Производственный макет, наличие, цена, способы оплаты и сроки подтверждаются отдельно.\n`;}
$('#requestBtn').addEventListener('click',()=>{$('#requestSummary').replaceChildren();[['Название',cfg.brand||'—'],['Цвет',cfg.ink],['Основа',cfg.surface],['Повторение',densityNames[cfg.density]],['Логотип',cfg.logoName||'Текст']].forEach(([key,value])=>{const row=document.createElement('div');const label=document.createElement('b');label.textContent=key+': ';row.append(label,document.createTextNode(value));$('#requestSummary').append(row);});$('#requestDialog').showModal();});
$('#saveRequest').addEventListener('click',()=>{const val=requestText();download('ROLLE-order-request.txt',val,'text/plain;charset=utf-8');$('#requestDialog').close();});
$('#requestDialog').addEventListener('click',e=>{if(e.target===$('#requestDialog'))$('#requestDialog').close();});

})();
