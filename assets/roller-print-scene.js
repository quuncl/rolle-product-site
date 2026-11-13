import * as THREE from 'three';
import { contactState, PRINT_CLEARANCE } from './roller-print-motion.js?v=66';
import { fixedCameraFrame } from './roller-motion.js?v=60';

const W = 4.8, H = 1.08, D = 1.85, BEVEL = .018;
const TOP = H + BEVEL;
const FRONT = D / 2, PRINT_Y = H * .57;
const START = -2.03, END = 2.03, PRINT_Z = .31;

function paperBump() {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 256;
  const ctx = canvas.getContext('2d');
  const pixels = ctx.createImageData(256, 256);
  let seed = 1637;
  for (let i = 0; i < pixels.data.length; i += 4) {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    const value = 115 + (seed >>> 26);
    pixels.data.set([value, value, value, 255], i);
  }
  ctx.putImageData(pixels, 0, 0);
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(4, 3);
  return texture;
}

function boxGeometry() {
  const r = .018, x = -W / 2, y = -H / 2;
  const shape = new THREE.Shape();
  shape.moveTo(x + r, y);
  shape.lineTo(x + W - r, y);
  shape.quadraticCurveTo(x + W, y, x + W, y + r);
  shape.lineTo(x + W, y + H - r);
  shape.quadraticCurveTo(x + W, y + H, x + W - r, y + H);
  shape.lineTo(x + r, y + H);
  shape.quadraticCurveTo(x, y + H, x, y + H - r);
  shape.lineTo(x, y + r);
  shape.quadraticCurveTo(x, y, x + r, y);
  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth:D - 2 * BEVEL, bevelEnabled:true, bevelSize:BEVEL,
    bevelThickness:BEVEL, bevelSegments:2, curveSegments:3, steps:1,
  });
  geometry.translate(0, H / 2, -D / 2 + BEVEL);
  const p = geometry.attributes.position, n = geometry.attributes.normal, uv = geometry.attributes.uv;
  for (let i = 0; i < p.count; i++) {
    const nx = Math.abs(n.getX(i)), ny = Math.abs(n.getY(i)), nz = Math.abs(n.getZ(i));
    if (ny > nx && ny > nz) uv.setXY(i, p.getX(i) / W + .5, .5 - p.getZ(i) / D);
    else if (nx > nz) uv.setXY(i, .5 - p.getZ(i) / D, p.getY(i) / H);
    else uv.setXY(i, p.getX(i) / W + .5, p.getY(i) / H);
  }
  return geometry;
}

function ambientShadow() {
  const canvas = document.createElement('canvas');
  canvas.width = 256; canvas.height = 128;
  const ctx = canvas.getContext('2d');
  const gradient = ctx.createRadialGradient(128, 64, 20, 128, 64, 128);
  gradient.addColorStop(0, '#30201465');
  gradient.addColorStop(.58, '#30201435');
  gradient.addColorStop(1, '#30201400');
  ctx.scale(1, .5); ctx.fillStyle = gradient; ctx.fillRect(0, 0, 256, 256);
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(W * 1.28, D * 1.5),
    new THREE.MeshBasicMaterial({map:new THREE.CanvasTexture(canvas), transparent:true, depthWrite:false}));
  mesh.rotation.x = -Math.PI / 2; mesh.position.y = -.012;
  return mesh;
}

function addFolds(scene) {
  const dark = new THREE.MeshStandardMaterial({color:'#795536', roughness:1});
  const edge = new THREE.MeshStandardMaterial({color:'#b28a60', roughness:.95});
  const line = (size, position, material) => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(...size), material);
    mesh.position.set(...position); mesh.receiveShadow = true; scene.add(mesh);
  };
  for (const side of [-1, 1]) {
    line([.012, H - .05, .009], [side * (W / 2 - .055), H / 2, D / 2 + .018], dark);
    line([.021, .014, D - .04], [side * (W / 2 - .025), TOP, 0], edge);
  }
  line([W - .045, .009, .012], [0, TOP - .005, D / 2 + .004], edge);
  line([W - .08, .002, .009], [0, TOP + .001, -.37], dark);
}

