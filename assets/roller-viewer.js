import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { advancePose, takePoseControl, cameraFrame } from './roller-motion.js?v=60';
import { bodyParts, prepareModel, createPartMaterial, lightStudio } from './roller-appearance.js?v=58';
import { createPrintScene } from './roller-print-scene.js?v=66';

// The supplied assembly is in metres, Y-up. Keep its geometry and part placement.
const modelURL = new URL('./models/roller.glb', import.meta.url);
const motion = matchMedia('(prefers-reduced-motion: reduce)');
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

function showModelState(view, state) {
  if (view.host.dataset.modelReady === state) return;
  const ready = state === 'true';
  const interactive = ready && view.kind !== 'demo';
  view.host.dataset.modelReady = state;
  view.host.setAttribute('aria-busy', String(state === 'loading'));
  if (view.canvas) {
    view.canvas.hidden = state === 'false';
    view.canvas.tabIndex = interactive ? 0 : -1;
    view.canvas.setAttribute('aria-hidden', String(!interactive));
  }
  const status = view.host.querySelector('.roller-model-status');
  if (status && !ready) status.textContent = view.kind === 'demo'
    ? (state === 'loading' ? 'Загрузка…' : '3D недоступно')
    : (state === 'loading' ? 'Загрузка 3D-модели…' : '3D не загрузилось. Показано изображение роллера.');
  if (view.kind === 'demo' && state !== 'loading') view.host.dispatchEvent(new CustomEvent('roller-demo-ready'));
}

function fail(view, error) {
  view.failed = true;
  showModelState(view, 'false');
  console.warn('3D-сборка недоступна; показано резервное изображение.', error);
}

async function load(view) {
  if (view.started) return;
  view.started = true;
  view.host.setAttribute('aria-busy', 'true');
  try {
    const canvas = document.createElement('canvas');
    canvas.className = 'roller-model-canvas';
    canvas.tabIndex = -1;
    canvas.setAttribute('aria-hidden', 'true');
    canvas.setAttribute('role', 'img');
    canvas.setAttribute('aria-label', '3D-концепт роллера ROLLÉ. Перетаскивайте для вращения или используйте стрелки. Home возвращает исходный ракурс.');
    view.canvas = canvas;
    view.renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, powerPreference: 'low-power' });
    view.renderer.setClearColor(0, 0);
    view.renderer.outputColorSpace = THREE.SRGBColorSpace;
    view.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    view.scene = new THREE.Scene();
    lightStudio(view);
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
      showModelState(view, 'loading');
      requestFrame();
    });
    if (view.kind !== 'demo') bindRotation(view);
    new ResizeObserver(requestFrame).observe(view.host);
    // All scenes share one download and immutable buffers, with separate materials.
    modelPromise ||= new GLTFLoader().loadAsync(modelURL.href).then(gltf => ({scene:prepareModel(gltf.scene)}));
    const model = (await modelPromise).scene.clone(true);
    const center = new THREE.Box3().setFromObject(model).getCenter(new THREE.Vector3());
    model.position.copy(center).multiplyScalar(-1);
    model.scale.setScalar(10);
    model.position.multiplyScalar(10);
    // Centre the assembly once. Its bounding sphere safely encloses all later poses.
    view.framingRadius = new THREE.Box3().setFromObject(model).getBoundingSphere(new THREE.Sphere()).radius * 1.025;
    view.bodyMaterials = [];
    model.traverse(node => {
      if (!node.isMesh) return;
      node.material = createPartMaterial(node.name, selectedColor());
      node.castShadow = true;
      node.receiveShadow = true;
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
      const sleeveSize = sleeve.geometry.boundingBox.getSize(new THREE.Vector3());
      view.wheelRadiusWorld = Math.max(sleeveSize.x, sleeveSize.y) * model.scale.x / 2;
    }
    view.rotator.add(model);
    if (view.kind === 'demo') {
      view.printScene = await createPrintScene(view);
      view.host.dispatchEvent(new CustomEvent('roller-demo-request-design'));
    }
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
    takePoseControl(view);
    view.drag = { id: event.pointerId, x: event.clientX, y: event.clientY };
    canvas.setPointerCapture(event.pointerId);
    requestFrame();
  });
  canvas.addEventListener('pointermove', event => {
    if (view.drag?.id !== event.pointerId) return;
    view.yaw += (event.clientX - view.drag.x) * .009;
    view.pitch = clamp(view.pitch + (event.clientY - view.drag.y) * .006, -.8, .8);
    view.drag.x = event.clientX;
    view.drag.y = event.clientY;
    requestFrame();
  });
  for (const event of ['pointerup', 'pointercancel', 'lostpointercapture']) {
    canvas.addEventListener(event, () => { view.drag = null; });
  }
  canvas.addEventListener('keydown', event => {
    if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home'].includes(event.key)) return;
    event.preventDefault();
    takePoseControl(view);
    if (event.key === 'ArrowLeft') view.yaw -= .18;
    if (event.key === 'ArrowRight') view.yaw += .18;
    if (event.key === 'ArrowUp') view.pitch = clamp(view.pitch - .12, -.8, .8);
    if (event.key === 'ArrowDown') view.pitch = clamp(view.pitch + .12, -.8, .8);
    if (event.key === 'Home') { view.yaw = 0; view.pitch = 0; }
    requestFrame();
  });
}

