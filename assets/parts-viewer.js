import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

const BASE = new URL('.', import.meta.url);
const MANIFEST_URL = new URL('print/models/parts.json', BASE);
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const root = document.getElementById('partsViewer');
if (root) {
  boot(root).catch((err) => {
    console.error(err);
    root.classList.add('is-fallback');
    const status = root.querySelector('[data-viewer-status]');
    if (status) status.textContent = 'Не удалось загрузить 3D-детали. Скачайте файлы ниже.';
  });
}

function makeMaterial(item) {
  const color = new THREE.Color(item.color || '#8a8f96');
  if (item.material === 'tpu') {
    return new THREE.MeshPhysicalMaterial({
      color,
      roughness: 0.78,
      metalness: 0.02,
      clearcoat: 0.12,
      clearcoatRoughness: 0.65,
    });
  }
  if (item.material === 'pla-metal') {
    return new THREE.MeshPhysicalMaterial({
      color,
      roughness: 0.3,
      metalness: 0.28,
      clearcoat: 0.4,
      clearcoatRoughness: 0.28,
    });
  }
  return new THREE.MeshPhysicalMaterial({
    color,
    roughness: 0.48,
    metalness: 0.02,
    clearcoat: 0.16,
    clearcoatRoughness: 0.42,
  });
}

