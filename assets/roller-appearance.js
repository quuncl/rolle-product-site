import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { mergeVertices, toCreasedNormals } from 'three/addons/utils/BufferGeometryUtils.js';

export const bodyParts = new Set(['Head', 'Handle', 'Adjuster']);

// Only the shading normals change; keep the supplied part shapes and dimensions.
// The helper's position hash expects scene-sized units, whereas this CAD is in metres.
export function prepareModel(model) {
  model.traverse(node => {
    if (!node.isMesh) return;
    const source = node.geometry.clone().scale(1000, 1000, 1000);
    const smooth = toCreasedNormals(source, Math.PI / 4).scale(.001, .001, .001);
    // A few CAD triangles have zero area. Retain their original vertex normal
    // instead of letting an undefined smoothed normal produce a black speck.
    const normals = smooth.getAttribute('normal');
    const originalNormals = node.geometry.getAttribute('normal');
    const originalIndex = node.geometry.index;
    const normal = new THREE.Vector3();
    for (let i = 0; i < normals.count; i++) {
      normal.fromBufferAttribute(normals, i);
      if (normal.lengthSq() > .5) continue;
      normal.fromBufferAttribute(originalNormals, originalIndex ? originalIndex.getX(i) : i);
      if (normal.lengthSq() < .5) normal.set(0, 1, 0);
      normal.normalize();
      normals.setXYZ(i, normal.x, normal.y, normal.z);
    }
    node.geometry = mergeVertices(smooth, 1e-7);
    source.dispose();
    if (smooth !== source) smooth.dispose();
    node.geometry.computeBoundingBox();
    node.geometry.computeBoundingSphere();
  });
  return model;
}

// Object-space grain needs no UVs or downloaded textures. Fade tiny detail below
// a screen pixel so the surface stays quiet as the wheel and camera move.
function addSurfaceGrain(material, {bump = .00018, layers = .1} = {}) {
  material.onBeforeCompile = shader => {
    shader.uniforms.rolleGrainBump = {value:bump};
    shader.uniforms.rolleLayerAmount = {value:layers};
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vRollePosition;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvRollePosition = position;');
    shader.fragmentShader = shader.fragmentShader.replace('#include <common>', `
      #include <common>
      varying vec3 vRollePosition;
      uniform float rolleGrainBump;
      uniform float rolleLayerAmount;
      float rolleHash(vec3 p) {
        p = fract(p * .3183099 + vec3(.1, .2, .3));
        p *= 17.0;
        return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
      }
      float rolleNoise(vec3 p) {
        vec3 i = floor(p), f = fract(p);
        f = f * f * (3.0 - 2.0 * f);
        return mix(mix(mix(rolleHash(i), rolleHash(i + vec3(1,0,0)), f.x),
                       mix(rolleHash(i + vec3(0,1,0)), rolleHash(i + vec3(1,1,0)), f.x), f.y),
                   mix(mix(rolleHash(i + vec3(0,0,1)), rolleHash(i + vec3(1,0,1)), f.x),
                       mix(rolleHash(i + vec3(0,1,1)), rolleHash(i + vec3(1,1,1)), f.x), f.y), f.z);
      }
    `).replace('#include <roughnessmap_fragment>', `
      #include <roughnessmap_fragment>
      float rolleGrain = rolleNoise(vRollePosition * 3100.0) - .5;
      roughnessFactor = clamp(roughnessFactor + rolleGrain * .09, .15, 1.0);
      diffuseColor.rgb *= 1.0 + rolleGrain * .025;
    `).replace('#include <normal_fragment_maps>', `
      #include <normal_fragment_maps>
      vec3 rolleDetailPosition = vRollePosition * 6500.0;
      vec3 rollePixel = fwidth(rolleDetailPosition);
      float rolleDetail = 1.0 - smoothstep(.6, 2.0, max(rollePixel.x, max(rollePixel.y, rollePixel.z)));
      float rolleLayerPhase = vRollePosition.y * 44880.0;
      float rolleLayerFade = 1.0 - smoothstep(1.0, 3.0, fwidth(rolleLayerPhase));
      float rolleHeight = rolleGrainBump * (
        (rolleNoise(rolleDetailPosition) - .5) * rolleDetail +
        sin(rolleLayerPhase) * rolleLayerAmount * rolleLayerFade
      );
      vec3 rolleDx = dFdx(-vViewPosition), rolleDy = dFdy(-vViewPosition);
      vec3 rolleR1 = cross(rolleDy, normal), rolleR2 = cross(normal, rolleDx);
      float rolleDet = dot(rolleDx, rolleR1);
      vec3 rolleGradient = dFdx(rolleHeight) * rolleR1 + dFdy(rolleHeight) * rolleR2;
      normal = normalize(max(abs(rolleDet), 1e-8) * normal - sign(rolleDet) * rolleGradient);
    `);
  };
  material.customProgramCacheKey = () => 'rolle-surface-grain-v1';
  return material;
}

export function createPartMaterial(name, color) {
  if (bodyParts.has(name)) {
    return addSurfaceGrain(new THREE.MeshPhysicalMaterial({
      color, roughness:.42, metalness:0, ior:1.46,
      clearcoat:.1, clearcoatRoughness:.42, specularIntensity:.85,
      envMapIntensity:.8, dithering:true,
    }));
  }
  if (name === 'Sleeve') {
    return addSurfaceGrain(new THREE.MeshStandardMaterial({
      color:'#292c30', roughness:.79, metalness:0, envMapIntensity:.65, dithering:true,
    }), {bump:.00032, layers:0});
  }
  if (name === 'Axle' || name === 'Axle_nut') {
    return new THREE.MeshStandardMaterial({
      color:'#c3c8ce', roughness:name === 'Axle' ? .25 : .32,
      metalness:1, envMapIntensity:1.05, dithering:true,
    });
  }
  return addSurfaceGrain(new THREE.MeshStandardMaterial({
    color:name === 'Drum' ? '#3f444c' : '#30353a',
    roughness:.5, metalness:0, envMapIntensity:.7, dithering:true,
  }), {bump:.00012, layers:.04});
}

export function lightStudio(view) {
  const {renderer, scene} = view;
  renderer.toneMappingExposure = 1.02;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const room = new RoomEnvironment();
  const pmrem = new THREE.PMREMGenerator(renderer);
  view.environment = pmrem.fromScene(room, .025);
  scene.environment = view.environment.texture;
  scene.environmentIntensity = .7;
  room.dispose();
  pmrem.dispose();

  scene.add(new THREE.HemisphereLight('#e1e8f4', '#383b3c', .32));
  const key = new THREE.DirectionalLight('#fff5e6', 2.6);
  key.position.set(-3, 4, 5);
  key.castShadow = true;
  const shadowSize = matchMedia('(max-width:600px)').matches ? 512 : 1024;
  key.shadow.mapSize.set(shadowSize, shadowSize);
  Object.assign(key.shadow.camera, {left:-1.8, right:1.8, top:1.8, bottom:-1.8, near:.5, far:12});
  key.shadow.bias = -.00015;
  key.shadow.normalBias = .002;
  key.shadow.camera.updateProjectionMatrix();
  scene.add(key);

  const fill = new THREE.DirectionalLight('#cbd9f0', .55);
  fill.position.set(3, .5, 4);
  scene.add(fill);
  const rim = new THREE.DirectionalLight('#e2eaff', 1.7);
  rim.position.set(1.5, 2, -3);
  scene.add(rim);

  // The model receives real self-shadowing around the fork, drum and axle.
  // Its soft backdrop shadow is composited from the transparent canvas in CSS.
}
