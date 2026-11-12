import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

// The supplied assembly is in metres, Y-up. Keep its geometry and part placement.
const modelURL = new URL('./models/roller.glb', import.meta.url);
const motion = matchMedia('(prefers-reduced-motion: reduce)');
const bodyParts = new Set(['Head', 'Handle', 'Adjuster']);
const colors = { blue: '#3159a8', black: '#28282c', yellow: '#f5c535', green: '#42a65e', white: '#f5f5f7' };
const views = [];
let modelPromise;
let frame = 0;
const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

function requestFrame() {
  if (!frame && !document.hidden) frame = requestAnimationFrame(render);
}

function selectedColor() {
  return colors[document.querySelector('[name="roller-color"]:checked')?.value] || colors.blue;
}

function fail(view, error) {
  view.failed = true;
  view.host.dataset.modelReady = 'false';
  view.canvas.hidden = true;
  view.canvas.tabIndex = -1;
  console.warn('3D-сборка недоступна; показано резервное изображение.', error);
}

async function load(view) {
  if (view.started) return;
  view.started = true;
  try {
    const canvas = document.createElement('canvas');
    canvas.className = 'roller-model-canvas';
    canvas.tabIndex = 0;
    canvas.setAttribute('role', 'img');
    canvas.setAttribute('aria-label', '3D-концепт роллера ROLLÉ. Перетаскивайте для вращения или используйте стрелки. Home возвращает исходный ракурс.');
    view.canvas = canvas;
    view.renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, powerPreference: 'low-power' });
    view.renderer.setClearColor(0, 0);
    view.renderer.outputColorSpace = THREE.SRGBColorSpace;
    view.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    view.renderer.toneMappingExposure = 1.15;
    view.scene = new THREE.Scene();
    view.scene.add(new THREE.HemisphereLight('#eef3ff', '#7e828b', 2));
    for (const [color, intensity, position] of [
      ['#fff9f0', 3, [1, 3.5, 4]],
      ['#cbdbff', 1.6, [-3.5, 1, 2]],
      ['#e3ebff', 2.1, [2, 2, -3]],
    ]) {
      const light = new THREE.DirectionalLight(color, intensity);
      light.position.set(...position);
      view.scene.add(light);
    }
    view.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, .01, 30);
    view.tilt = new THREE.Group();
    view.rotator = new THREE.Group();
    view.tilt.add(view.rotator);
    view.scene.add(view.tilt);
    view.host.append(canvas);
    canvas.addEventListener('webglcontextlost', event => {
      event.preventDefault();
      fail(view, 'WebGL context lost');
    });
    canvas.addEventListener('webglcontextrestored', () => {
      view.failed = false;
      canvas.hidden = false;
      canvas.tabIndex = 0;
      requestFrame();
    });
    bindRotation(view);
    new ResizeObserver(requestFrame).observe(view.host);
    // Both scenes share one download and immutable buffers, with separate materials.
    modelPromise ||= new GLTFLoader().loadAsync(modelURL.href);
    const model = (await modelPromise).scene.clone(true);
    const center = new THREE.Box3().setFromObject(model).getCenter(new THREE.Vector3());
    model.position.copy(center).multiplyScalar(-1);
    model.scale.setScalar(10);
    model.position.multiplyScalar(10);
    view.bodyMaterials = [];
    model.traverse(node => {
      if (!node.isMesh) return;
      node.material = node.material.clone();
      if (bodyParts.has(node.name)) view.bodyMaterials.push(node.material);
    });
    // Drum and relief sleeve rotate together about the fixed axle (local Z).
    // Their vertices are stored in assembly coordinates, so use the drum centre
    // as a pivot instead of rotating the meshes about the assembly origin.
    const drum = model.getObjectByName('Drum');
    const sleeve = model.getObjectByName('Sleeve');
    if (drum?.isMesh && sleeve?.isMesh) {
      drum.geometry.computeBoundingBox();
      view.wheel = new THREE.Group();
      drum.updateMatrix();
      drum.geometry.boundingBox.getCenter(view.wheel.position).applyMatrix4(drum.matrix);
      model.add(view.wheel);
      model.updateMatrixWorld(true);
      view.wheel.attach(drum);
      view.wheel.attach(sleeve);
      view.wheelAngle = 0;
    }
    view.rotator.add(model);
    view.loaded = true;
    requestFrame();
  } catch (error) {
    if (view.canvas) fail(view, error);
    else console.warn('WebGL недоступен.', error);
  }
}