async function boot(rootEl) {
  const canvas = rootEl.querySelector('canvas');
  const status = rootEl.querySelector('[data-viewer-status]');
  const spreadBtn = rootEl.querySelector('[data-explode]');
  const packBtn = rootEl.querySelector('[data-assemble]');
  const range = rootEl.querySelector('[data-assembly-range]');
  const chips = [...document.querySelectorAll('[data-part-chip]')];
  const partRows = [];

  const manifest = await fetch(MANIFEST_URL).then((r) => {
    if (!r.ok) throw new Error('manifest');
    return r.json();
  });

  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    alpha: false,
    powerPreference: 'high-performance',
  });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.08;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xe9e2d6);

  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  pmrem.dispose();

  const camera = new THREE.PerspectiveCamera(35, 1, 0.5, 2000);
  camera.position.set(40, 110, 280);

  const controls = new OrbitControls(camera, canvas);
  controls.enableDamping = true;
  controls.dampingFactor = 0.07;
  controls.enablePan = false;
  controls.minDistance = 120;
  controls.maxDistance = 480;
  controls.minPolarAngle = 0.4;
  controls.maxPolarAngle = 1.3;
  controls.target.set(0, 30, 0);
  controls.autoRotate = !reducedMotion;
  controls.autoRotateSpeed = 0.28;

  scene.add(new THREE.HemisphereLight(0xfff8ef, 0xa89f92, 1.05));
  const key = new THREE.DirectionalLight(0xffffff, 1.65);
  key.position.set(70, 160, 90);
  key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024);
  key.shadow.camera.near = 20;
  key.shadow.camera.far = 500;
  key.shadow.camera.left = -200;
  key.shadow.camera.right = 200;
  key.shadow.camera.top = 160;
  key.shadow.camera.bottom = -160;
  key.shadow.bias = -0.0002;
  scene.add(key);
  const fill = new THREE.DirectionalLight(0xd9e6ff, 0.55);
  fill.position.set(-120, 70, 30);
  scene.add(fill);
  const rim = new THREE.DirectionalLight(0xffc4b0, 0.45);
  rim.position.set(-30, 50, -140);
  scene.add(rim);

  const groundMat = new THREE.MeshStandardMaterial({
    color: 0xf4efe6,
    roughness: 0.96,
    metalness: 0,
  });
  const ground = new THREE.Mesh(new THREE.CircleGeometry(220, 72), groundMat);
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = 0;
  ground.receiveShadow = true;
  scene.add(ground);

  const shadowCatcher = new THREE.Mesh(
    new THREE.CircleGeometry(200, 72),
    new THREE.ShadowMaterial({ opacity: 0.18 }),
  );
  shadowCatcher.rotation.x = -Math.PI / 2;
  shadowCatcher.position.y = 0.05;
  shadowCatcher.receiveShadow = true;
  scene.add(shadowCatcher);

  const group = new THREE.Group();
  scene.add(group);

  const loader = new GLTFLoader();
  const parts = [];
  // Horizontal kit spacing in mm, later centered.
  const gaps = [0];
  const widths = [];

  for (const item of manifest.parts) {
    const gltf = await loader.loadAsync(new URL(`print/${item.file}`, BASE).href);
    const model = gltf.scene;
    model.rotation.x = -Math.PI / 2;
    model.updateMatrixWorld(true);

    const box = new THREE.Box3().setFromObject(model);
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    model.position.x -= center.x;
    model.position.z -= center.z;
    model.position.y -= box.min.y;

    model.traverse((obj) => {
      if (!obj.isMesh) return;
      obj.material = makeMaterial(item);
      obj.castShadow = true;
      obj.receiveShadow = true;
    });

    widths.push(Math.max(size.x, size.z, 24));
    const pivot = new THREE.Group();
    pivot.name = item.id;
    pivot.userData = {
      id: item.id,
      label: item.label,
      width: Math.max(size.x, size.z, 24),
      height: size.y,
      spin: item.spin || 0.004,
      intro: reducedMotion ? 1 : 0,
      introDelay: parts.length * 0.07,
      packedX: 0,
      spreadX: 0,
    };
    pivot.add(model);
    group.add(pivot);
    parts.push(pivot);
  }

  // Build kit positions from measured widths.
  let cursor = 0;
  const spreadXs = [];
  for (let i = 0; i < parts.length; i += 1) {
    const w = parts[i].userData.width;
    const x = cursor + w * 0.5;
    spreadXs.push(x);
    cursor += w + 18;
  }
  const mid = cursor / 2;
  for (let i = 0; i < parts.length; i += 1) {
    const spreadX = spreadXs[i] - mid;
    const packedX = spreadX * 0.38;
    parts[i].userData.spreadX = spreadX;
    parts[i].userData.packedX = packedX;
    parts[i].position.set(spreadX, reducedMotion ? 0 : -20, 0);
  }

  let spreadAmount = 1;
  let targetSpread = 1;
  let highlighted = null;
  let visible = true;
  let raf = 0;
  let introT = 0;
  let focusId = null;
  let dragging = false;
  const overview = {
    pos: new THREE.Vector3(40, 110, 280),
    target: new THREE.Vector3(0, 30, 0),
  };
  const focusGoal = {
    pos: overview.pos.clone(),
    target: overview.target.clone(),
  };
  let camBlend = 0;

  const setSpread = (value, syncRange = true) => {
    targetSpread = THREE.MathUtils.clamp(value, 0, 1);
    if (syncRange && range) range.value = String(Math.round(targetSpread * 100));
    spreadBtn?.classList.toggle('is-active', targetSpread > 0.7);
    packBtn?.classList.toggle('is-active', targetSpread < 0.3);
  };

  const applySpread = (t) => {
    for (const part of parts) {
      const { packedX, spreadX, intro } = part.userData;
      part.position.x = THREE.MathUtils.lerp(packedX, spreadX, t);
      part.position.y = THREE.MathUtils.lerp(-18, 0, intro);
      const s = THREE.MathUtils.lerp(0.78, 1, intro);
      part.scale.setScalar(s);
    }
  };

  const frameOverview = () => {
    for (const part of parts) part.userData.intro = 1;
    applySpread(1);
    group.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(group);
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    const radius = Math.max(size.x, size.y * 1.2, size.z) * 0.52;
    overview.target.set(center.x, Math.max(28, size.y * 0.42), center.z);
    overview.pos.set(center.x + radius * 0.18, radius * 0.62, radius * 1.55);
    controls.minDistance = radius * 0.95;
    controls.maxDistance = radius * 4.5;
    // Reset intro for entrance animation.
    if (!reducedMotion) {
      for (const part of parts) part.userData.intro = 0;
      applySpread(1);
    }
  };

  const highlight = (id) => {
    highlighted = id;
    focusId = id;
    for (const part of parts) {
      const on = !id || part.userData.id === id;
      part.traverse((obj) => {
        if (!obj.isMesh) return;
        obj.material.transparent = !on;
        obj.material.opacity = on ? 1 : 0.18;
        obj.material.depthWrite = on;
      });
    }
    chips.forEach((chip) => chip.classList.toggle('is-active', chip.dataset.partChip === id));
    partRows.forEach((row) => row.classList.toggle('is-active', row.dataset.part === id));

    if (id) {
      const part = parts.find((p) => p.userData.id === id);
      if (part) {
        const world = new THREE.Vector3();
        part.getWorldPosition(world);
        const h = part.userData.height || 40;
        focusGoal.target.set(world.x, h * 0.45, world.z);
        focusGoal.pos.set(world.x + 55, h * 0.7 + 35, world.z + 110);
        camBlend = 1;
        controls.autoRotate = false;
      }
    } else {
      focusGoal.pos.copy(overview.pos);
      focusGoal.target.copy(overview.target);
      camBlend = 1;
      controls.autoRotate = !reducedMotion && !dragging;
    }
  };

  controls.addEventListener('start', () => {
    dragging = true;
    controls.autoRotate = false;
    camBlend = 0;
  });
  controls.addEventListener('end', () => {
    dragging = false;
    if (!reducedMotion && !focusId) controls.autoRotate = true;
  });

  const resize = () => {
    const rect = canvas.getBoundingClientRect();
    const w = Math.max(1, Math.floor(rect.width));
    const h = Math.max(1, Math.floor(rect.height));
    const dpr = Math.min(window.devicePixelRatio || 1, 1.85);
    renderer.setPixelRatio(dpr);
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  };

  frameOverview();
  camera.position.copy(overview.pos);
  controls.target.copy(overview.target);
  controls.update();
  applySpread(1);
  resize();
  setSpread(1);
  highlight(null);

  if (status) {
    status.textContent = manifest.disclaimer
      || 'Превью упрощённых моделей из 3MF. Это комплект для печати, не CAD-сборка.';
  }
  rootEl.classList.add('is-ready');

  const tick = () => {
    raf = 0;
    introT = Math.min(1, introT + 0.018);
    const animating = Math.abs(targetSpread - spreadAmount) > 0.001
      || parts.some((p) => p.userData.intro < 0.999)
      || camBlend > 0.01;

    if (!visible && !animating && !dragging && !controls.autoRotate) {
      renderer.render(scene, camera);
      return;
    }

    spreadAmount += (targetSpread - spreadAmount) * (reducedMotion ? 1 : 0.1);
    for (const part of parts) {
      const local = THREE.MathUtils.clamp((introT - part.userData.introDelay) / 0.5, 0, 1);
      const eased = local * local * (3 - 2 * local);
      part.userData.intro += (eased - part.userData.intro) * (reducedMotion ? 1 : 0.14);
      if (!reducedMotion && (!focusId || focusId === part.userData.id)) {
        part.rotation.y += part.userData.spin * (focusId ? 1.5 : 1);
      }
    }
    applySpread(spreadAmount);

    if (camBlend > 0.001 && !dragging) {
      const k = reducedMotion ? 1 : 0.08;
      camera.position.lerp(focusGoal.pos, k);
      controls.target.lerp(focusGoal.target, k);
      camBlend *= reducedMotion ? 0 : 0.92;
    }

    controls.update();
    renderer.render(scene, camera);

    if (visible || animating || dragging || controls.autoRotate) {
      raf = requestAnimationFrame(tick);
    }
  };

  const requestFrame = () => {
    if (!raf) raf = requestAnimationFrame(tick);
  };
  requestFrame();

  const io = new IntersectionObserver((entries) => {
    visible = entries.some((e) => e.isIntersecting);
    if (visible) {
      if (!reducedMotion && !focusId) controls.autoRotate = true;
      requestFrame();
    } else {
      controls.autoRotate = false;
    }
  }, { threshold: 0.08 });
  io.observe(rootEl);

  window.addEventListener('resize', () => {
    resize();
    requestFrame();
  });

  spreadBtn?.addEventListener('click', () => {
    setSpread(1);
    highlight(null);
    requestFrame();
  });
  packBtn?.addEventListener('click', () => {
    setSpread(0);
    highlight(null);
    requestFrame();
  });
  range?.addEventListener('input', (e) => {
    setSpread(Number(e.target.value) / 100, false);
    requestFrame();
  });

  const selectPart = (id) => {
    highlight(highlighted === id ? null : id);
    requestFrame();
  };

  chips.forEach((chip) => {
    chip.addEventListener('click', () => selectPart(chip.dataset.partChip));
  });
  partRows.forEach((row) => {
    row.addEventListener('click', (e) => {
      if (e.target.closest('a')) return;
      selectPart(row.dataset.part);
    });
    row.tabIndex = 0;
    row.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        selectPart(row.dataset.part);
      }
    });
  });
}