function resizeView(view, width, height, dpr) {
  const {renderer, camera} = view;
  renderer.setPixelRatio(dpr);
  renderer.setSize(width, height, false);
  const fixed = view.kind === 'demo';
  if (fixed) view.printScene.resize(width, height);
  else {
    Object.assign(camera, cameraFrame(view.framingRadius, width / height));
    camera.position.set(0, 0, 8);
    camera.updateProjectionMatrix();
    camera.updateMatrixWorld();
  }
  Object.assign(view, {width, height, dpr});
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
      resizeView(view, width, height, dpr);
    }
    const fixed = view.kind === 'demo';
    const rolling = !fixed && !motion.matches && Boolean(view.wheel);
    const elapsed = view.lastTime == null ? 0 : Math.min((now - view.lastTime) / 1000, .05);
    view.lastTime = now;
    const auto = !fixed && advancePose(view, elapsed, {reducedMotion:motion.matches});
    if (rolling) {
      // One complete turn every four seconds, independent of display frame rate.
      view.wheelAngle = (view.wheelAngle - elapsed * Math.PI / 2) % (Math.PI * 2);
      view.wheel.rotation.z = view.wheelAngle;
    }
    if (fixed) {
      view.printScene.update(view.printPose);
    } else {
      rotator.rotation.set(.2 + view.displayedPitch, .6 + view.displayedYaw, 0);
      tilt.rotation.z = -.24;
    }
    for (const material of view.bodyMaterials) material.color.set(color);
    try {
      renderer.render(view.scene, camera);
      showModelState(view, 'true');
    } catch (error) { fail(view, error); }
    animate ||= auto || rolling || Math.abs(view.displayedYaw-view.yaw)>.001 || Math.abs(view.displayedPitch-view.pitch)>.001;
  }
  if (animate) requestFrame();
}

for (const host of document.querySelectorAll('[data-roller-viewer]')) {
  const view = {host, kind:host.dataset.rollerViewer, visible:false, yaw:0, pitch:0, displayedYaw:0, displayedPitch:0, phase:0};
  views.push(view);
  if (view.kind === 'demo') {
    host.addEventListener('roller-demo-state', event => {
      view.printPose = event.detail;
      requestFrame();
    });
    host.addEventListener('roller-demo-design', event => view.printScene?.setDesign(event.detail));
    host.addEventListener('roller-demo-redraw', requestFrame);
  }
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
motion.addEventListener('change', () => {
  if (motion.matches) for (const view of views) takePoseControl(view);
  requestFrame();
});
document.addEventListener('visibilitychange', () => {
  for (const view of views) view.lastTime = null;
  requestFrame();
});
addEventListener('scroll', requestFrame, { passive: true });