function bindRotation(view) {
  const canvas = view.canvas;
  canvas.addEventListener('pointerdown', event => {
    if (event.button !== 0) return;
    view.drag = { id: event.pointerId, x: event.clientX, y: event.clientY };
    canvas.setPointerCapture(event.pointerId);
  });
  canvas.addEventListener('pointermove', event => {
    if (view.drag?.id !== event.pointerId) return;
    view.yaw += (event.clientX - view.drag.x) * .009;
    view.pitch = clamp(view.pitch + (event.clientY - view.drag.y) * .006, -.8, .8);
    view.drag.x = event.clientX;
    view.drag.y = event.clientY;
    view.interacted = true;
    requestFrame();
  });
  for (const event of ['pointerup', 'pointercancel', 'lostpointercapture']) {
    canvas.addEventListener(event, () => { view.drag = null; });
  }
  canvas.addEventListener('keydown', event => {
    if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home'].includes(event.key)) return;
    event.preventDefault();
    if (event.key === 'ArrowLeft') view.yaw -= .18;
    if (event.key === 'ArrowRight') view.yaw += .18;
    if (event.key === 'ArrowUp') view.pitch = clamp(view.pitch - .12, -.8, .8);
    if (event.key === 'ArrowDown') view.pitch = clamp(view.pitch + .12, -.8, .8);
    if (event.key === 'Home') { view.yaw = 0; view.pitch = 0; }
    view.interacted = true;
    requestFrame();
  });
}

function render(now) {
  frame = 0;
  if (document.hidden) return;
  const color = selectedColor();
  let animate = false;
  for (const view of views) {
    if (!view.loaded || !view.visible || view.failed) {
      view.lastTime = null;
      continue;
    }
    const { host, renderer, camera, rotator, tilt } = view;
    const width = host.clientWidth, height = host.clientHeight;
    if (!width || !height) continue;
    const dpr = Math.min(devicePixelRatio || 1, width < 600 ? 1.5 : 1.75);
    if (view.width !== width || view.height !== height || view.dpr !== dpr) {
      renderer.setPixelRatio(dpr);
      renderer.setSize(width, height, false);
      Object.assign(view, { width, height, dpr });
    }
    const auto = !motion.matches && !view.interacted;
    const rolling = !motion.matches && Boolean(view.wheel);
    const elapsed = view.lastTime == null ? 0 : Math.min((now - view.lastTime) / 1000, .05);
    view.lastTime = now;
    if (rolling) {
      // One complete turn every four seconds, independent of display frame rate.
      view.wheelAngle = (view.wheelAngle - elapsed * Math.PI / 2) % (Math.PI * 2);
      view.wheel.rotation.z = view.wheelAngle;
    }
    const scroll = motion.matches ? 0 : parseFloat(getComputedStyle(document.querySelector('.hero')).getPropertyValue('--shot-progress')) || 0;
    rotator.rotation.set(.2 + view.pitch, .6 + view.yaw + (auto ? Math.sin(now * .00025) * .2 + scroll * .65 : 0), 0);
    tilt.rotation.z = view.kind === 'hero' ? -.5 : -.24;
    for (const material of view.bodyMaterials) material.color.set(color);
    const box = new THREE.Box3().setFromObject(tilt);
    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());
    const aspect = width / height;
    const half = Math.max(size.y, size.x / aspect) / 1.75;
    Object.assign(camera, { left: -half * aspect, right: half * aspect, top: half, bottom: -half });
    camera.position.set(center.x, center.y, 8);
    camera.updateProjectionMatrix();
    try {
      renderer.render(view.scene, camera);
      host.dataset.modelReady = 'true';
    } catch (error) { fail(view, error); }
    animate ||= auto || rolling;
  }
  if (animate) requestFrame();
}

for (const host of document.querySelectorAll('[data-roller-viewer]')) {
  views.push({ host, kind: host.dataset.rollerViewer, visible: false, yaw: 0, pitch: 0 });
}
if ('IntersectionObserver' in window) {
  const observer = new IntersectionObserver(entries => {
    for (const entry of entries) {
      const view = views.find(item => item.host === entry.target);
      view.visible = entry.isIntersecting;
      if (view.visible) load(view);
    }
    requestFrame();
  }, { rootMargin: '120px' });
  for (const view of views) observer.observe(view.host);
} else {
  for (const view of views) { view.visible = true; load(view); }
}
document.querySelector('.roller-colors')?.addEventListener('change', requestFrame);
motion.addEventListener('change', requestFrame);
document.addEventListener('visibilitychange', requestFrame);
addEventListener('scroll', requestFrame, { passive: true });