export async function createPrintScene(view) {
  const {scene, camera, tilt:rig, rotator, wheel, wheelRadiusWorld:radius, host, renderer} = view;
  scene.background = new THREE.Color('#e9e1d3');
  renderer.shadowMap.type = THREE.VSMShadowMap;
  const key = scene.children.find(light => light.isDirectionalLight && light.castShadow);
  if (key) {
    Object.assign(key.shadow.camera, {left:-4.5, right:4.5, top:4.5, bottom:-4.5, far:18});
    key.position.set(-3, 6, 5);
    key.shadow.radius = 3;
    key.shadow.blurSamples = 8;
    key.shadow.camera.updateProjectionMatrix();
  }
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(200, 200),
    new THREE.MeshStandardMaterial({color:'#dcd1bf', roughness:1}));
  floor.rotation.x = -Math.PI / 2; floor.position.y = -.025; floor.receiveShadow = true;
  scene.add(floor, ambientShadow());

  let paperMap;
  try {
    paperMap = await new THREE.TextureLoader().loadAsync(new URL('./images/demo-kraft-box-960.webp', import.meta.url).href);
    paperMap.colorSpace = THREE.SRGBColorSpace;
    // Use only the flat, unprinted paper inside the existing box photograph.
    paperMap.offset.set(.085, .13); paperMap.repeat.set(.82, .55);
    paperMap.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  } catch { /* A kraft material remains usable without the photograph. */ }
  const box = new THREE.Mesh(boxGeometry(), new THREE.MeshStandardMaterial({
    color:paperMap ? '#c7b5b2' : '#b99165', map:paperMap, roughness:.96,
    bumpMap:paperBump(), bumpScale:.004, envMapIntensity:.25,
  }));
  box.castShadow = box.receiveShadow = true;
  scene.add(box); addFolds(scene);

  const inkCanvas = document.createElement('canvas');
  inkCanvas.width = 2048; inkCanvas.height = 1024;
  const inkCtx = inkCanvas.getContext('2d');
  const inkTexture = new THREE.CanvasTexture(inkCanvas);
  inkTexture.colorSpace = THREE.SRGBColorSpace;
  inkTexture.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  const inkAbsorption = {value:1};
  const topHead = {value:0}, frontHead = {value:1};
  function addImprint(head, front) {
    const geometry = new THREE.PlaneGeometry(W, front ? H : D);
    // Reuse the top imprint texture at the same physical scale on the front.
    const bandV = .5 - PRINT_Z / D;
    if (front) {
      const uv = geometry.attributes.uv;
      for (let i = 0; i < uv.count; i++) uv.setY(i, bandV + (uv.getY(i) * H - PRINT_Y) / D);
    }
    const material = new THREE.MeshStandardMaterial({
      map:inkTexture, transparent:true, depthWrite:false, roughness:.85,
      polygonOffset:true, polygonOffsetFactor:-1, envMapIntensity:.3, alphaTest:.015,
    });
    material.onBeforeCompile = shader => {
      shader.uniforms.rollePrintHead = head;
      shader.uniforms.rolleInkAbsorption = inkAbsorption;
      shader.uniforms.rollePaper = {value:paperMap};
      const paperUV = front ? `vec2(vMapUv.x, ((vMapUv.y - ${bandV}) * ${D} + ${PRINT_Y}) / ${H})` : 'vMapUv';
      shader.fragmentShader = shader.fragmentShader
        .replace('#include <common>', '#include <common>\nuniform float rollePrintHead;\nuniform float rolleInkAbsorption;\nuniform sampler2D rollePaper;')
        .replace('#include <map_fragment>', `
          #include <map_fragment>
          if (vMapUv.x ${front ? '<' : '>'} rollePrintHead) discard;
          vec3 paperColor = ${paperMap ? `texture2D(rollePaper, ${paperUV} * vec2(.82, .55) + vec2(.085, .13)).rgb * vec3(.57, .46, .45)` : 'vec3(.25, .12, .06)'};
          diffuseColor.rgb *= mix(vec3(1.0), paperColor, rolleInkAbsorption);
        `);
    };
    material.customProgramCacheKey = () => `rolle-print-reveal-${front}-${Boolean(paperMap)}`;
    const imprint = new THREE.Mesh(geometry, material);
    if (front) imprint.position.set(0, H / 2, FRONT + .002);
    else {
      imprint.rotation.x = -Math.PI / 2;
      imprint.position.y = TOP + .002;
    }
    imprint.receiveShadow = true;
    scene.add(imprint);
  }
  addImprint(topHead, false);
  addImprint(frontHead, true);

  const sleeve = wheel?.getObjectByName('Sleeve');
  const sleeveSize = sleeve.geometry.boundingBox.getSize(new THREE.Vector3());
  const bandWidth = sleeveSize.z * 10;
  const circumference = 2 * Math.PI * radius;
  rig.traverse(part => {
    if (part.name === 'Axle' || part.name === 'Axle_nut') {
      part.material.roughness = .48;
      part.material.metalness = .85;
    }
  });
  // A small index mark on the rotating drum makes its motion legible while the axle stays fixed.
  const index = new THREE.Mesh(new THREE.BoxGeometry(.0011, .0034, .00012),
    new THREE.MeshStandardMaterial({color:'#a5b0b3', roughness:.82}));
  index.position.set(0, radius / 10 * .82, .00815);
  wheel.add(index);
  let design = {brand:'ЛОГОКАТ', ink:'#262924', logo:null};
  let paintedDesign;
  let designVersion = 0;
  async function setDesign(next) {
    design = {...design, ...next};
    if (paintedDesign && design.brand === paintedDesign.brand && design.ink === paintedDesign.ink && design.logo === paintedDesign.logo) return;
    const version = ++designVersion;
    let image;
    if (design.logo) {
      image = new Image(); image.src = design.logo;
      try { await image.decode(); } catch { image = null; }
    }
    try { await document.fonts.load('800 24px "Logokat Inter"', design.brand || 'ЛОГОКАТ'); }
    catch { /* The browser fallback also keeps printing available offline. */ }
    if (version !== designVersion) return;
    inkCtx.clearRect(0, 0, inkCanvas.width, inkCanvas.height);
    const px = inkCanvas.width / W, py = inkCanvas.height / D;
    const band = bandWidth * py, centerY = (PRINT_Z / D + .5) * inkCanvas.height;
    const repeat = circumference * px;
    const printStart = (START + W / 2) * px;
    const printEnd = (END + W / 2) * px;
    const lineThickness = band * .06;
    inkCtx.fillStyle = design.ink;
    for (const edge of [-1, 1]) {
      const lineY = centerY + edge * band * .45 - lineThickness / 2;
      inkCtx.fillRect(printStart, lineY, printEnd - printStart, lineThickness);
    }
    inkCtx.textAlign = 'center'; inkCtx.textBaseline = 'middle';
    const label = image ? design.brand.trim() : design.brand || 'ЛОГОКАТ';
    let fontSize = band * .8;
    inkCtx.font = `800 ${fontSize}px "Logokat Inter", sans-serif`;
    fontSize *= Math.min(1, repeat * (image && label ? .48 : .83) / (inkCtx.measureText(label).width || 1));
    inkCtx.font = `800 ${fontSize}px "Logokat Inter", sans-serif`;
    for (let x = printStart + repeat / 2; x < printEnd; x += repeat) {
      if (image) {
        const ratio = Math.min(repeat * (label ? .28 : .82) / image.naturalWidth, band * .78 / image.naturalHeight);
        const iw = image.naturalWidth * ratio, ih = image.naturalHeight * ratio;
        const stamp = document.createElement('canvas'); stamp.width = Math.ceil(iw); stamp.height = Math.ceil(ih);
        const stampCtx = stamp.getContext('2d');
        stampCtx.drawImage(image, 0, 0, iw, ih); stampCtx.globalCompositeOperation = 'source-in';
        stampCtx.fillStyle = design.ink; stampCtx.fillRect(0, 0, stamp.width, stamp.height);
        inkCtx.drawImage(stamp, x - (label ? repeat * .29 : 0) - iw / 2, centerY - ih / 2);
        if (label) inkCtx.fillText(label, x + repeat * .14, centerY);
      } else inkCtx.fillText(label, x, centerY);
    }
    // Small gaps let the paper show through the pigment instead of looking like vinyl.
    inkCtx.globalCompositeOperation = 'destination-out';
    let seed = 851;
    for (let i = 0; i < 5500; i++) {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      const x = (seed / 4294967296) * inkCanvas.width;
      seed = (seed * 1664525 + 1013904223) >>> 0;
      const y = centerY + (seed / 4294967296 - .5) * band;
      inkCtx.fillStyle = 'rgba(0,0,0,.22)'; inkCtx.fillRect(x, y, .8, .8);
    }
    inkCtx.globalCompositeOperation = 'source-over';
    inkTexture.needsUpdate = true;
    inkAbsorption.value = design.ink.toLowerCase() === '#f8f6e9' ? 0 : 1;
    paintedDesign = {...design};
    if (sleeve) {sleeve.material.color.set(design.ink); sleeve.material.roughness = .58;}
    host.dispatchEvent(new CustomEvent('roller-demo-redraw'));
  }

  rotator.rotation.set(0, 0, 0);
  rig.rotation.z = Math.PI + .12;
  rig.updateWorldMatrix(true, true);
  const topOrientation = rig.quaternion.clone();
  const wheelOrigin = wheel.getWorldPosition(new THREE.Vector3());
  const sleeveCenterZ = sleeve.geometry.boundingBox.getCenter(new THREE.Vector3()).z * 10;
  const topParams = {start:START, end:END, surface:TOP, radius, width:W};
  const frontParams = {start:END, end:START, surface:FRONT, radius, width:W};
  const topEndAngle = contactState(1, 0, topParams).angle;
  const topWheelZ = PRINT_Z - sleeveCenterZ;
  const frontWheelY = PRINT_Y + sleeveCenterZ;
  const aboveCarton = TOP + radius + PRINT_CLEARANCE;
  const outsideCarton = FRONT + radius + PRINT_CLEARANCE;
  const xAxis = new THREE.Vector3(1, 0, 0);
  const wheelCenter = new THREE.Vector3();
  const rotatedOrigin = new THREE.Vector3();
  const orientation = new THREE.Quaternion();
  let width = 1, height = 1;
  let wholeHalf = 1;
  function place({progress = 0, frontProgress = 0, turn = 0, lift = PRINT_CLEARANCE}) {
    const top = contactState(progress, lift, topParams);
    const front = contactState(frontProgress, lift, frontParams);
    // Clear the top edge before lowering the tool and turning its axle toward the front.
    const overEdge = THREE.MathUtils.smoothstep(turn, 0, .46);
    const lower = THREE.MathUtils.smoothstep(turn, .46, 1);
    if (turn === 0) wheelCenter.set(top.x, top.normal, topWheelZ);
    else if (turn === 1) wheelCenter.set(front.x, frontWheelY, front.normal);
    else wheelCenter.set(END,
      THREE.MathUtils.lerp(aboveCarton, frontWheelY, lower),
      THREE.MathUtils.lerp(topWheelZ, outsideCarton, overEdge));
    orientation.setFromAxisAngle(xAxis, lower * Math.PI / 2);
    rig.quaternion.copy(orientation).multiply(topOrientation);
    rotatedOrigin.copy(wheelOrigin).applyQuaternion(orientation);
    rig.position.copy(wheelCenter).sub(rotatedOrigin);
    wheel.rotation.z = turn === 1 ? topEndAngle + front.angle : top.angle;
    topHead.value = progress <= 0 ? 0 : top.inkHead;
    frontHead.value = frontProgress <= 0 ? 1 : front.inkHead;
  }
  const wholeBox = new THREE.Box3().setFromObject(box);
  const sceneBounds = [wholeBox.clone()];
  for (const pose of [
    {progress:0}, {progress:1}, {progress:1, turn:.46}, {progress:1, turn:.73},
    {progress:1, turn:1}, {progress:1, turn:1, frontProgress:1},
  ]) {
    place(pose);
    const bounds = new THREE.Box3().setFromObject(rig);
    sceneBounds.push(bounds);
    wholeBox.union(bounds);
  }
  const wholeCenter = wholeBox.getCenter(new THREE.Vector3());
  const wholeOffset = new THREE.Vector3(3.7, 2.8, 7);
  const topOffset = new THREE.Vector3(.25, 1.45, 1.85);
  const frontOffset = new THREE.Vector3(1.25, 1.1, 2.6);
  const detailTarget = new THREE.Vector3();
  const cameraTarget = new THREE.Vector3();

  function resize(w, h) {
    width = w;
    height = h;
    camera.position.copy(wholeCenter).add(wholeOffset);
    camera.lookAt(wholeCenter);
    camera.updateMatrixWorld();
    const bounds = new THREE.Box3();
    for (const object of sceneBounds) {
      for (const x of [object.min.x, object.max.x]) for (const y of [object.min.y, object.max.y]) for (const z of [object.min.z, object.max.z]) {
        bounds.expandByPoint(new THREE.Vector3(x, y, z).applyMatrix4(camera.matrixWorldInverse));
      }
    }
    const halfX = Math.max(-bounds.min.x, bounds.max.x);
    const halfY = Math.max(-bounds.min.y, bounds.max.y);
    wholeHalf = fixedCameraFrame(2 * halfX, 2 * halfY, width / height).top;
  }

  function updateCamera({lift = PRINT_CLEARANCE, turn = 0}) {
    const aspect = width / height;
    const wide = THREE.MathUtils.clamp(lift / PRINT_CLEARANCE, 0, 1);
    const front = turn === 1;
    if (front) detailTarget.set(wheelCenter.x + .32, PRINT_Y + .06, FRONT);
    else detailTarget.set(wheelCenter.x - .32, TOP + .11, PRINT_Z);
    cameraTarget.lerpVectors(detailTarget, wholeCenter, wide);
    camera.position.lerpVectors(front ? frontOffset : topOffset, wholeOffset, wide).add(cameraTarget);
    camera.lookAt(cameraTarget);
    const half = THREE.MathUtils.lerp(width < 600 ? 1.02 : .84, wholeHalf, wide);
    Object.assign(camera, {left:-half * aspect, right:half * aspect, top:half, bottom:-half});
    camera.updateProjectionMatrix();
    camera.updateMatrixWorld();
  }
  setDesign(design);
  return {
    setDesign,
    resize,
    update(pose = {}) {
      place(pose);
      updateCamera(pose);
    },
  };
}
