import * as THREE from 'three';
import { OrbitControls } from '../node_modules/three/examples/jsm/controls/OrbitControls.js';

window.addEventListener('error', (e) => console.error('[scene]', e.message, e.filename, e.lineno));
window.addEventListener('unhandledrejection', (e) => console.error('[scene]', e.reason));

// ---------------------------------------------------------------------
// A small floating medieval-fantasy village: organic terrain with carved
// lakes, scattered trees/bushes, stone cottages/watchtowers/a great hall,
// jointed villagers, a real-time day/night cycle driven by the system
// clock, a realm log sidebar, and status toasts.
// Scroll to zoom, drag to orbit; click a building to launch, right-click
// to remove.
// ---------------------------------------------------------------------

const wrap = document.getElementById('scene-wrap');
const emptyMsg = document.getElementById('empty');
const sidebarList = document.getElementById('threadList');
const toastHost = document.getElementById('toasts');
const buildingCountEl = document.getElementById('buildingCount');
const labelHost = document.getElementById('labels');
const actionPanel = document.getElementById('actionPanel');
const apTitle = document.getElementById('apTitle');
const apStatus = document.getElementById('apStatus');
const apLaunch = document.getElementById('apLaunch');
const apRemove = document.getElementById('apRemove');
const apCancel = document.getElementById('apCancel');

const ISLAND_RADIUS = 9;
const LAKES = [
  { x: 3.4, z: -2.4, radius: 1.4 },
  { x: -4.0, z: 2.8, radius: 1.1 },
  { x: 1.2, z: 4.6, radius: 0.8 },
];

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 300);
camera.position.set(13, 11, 16);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
if ('outputColorSpace' in renderer) renderer.outputColorSpace = THREE.SRGBColorSpace;
wrap.appendChild(renderer.domElement);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.08;
controls.enablePan = false;
controls.minDistance = 5;
controls.maxDistance = 46;
controls.maxPolarAngle = Math.PI * 0.49;
controls.target.set(0, 1, 0);

function resize() {
  const w = wrap.clientWidth;
  const h = wrap.clientHeight;
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  renderer.setSize(w, h);
}
window.addEventListener('resize', resize);

// ---- real-time day/night cycle ------------------------------------------
// Keyframes across a 24h clock: [hour, skyColor, fogColor, sunColor, sunIntensity,
// hemiSky, hemiGround, hemiIntensity, starOpacity, sunElevationDeg]
const DAY_KEYS = [
  { h: 0, sky: 0x0a0c1a, fog: 0x11101e, sun: 0x8fa5ff, sunI: 0.12, hemiSky: 0x2a3050, hemiGround: 0x0d0f10, hemiI: 0.35, star: 1, elev: -30 },
  { h: 5, sky: 0x151527, fog: 0x1b1826, sun: 0xff9d6c, sunI: 0.4, hemiSky: 0x40406a, hemiGround: 0x241a12, hemiI: 0.4, star: 0.7, elev: -5 },
  { h: 7, sky: 0xffcf9e, fog: 0x3a2f2a, sun: 0xffd9a0, sunI: 1.1, hemiSky: 0x9fb0d0, hemiGround: 0x3a5030, hemiI: 0.6, star: 0, elev: 15 },
  { h: 12, sky: 0x8fc4e8, fog: 0x6a8ba8, sun: 0xfff6e0, sunI: 1.35, hemiSky: 0xbfd8ff, hemiGround: 0x3f6b46, hemiI: 0.75, star: 0, elev: 70 },
  { h: 17, sky: 0xf0a960, fog: 0x4a3428, sun: 0xffae5c, sunI: 1.0, hemiSky: 0xd9a066, hemiGround: 0x3f6b46, hemiI: 0.6, star: 0, elev: 20 },
  { h: 19, sky: 0x2e2040, fog: 0x241f36, sun: 0xaa6a8c, sunI: 0.35, hemiSky: 0x453a66, hemiGround: 0x241a2c, hemiI: 0.45, star: 0.5, elev: -2 },
  { h: 21, sky: 0x0d0e1e, fog: 0x14131f, sun: 0x8fa5ff, sunI: 0.15, hemiSky: 0x2a3050, hemiGround: 0x0d0f10, hemiI: 0.35, star: 1, elev: -20 },
  { h: 24, sky: 0x0a0c1a, fog: 0x11101e, sun: 0x8fa5ff, sunI: 0.12, hemiSky: 0x2a3050, hemiGround: 0x0d0f10, hemiI: 0.35, star: 1, elev: -30 },
];

function lerp(a, b, t) { return a + (b - a) * t; }
function colorLerp(a, b, t) { return new THREE.Color(a).lerp(new THREE.Color(b), t); }

function sampleDayCycle(hourFloat) {
  let lo = DAY_KEYS[0];
  let hi = DAY_KEYS[DAY_KEYS.length - 1];
  for (let i = 0; i < DAY_KEYS.length - 1; i++) {
    if (hourFloat >= DAY_KEYS[i].h && hourFloat <= DAY_KEYS[i + 1].h) {
      lo = DAY_KEYS[i];
      hi = DAY_KEYS[i + 1];
      break;
    }
  }
  const span = hi.h - lo.h || 1;
  const t = (hourFloat - lo.h) / span;
  return {
    sky: colorLerp(lo.sky, hi.sky, t),
    fog: colorLerp(lo.fog, hi.fog, t),
    sun: colorLerp(lo.sun, hi.sun, t),
    sunI: lerp(lo.sunI, hi.sunI, t),
    hemiSky: colorLerp(lo.hemiSky, hi.hemiSky, t),
    hemiGround: colorLerp(lo.hemiGround, hi.hemiGround, t),
    hemiI: lerp(lo.hemiI, hi.hemiI, t),
    star: lerp(lo.star, hi.star, t),
    elev: lerp(lo.elev, hi.elev, t),
  };
}

scene.fog = new THREE.FogExp2(0x241f36, 0.022);
const hemi = new THREE.HemisphereLight(0x8fa5ff, 0x2f6b46, 0.7);
scene.add(hemi);
const sun = new THREE.DirectionalLight(0xffd9a0, 1.3);
sun.castShadow = true;
sun.shadow.mapSize.set(1024, 1024);
sun.shadow.camera.left = -8;
sun.shadow.camera.right = 8;
sun.shadow.camera.top = 8;
sun.shadow.camera.bottom = -8;
sun.shadow.camera.near = 1;
sun.shadow.camera.far = 26;
scene.add(sun);
const rim = new THREE.PointLight(0x5470ff, 0.35, 30);
rim.position.set(-8, 5, -8);
scene.add(rim);

function applyDayCycle() {
  const now = new Date();
  const hourFloat = now.getHours() + now.getMinutes() / 60;
  const s = sampleDayCycle(hourFloat);

  scene.background = s.sky;
  scene.fog.color = s.fog;
  hemi.color = s.hemiSky;
  hemi.groundColor = s.hemiGround;
  hemi.intensity = s.hemiI;
  sun.color = s.sun;
  sun.intensity = s.sunI;

  const rad = (s.elev * Math.PI) / 180;
  const dist = 14;
  sun.position.set(Math.cos(rad) * dist, Math.max(Math.sin(rad) * dist, -3), dist * 0.4);

  if (starPoints) starPoints.material.opacity = s.star;
  nightFactor = s.star;
  return s;
}
let nightFactor = 0;

// ---- starfield (fades in at night) --------------------------------------
let starPoints;
{
  const starGeo = new THREE.BufferGeometry();
  const count = 800;
  const positions = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    const r = 60 + Math.random() * 60;
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(2 * Math.random() - 1);
    positions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
    positions[i * 3 + 1] = Math.abs(r * Math.cos(phi));
    positions[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);
  }
  starGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const starMat = new THREE.PointsMaterial({ color: 0xffffff, size: 0.35, sizeAttenuation: true, transparent: true, opacity: 1 });
  starPoints = new THREE.Points(starGeo, starMat);
  scene.add(starPoints);
}

const raycaster = new THREE.Raycaster();
function raycastHeight(mesh, x, z) {
  raycaster.set(new THREE.Vector3(x, ISLAND_RADIUS * 3, z), new THREE.Vector3(0, -1, 0));
  mesh.updateMatrixWorld(true);
  const hit = raycaster.intersectObject(mesh, false)[0];
  return hit ? hit.point.y : 0;
}

// ---- organic island terrain: multi-octave bumps, lake carving, color bands
function heightNoise(nx, ny, nz) {
  return (
    Math.sin(nx * 5.2 + nz * 3.1) * 0.32 +
    Math.sin(nx * 9.7 - nz * 6.3 + 1.7) * 0.15 +
    Math.sin(nz * 13.1 + nx * 2.4) * 0.07 +
    Math.sin(nx * 2.1 + nz * 1.3 + 4.2) * 0.45
  );
}

const waterMeshes = []; // { mesh, baseY, phase, basePos } — real per-vertex ripples each frame
const fish = [];
const boats = []; // { obj, lake, cx, cz }
const ripples = [];

// Shared ripple formula (radiating rings + a finer wavelet) so the water
// surface, the boats resting on it, and anything else that cares about
// "how high is the water here" all agree.
function waveHeight(lake, vx, vz, t) {
  const dist = Math.hypot(vx, vz);
  return (
    Math.sin(dist * 3.2 - t * 1.6 + lake.phase) * 0.028 +
    Math.sin(vx * 4 + vz * 3 + t * 1.1 + lake.phase) * 0.014
  );
}

function updateWater(t) {
  for (const w of waterMeshes) {
    const arr = w.mesh.geometry.attributes.position.array;
    const base = w.basePos;
    for (let i = 0; i < arr.length; i += 3) {
      const vx = base[i];
      const vz = base[i + 2];
      const dist = Math.hypot(vx, vz);
      arr[i] = vx;
      arr[i + 1] = w.baseY + Math.sin(dist * 3.2 - t * 1.6 + w.phase) * 0.028 + Math.sin(vx * 4 + vz * 3 + t * 1.1 + w.phase) * 0.014;
      arr[i + 2] = vz;
    }
    w.mesh.geometry.attributes.position.needsUpdate = true;
    w.mesh.geometry.computeVertexNormals();
  }
}

function updateBoats(t) {
  for (const b of boats) {
    const h = waveHeight(b.lake, b.cx, b.cz, t);
    b.obj.position.y = b.lake.waterY + 0.03 + h;
    b.obj.rotation.z = h * 1.8;
    b.obj.rotation.x = Math.sin(t * 1.3 + b.lake.phase) * 0.05;
  }
}

// ---- fish: pure decoration, wander in slow loops within their lake ------
const FISH_COLORS = [0xf4a460, 0xc9c9c9, 0xff8c69, 0x8fb8de, 0xe8b4d8];
function buildFish(seed) {
  const group = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color: FISH_COLORS[seed % FISH_COLORS.length], roughness: 0.5, flatShading: true });
  const body = new THREE.Mesh(new THREE.ConeGeometry(0.022, 0.085, 6), mat);
  body.rotation.z = Math.PI / 2;
  group.add(body);
  const tailPivot = new THREE.Group();
  tailPivot.position.x = -0.04;
  const tail = new THREE.Mesh(new THREE.ConeGeometry(0.02, 0.035, 4), mat);
  tail.rotation.z = -Math.PI / 2;
  tail.position.x = -0.018;
  tailPivot.add(tail);
  group.add(tailPivot);
  group.userData.tail = tailPivot;
  return group;
}

function spawnFish(lake, count) {
  for (let i = 0; i < count; i++) {
    const f = buildFish(Math.floor(Math.random() * 1e6));
    const radius = Math.random() * lake.radius * 0.55;
    const angle = Math.random() * Math.PI * 2;
    f.position.set(lake.x + Math.cos(angle) * radius, lake.waterY - 0.05, lake.z + Math.sin(angle) * radius);
    decorGroup.add(f);
    fish.push({
      obj: f, lake, angle, radius,
      speed: 0.3 + Math.random() * 0.3,
      depth: 0.03 + Math.random() * 0.05,
      phase: Math.random() * Math.PI * 2,
    });
  }
}

function updateFish(t, dtSec) {
  for (const f of fish) {
    f.angle += dtSec * f.speed;
    const r = f.radius * (0.9 + Math.sin(t * 0.3 + f.phase) * 0.1);
    f.obj.position.x = f.lake.x + Math.cos(f.angle) * r;
    f.obj.position.z = f.lake.z + Math.sin(f.angle) * r;
    f.obj.position.y = f.lake.waterY - f.depth + Math.sin(t * 2 + f.phase) * 0.01;
    f.obj.rotation.y = -f.angle + Math.PI / 2;
    f.obj.userData.tail.rotation.y = Math.sin(t * 8 + f.phase) * 0.6;
  }
}

// ---- ambient ripple rings: a fish surfacing, a drip, a breeze ------------
function spawnRipple(lake) {
  const geo = new THREE.RingGeometry(0.02, 0.036, 16);
  const mat = new THREE.MeshBasicMaterial({ color: 0xe8f4f8, transparent: true, opacity: 0.5, side: THREE.DoubleSide });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.rotation.x = -Math.PI / 2;
  const r = Math.random() * lake.radius * 0.5;
  const a = Math.random() * Math.PI * 2;
  mesh.position.set(lake.x + Math.cos(a) * r, lake.waterY + 0.012, lake.z + Math.sin(a) * r);
  decorGroup.add(mesh);
  ripples.push({ mesh, born: performance.now(), life: 2200 });
}

function updateRipples(now) {
  for (let i = ripples.length - 1; i >= 0; i--) {
    const r = ripples[i];
    const age = now - r.born;
    if (age > r.life) {
      decorGroup.remove(r.mesh);
      ripples.splice(i, 1);
      continue;
    }
    const t01 = age / r.life;
    const scale = 1 + t01 * 9;
    r.mesh.scale.set(scale, scale, scale);
    r.mesh.material.opacity = 0.5 * (1 - t01);
  }
}

let nextRippleAt = 0;
function maybeSpawnRipple(now) {
  if (now < nextRippleAt || LAKES.length === 0) return;
  spawnRipple(LAKES[Math.floor(Math.random() * LAKES.length)]);
  nextRippleAt = now + 1500 + Math.random() * 2500;
}

function buildIsland() {
  const group = new THREE.Group();
  const geo = new THREE.IcosahedronGeometry(ISLAND_RADIUS, 5);
  const pos = geo.attributes.position;
  const colors = new Float32Array(pos.count * 3);
  const sand = new THREE.Color(0xcbb98a);
  const grassA = new THREE.Color(0x4a9963);
  const grassB = new THREE.Color(0x2f6b46);
  const rock = new THREE.Color(0x59503f);
  const water = new THREE.Color(0x2a4d63);

  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
    const len = Math.hypot(x, y, z);
    const nx = x / len, ny = y / len, nz = z / len;

    // Soft-cap ny before it drives height — applied to the SAME capped
    // value used everywhere below (both the linear term and the flatten
    // multiplier were using raw ny before, so the previous cap barely
    // changed anything: py = ny * RADIUS * flatten still grew almost
    // linearly all the way to the true dome peak at ny=1). Now the whole
    // village area (ny up to ~0.6) is a gentle plateau; the coastline
    // still slopes down normally since only high ny is affected.
    const nyRaw = Math.max(ny, 0);
    const nyHeight = nyRaw <= 0.5 ? nyRaw : 0.5 + (nyRaw - 0.5) * 0.15;
    const flatten = 0.22 + 0.06 * nyHeight;
    let px = x * (0.86 + 0.09 * Math.sin(nz * 3.4 + 1.2));
    let pz = z * (0.86 + 0.09 * Math.cos(nx * 3.7));
    let py = nyHeight * ISLAND_RADIUS * flatten;
    const bump = heightNoise(nx, ny, nz);
    py += ny > 0.05 ? bump * 0.25 : bump * 0.08;

    let inLake = false;
    if (ny > 0) {
      for (const lake of LAKES) {
        const d = Math.hypot(px - lake.x, pz - lake.z);
        if (d < lake.radius) {
          const dip = 1 - d / lake.radius;
          py -= dip * dip * 0.3;
          if (d < lake.radius * 0.82) inLake = true;
        }
      }
    }

    pos.setXYZ(i, px, py, pz);

    let c;
    if (inLake) c = water;
    else if (ny < 0.02) c = rock.clone().lerp(grassB, 0.15);
    else if (py < -1.55) c = sand.clone().lerp(grassA, 0.25);
    else {
      const slope = 1 - ny;
      c = slope > 0.62 ? rock.clone().lerp(grassB, 0.3) : grassA.clone().lerp(grassB, Math.random() * 0.5);
    }
    colors[i * 3] = c.r;
    colors[i * 3 + 1] = c.g;
    colors[i * 3 + 2] = c.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geo.computeVertexNormals();

  const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.92, flatShading: true });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.receiveShadow = true;
  mesh.castShadow = true;
  group.add(mesh);

  for (let li = 0; li < LAKES.length; li++) {
    const lake = LAKES[li];
    const y = raycastHeight(mesh, lake.x, lake.z) - 0.1;
    lake.waterY = y;

    // Jittered-radius fan instead of a perfect circle, so the shoreline
    // reads as natural rather than a stamped-out disc. A per-lake seed
    // keeps the wobble stable across rebuilds.
    const jitterSeed = li * 91.7 + 12.3;
    const segs = 28;
    const deep = new THREE.Color(0x1f4258);
    const shallow = new THREE.Color(0x4f9cc4);
    const positions = [0, y, 0];
    const colors = [deep.r, deep.g, deep.b];
    for (let i = 0; i <= segs; i++) {
      const a = (i / segs) * Math.PI * 2;
      const wobble = 1 + Math.sin(a * 3 + jitterSeed) * 0.08 + Math.sin(a * 7 + jitterSeed * 2) * 0.04;
      const r = lake.radius * 0.82 * wobble;
      positions.push(Math.cos(a) * r, y, Math.sin(a) * r);
      colors.push(shallow.r, shallow.g, shallow.b);
    }
    const waterGeo = new THREE.BufferGeometry();
    waterGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(positions), 3));
    waterGeo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(colors), 3));
    const idx = [];
    for (let i = 1; i <= segs; i++) idx.push(0, i, i + 1);
    waterGeo.setIndex(idx);
    waterGeo.computeVertexNormals();
    const waterMat = new THREE.MeshPhysicalMaterial({
      vertexColors: true, transparent: true, opacity: 0.88,
      roughness: 0.12, metalness: 0.05, clearcoat: 0.7, clearcoatRoughness: 0.18,
    });
    const surface = new THREE.Mesh(waterGeo, waterMat);
    surface.position.set(lake.x, 0, lake.z);
    group.add(surface);
    lake.phase = li * 1.7;
    // Base (still-water) vertex positions, kept separate from the live
    // array so per-frame wave displacement has a stable reference to
    // offset from instead of drifting.
    waterMeshes.push({ mesh: surface, baseY: y, phase: lake.phase, basePos: Float32Array.from(positions) });

    // pale foam ring right at the shoreline
    const foam = new THREE.Mesh(
      new THREE.RingGeometry(lake.radius * 0.78, lake.radius * 0.85, segs),
      new THREE.MeshStandardMaterial({ color: 0xdff2f5, transparent: true, opacity: 0.35, roughness: 0.6 })
    );
    foam.rotation.x = -Math.PI / 2;
    foam.position.set(lake.x, y + 0.008, lake.z);
    group.add(foam);
  }

  const glow = new THREE.Mesh(
    new THREE.CircleGeometry(ISLAND_RADIUS * 1.3, 32),
    new THREE.MeshBasicMaterial({ color: 0x3d5aff, transparent: true, opacity: 0.08 })
  );
  glow.rotation.x = -Math.PI / 2;
  glow.position.y = -ISLAND_RADIUS * 0.55;
  group.add(glow);

  return { group, mesh };
}

const { group: islandGroup, mesh: islandMesh } = buildIsland();
scene.add(islandGroup);

function surfacePointAt(x, z) {
  raycaster.set(new THREE.Vector3(x, ISLAND_RADIUS * 2, z), new THREE.Vector3(0, -1, 0));
  const hit = raycaster.intersectObject(islandMesh, false)[0];
  return hit ? hit.point : null;
}

// ---- terrain flattening so buildings sit properly on the ground ---------
// The terrain is bumpy; a building's flat base would otherwise float over
// a dip or clip into a rise. We keep a pristine copy of the geometry and,
// on every rebuild, reset to it then carve smooth flat pads (smoothstep
// falloff) at the current building/keep/waypost positions before placing
// anything — so re-sampled ground height under each building is exactly
// where its base sits, however the layout has shifted since last time.
const basePositions = islandMesh.geometry.attributes.position.array.slice();

function resetTerrain() {
  islandMesh.geometry.attributes.position.array.set(basePositions);
}

function flattenSpots(spots) {
  const posAttr = islandMesh.geometry.attributes.position;
  const arr = posAttr.array;
  for (let i = 0; i < arr.length; i += 3) {
    const vx = arr[i];
    const vy = arr[i + 1];
    const vz = arr[i + 2];
    let bestBlend = 0;
    let bestY = vy;
    for (const s of spots) {
      const d = Math.hypot(vx - s.x, vz - s.z);
      if (d < s.radius) {
        const b = 1 - d / s.radius;
        const eased = b * b * (3 - 2 * b);
        if (eased > bestBlend) {
          bestBlend = eased;
          bestY = s.y;
        }
      }
    }
    if (bestBlend > 0) arr[i + 1] = vy + (bestY - vy) * bestBlend;
  }
  posAttr.needsUpdate = true;
  islandMesh.geometry.computeVertexNormals();
}

// ---- deterministic scatter for buildings (kept orderly / "planned") -----
const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));
function scatterPoint(index, totalGuess) {
  const spread = ISLAND_RADIUS * 0.72;
  let r = spread * Math.sqrt((index + 0.5) / Math.max(totalGuess, 6));
  const theta = index * GOLDEN_ANGLE;
  let x = r * Math.cos(theta);
  let z = r * Math.sin(theta);
  for (let tries = 0; tries < 5; tries++) {
    const inLake = LAKES.some((lake) => Math.hypot(x - lake.x, z - lake.z) < lake.radius + 0.35);
    if (!inLake) break;
    r += 0.4;
    x = r * Math.cos(theta);
    z = r * Math.sin(theta);
  }
  return { x, z };
}

// ---- medieval palettes ------------------------------------------------
const BODY_COLORS = [0xc9b896, 0x9a8266, 0xb0a58f, 0x7d6b4f, 0xcbb994, 0x8a7355];
const TRIM_COLORS = [0x8b5a2b, 0x5c5347, 0xa0522d, 0x6b4226];
const FLAG_COLORS = [0x8b1a1a, 0x1a3d6b, 0x2f5233, 0x4a3b6b, 0xb8860b];
const TREE_GREENS = [0x2f6b46, 0x3f8f5c, 0x336b3f, 0x4c7a3d];
const SKIN_TONES = [0xf2c9a1, 0xd8a273, 0xa9704f, 0x8d5a3c, 0xf7dcc0];
const HAIR_COLORS = [0x3a2a1e, 0x1c1c1c, 0x8a5a2b, 0xd9b45c, 0x6b3f2a, 0xcfcfcf];
const TUNIC_COLORS = [0x8b1a1a, 0x2f5233, 0x4a3b2a, 0x1a3d6b, 0xb8860b, 0x5c4033];
const PANTS_COLORS = [0x3e2f24, 0x4b3b2a, 0x2b2620, 0x5c4a38];
const CLOAK_COLORS = [0x3a2f5c, 0x1a3d6b, 0x2f5233, 0x5c2a2a, 0x4a3b2a];
const BELT_COLOR = 0x2b1f14;
const BOOT_COLOR = 0x2b1f14;
const HEARTH_GLOW = 0xff9a3c;

function seedFrom(str) {
  let h = 0;
  for (const ch of str) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return h;
}

// ---- building archetypes: cottage / watchtower / great hall / workshop --
function makeFlag(seed, poleHeight, poleRadius) {
  const flagGroup = new THREE.Group();
  const pole = new THREE.Mesh(
    new THREE.CylinderGeometry(poleRadius, poleRadius, poleHeight, 5),
    new THREE.MeshStandardMaterial({ color: 0x4b3b2a, roughness: 0.8 })
  );
  pole.position.y = poleHeight / 2;
  flagGroup.add(pole);

  const flagPivot = new THREE.Group();
  flagPivot.position.y = poleHeight - 0.08;
  const cloth = new THREE.Mesh(
    new THREE.PlaneGeometry(0.28, 0.16),
    new THREE.MeshStandardMaterial({
      color: FLAG_COLORS[seed % FLAG_COLORS.length],
      roughness: 0.7,
      side: THREE.DoubleSide,
    })
  );
  cloth.position.x = 0.15;
  flagPivot.add(cloth);
  flagGroup.add(flagPivot);
  flagGroup.userData.flagPivot = flagPivot;
  return flagGroup;
}

function buildBuilding(seed) {
  const group = new THREE.Group();
  const archetype = seed % 4;
  const bodyColor = BODY_COLORS[seed % BODY_COLORS.length];
  const trimColor = TRIM_COLORS[(seed >> 4) % TRIM_COLORS.length];
  const height = 0.8 + ((seed >> 3) % 10) / 12;
  const width = 0.5 + ((seed >> 6) % 5) / 22;
  const bodyMat = new THREE.MeshStandardMaterial({ color: bodyColor, roughness: 0.85, flatShading: true });
  const trimMat = new THREE.MeshStandardMaterial({ color: trimColor, roughness: 0.85, flatShading: true });

  let topY;
  let flag = null;

  if (archetype === 0) {
    // cottage: stone box + thatched pyramid roof
    const body = new THREE.Mesh(new THREE.BoxGeometry(width, height, width), bodyMat);
    body.position.y = height / 2;
    group.add(body);
    const roofH = 0.3 + ((seed >> 9) % 4) / 10;
    const roof = new THREE.Mesh(new THREE.ConeGeometry(width * 0.8, roofH, 4), trimMat);
    roof.rotation.y = Math.PI / 4;
    roof.position.y = height + roofH / 2;
    group.add(roof);
    topY = height + roofH;
  } else if (archetype === 1) {
    // watchtower: stone cylinder + cone roof + banner
    const body = new THREE.Mesh(new THREE.CylinderGeometry(width * 0.42, width * 0.5, height * 1.3, 6), bodyMat);
    body.position.y = (height * 1.3) / 2;
    group.add(body);
    const roofH = 0.35;
    const roof = new THREE.Mesh(new THREE.ConeGeometry(width * 0.5, roofH, 6), trimMat);
    roof.position.y = height * 1.3 + roofH / 2;
    group.add(roof);
    flag = makeFlag(seed, 0.3, 0.015);
    flag.position.y = height * 1.3 + roofH;
    group.add(flag);
    topY = height * 1.3 + roofH + 0.3;
  } else if (archetype === 2) {
    // great hall: wide timber-framed box + long pitched roof + banner
    const body = new THREE.Mesh(new THREE.BoxGeometry(width * 1.3, height * 0.75, width * 1.3), bodyMat);
    body.position.y = (height * 0.75) / 2;
    group.add(body);
    const roof = new THREE.Mesh(new THREE.ConeGeometry(width * 0.95, 0.42, 4), trimMat);
    roof.rotation.y = Math.PI / 4;
    roof.scale.set(1.35, 0.8, 1);
    roof.position.y = height * 0.75 + 0.21;
    group.add(roof);
    flag = makeFlag(seed, 0.32, 0.016);
    flag.position.set(width * 0.5, height * 0.75, 0);
    group.add(flag);
    topY = height * 0.75 + 0.42;
  } else {
    // workshop: timber block + flat roof + chimney
    const body = new THREE.Mesh(new THREE.BoxGeometry(width, height * 0.9, width), bodyMat);
    body.position.y = (height * 0.9) / 2;
    group.add(body);
    const parapet = new THREE.Mesh(new THREE.BoxGeometry(width * 1.05, 0.06, width * 1.05), trimMat);
    parapet.position.y = height * 0.9 + 0.03;
    group.add(parapet);
    const chimney = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, 0.22, 8), trimMat);
    chimney.position.set(width * 0.25, height * 0.9 + 0.17, width * 0.25);
    group.add(chimney);
    topY = height * 0.9 + 0.28;
  }

  const winMat = new THREE.MeshStandardMaterial({ color: 0x2a1c10, emissive: 0x000000, emissiveIntensity: 0 });
  const win = new THREE.Mesh(new THREE.PlaneGeometry(width * 0.25, width * 0.25), winMat);
  win.position.set(0, height * 0.4, width / 2 + 0.01);
  group.add(win);

  group.userData.windowMat = winMat;
  group.userData.flag = flag ? flag.userData.flagPivot : null;
  group.userData.height = topY;
  group.traverse((o) => {
    if (o.isMesh) {
      o.castShadow = true;
      o.receiveShadow = true;
    }
  });
  return group;
}

// ---- rocks & flower patches --------------------------------------------
function buildRock(seed) {
  const group = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color: 0x6b6558, roughness: 0.95, flatShading: true });
  const chunks = 2 + (seed % 2);
  for (let i = 0; i < chunks; i++) {
    const s = 0.09 + ((seed >> (i * 3)) % 5) / 40;
    const rock = new THREE.Mesh(new THREE.IcosahedronGeometry(s, 0), mat);
    rock.position.set((Math.random() - 0.5) * 0.14, s * 0.5, (Math.random() - 0.5) * 0.14);
    rock.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI);
    rock.castShadow = true;
    rock.receiveShadow = true;
    group.add(rock);
  }
  return group;
}

const FLOWER_COLORS = [0xf4a7b9, 0xf7e26b, 0xb98af4, 0xf4f4f4, 0xf4874a];
function buildFlowerPatch(seed) {
  const group = new THREE.Group();
  const count = 4 + (seed % 4);
  for (let i = 0; i < count; i++) {
    const color = FLOWER_COLORS[(seed + i) % FLOWER_COLORS.length];
    const flower = new THREE.Mesh(
      new THREE.SphereGeometry(0.02, 5, 5),
      new THREE.MeshStandardMaterial({ color, roughness: 0.6 })
    );
    flower.position.set((Math.random() - 0.5) * 0.4, 0.03, (Math.random() - 0.5) * 0.4);
    group.add(flower);
  }
  return group;
}

// ---- cozy decorative landmarks: tavern, well, windmill -------------------
// Pure atmosphere — no click handler, no project ties, no gameplay effect.
function buildTavern(seed) {
  const group = new THREE.Group();
  const woodMat = new THREE.MeshStandardMaterial({ color: 0x7d6b4f, roughness: 0.85, flatShading: true });
  const stoneMat = new THREE.MeshStandardMaterial({ color: 0xb0a58f, roughness: 0.85, flatShading: true });
  const roofMat = new THREE.MeshStandardMaterial({ color: 0x6b4226, roughness: 0.85, flatShading: true });

  const plinth = new THREE.Mesh(
    new THREE.CylinderGeometry(0.75, 0.8, 0.06, 12),
    new THREE.MeshStandardMaterial({ color: 0x6b5d4a, roughness: 0.95, flatShading: true })
  );
  plinth.position.y = 0.03;
  group.add(plinth);

  const base = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.6, 0.9), stoneMat);
  base.position.y = 0.06 + 0.3;
  group.add(base);
  const upper = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.55, 0.8), woodMat);
  upper.position.y = 0.06 + 0.6 + 0.275;
  group.add(upper);
  const roof = new THREE.Mesh(new THREE.ConeGeometry(0.85, 0.55, 4), roofMat);
  roof.rotation.y = Math.PI / 4;
  roof.scale.set(1.3, 0.75, 1);
  roof.position.y = 0.06 + 0.6 + 0.55 + 0.2;
  group.add(roof);

  // hanging sign
  const bracket = new THREE.Mesh(
    new THREE.CylinderGeometry(0.015, 0.015, 0.3, 5),
    new THREE.MeshStandardMaterial({ color: 0x2b1f14, roughness: 0.9 })
  );
  bracket.rotation.z = Math.PI / 2;
  bracket.position.set(0.62, 0.06 + 0.75, 0.3);
  group.add(bracket);
  const sign = new THREE.Mesh(
    new THREE.BoxGeometry(0.2, 0.16, 0.02),
    new THREE.MeshStandardMaterial({ color: 0xb8860b, roughness: 0.7, emissive: 0xff9a3c, emissiveIntensity: 0.15 })
  );
  sign.position.set(0.78, 0.06 + 0.62, 0.3);
  group.add(sign);

  // barrels out front
  for (const bx of [-0.5, -0.35]) {
    const barrel = new THREE.Mesh(
      new THREE.CylinderGeometry(0.09, 0.09, 0.18, 10),
      new THREE.MeshStandardMaterial({ color: 0x5b3d26, roughness: 0.85 })
    );
    barrel.position.set(bx, 0.06 + 0.09, 0.55);
    barrel.castShadow = true;
    group.add(barrel);
  }

  const winMat = new THREE.MeshStandardMaterial({ color: 0x2a1c10, emissive: 0xff9a3c, emissiveIntensity: 0 });
  const win = new THREE.Mesh(new THREE.PlaneGeometry(0.18, 0.18), winMat);
  win.position.set(0, 0.06 + 0.35, 0.451);
  group.add(win);

  group.userData.windowMat = winMat;
  group.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  return group;
}

function buildWell(seed) {
  const group = new THREE.Group();
  const stoneMat = new THREE.MeshStandardMaterial({ color: 0x9a8f7a, roughness: 0.9, flatShading: true });
  const woodMat = new THREE.MeshStandardMaterial({ color: 0x5b3d26, roughness: 0.85 });

  const ring = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.24, 0.28, 10), stoneMat);
  ring.position.y = 0.14;
  group.add(ring);

  for (const a of [-1, 1]) {
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.42, 6), woodMat);
    post.position.set(a * 0.2, 0.28 + 0.21, 0);
    group.add(post);
  }
  const roofBeam = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.45, 5), woodMat);
  roofBeam.rotation.z = Math.PI / 2;
  roofBeam.position.y = 0.28 + 0.42;
  group.add(roofBeam);
  const roof = new THREE.Mesh(new THREE.ConeGeometry(0.34, 0.22, 4), woodMat);
  roof.rotation.y = Math.PI / 4;
  roof.position.y = 0.28 + 0.42 + 0.13;
  group.add(roof);

  group.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  return group;
}

function buildWindmill(seed) {
  const group = new THREE.Group();
  const stoneMat = new THREE.MeshStandardMaterial({ color: 0xc9b896, roughness: 0.85, flatShading: true });
  const roofMat = new THREE.MeshStandardMaterial({ color: 0x6b4226, roughness: 0.85, flatShading: true });

  const plinth = new THREE.Mesh(
    new THREE.CylinderGeometry(0.4, 0.44, 0.06, 10),
    new THREE.MeshStandardMaterial({ color: 0x6b5d4a, roughness: 0.95, flatShading: true })
  );
  plinth.position.y = 0.03;
  group.add(plinth);

  const tower = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.32, 1.1, 8), stoneMat);
  tower.position.y = 0.06 + 0.55;
  group.add(tower);
  const cap = new THREE.Mesh(new THREE.ConeGeometry(0.3, 0.32, 8), roofMat);
  cap.position.y = 0.06 + 1.1 + 0.16;
  group.add(cap);

  const hub = new THREE.Group();
  hub.position.set(0, 0.06 + 1.0, 0.34);
  const hubMat = new THREE.MeshStandardMaterial({ color: 0x4b3b2a, roughness: 0.8 });
  const hubCore = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.06, 8), hubMat);
  hubCore.rotation.x = Math.PI / 2;
  hub.add(hubCore);
  for (let i = 0; i < 4; i++) {
    const blade = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.5, 0.02), hubMat);
    blade.position.y = 0.28;
    const pivot = new THREE.Group();
    pivot.rotation.z = (Math.PI / 2) * i;
    pivot.add(blade);
    hub.add(pivot);
  }
  group.add(hub);
  group.userData.hub = hub;

  group.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  return group;
}
const windmills = [];
const cozyBuildings = [];
const lanterns = [];

// ---- unique dock per lake -------------------------------------------------
function buildRowboat() {
  const group = new THREE.Group();
  const hullMat = new THREE.MeshStandardMaterial({ color: 0x7d5a3a, roughness: 0.8, flatShading: true });
  const hull = new THREE.Mesh(new THREE.CapsuleGeometry(0.09, 0.28, 4, 8), hullMat);
  hull.rotation.z = Math.PI / 2;
  hull.scale.set(1, 1, 0.6);
  hull.position.y = 0.03;
  group.add(hull);
  const seatMat = new THREE.MeshStandardMaterial({ color: 0x5b3d26, roughness: 0.85 });
  const seat = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.02, 0.08), seatMat);
  seat.position.y = 0.07;
  group.add(seat);
  return group;
}

function buildDock(lake, index) {
  const group = new THREE.Group();
  const variant = index % 3;
  const angle = index * 2.35 + 0.6;
  const dir = { x: Math.cos(angle), z: Math.sin(angle) };
  const perpDir = { x: -dir.z, z: dir.x };
  const deckY = lake.waterY + 0.05;
  const plankMat = new THREE.MeshStandardMaterial({ color: 0x6b4a2f, roughness: 0.85, flatShading: true });
  const postMat = new THREE.MeshStandardMaterial({ color: 0x4b3320, roughness: 0.9 });

  function addWalkway(fromPt, toPt, width) {
    const segDir = new THREE.Vector3().subVectors(toPt, fromPt);
    const segLen = segDir.length();
    segDir.normalize();
    const mid = fromPt.clone().add(toPt).multiplyScalar(0.5);
    const plank = new THREE.Mesh(new THREE.BoxGeometry(segLen, 0.05, width), plankMat);
    plank.position.set(mid.x, deckY, mid.z);
    plank.rotation.y = -Math.atan2(segDir.z, segDir.x);
    group.add(plank);

    const postCount = Math.max(2, Math.round(segLen / 0.5) + 1);
    for (let i = 0; i < postCount; i++) {
      const t = i / (postCount - 1);
      const p = fromPt.clone().lerp(toPt, t);
      for (const side of [-1, 1]) {
        const post = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.03, 0.5, 6), postMat);
        post.position.set(p.x - segDir.z * side * width * 0.42, deckY - 0.22, p.z + segDir.x * side * width * 0.42);
        group.add(post);
      }
    }
  }

  const startR = lake.radius * 0.95;
  const startPt = new THREE.Vector3(lake.x + dir.x * startR, deckY, lake.z + dir.z * startR);

  if (variant === 0) {
    // short straight dock with a lantern at the end
    const endPt = new THREE.Vector3(lake.x + dir.x * lake.radius * 0.4, deckY, lake.z + dir.z * lake.radius * 0.4);
    addWalkway(startPt, endPt, 0.32);
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.4, 6), postMat);
    pole.position.set(endPt.x, deckY + 0.2, endPt.z);
    group.add(pole);
    const lanternMat = new THREE.MeshStandardMaterial({ color: 0xffcf8a, emissive: 0xff9a3c, emissiveIntensity: 0.3, roughness: 0.5 });
    const lantern = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 8), lanternMat);
    lantern.position.set(endPt.x, deckY + 0.42, endPt.z);
    group.add(lantern);
    group.userData.lantern = lanternMat;
  } else if (variant === 1) {
    // L-shaped dock ending in a small crate platform
    const midPt = startPt.clone().lerp(new THREE.Vector3(lake.x, deckY, lake.z), 0.55);
    addWalkway(startPt, midPt, 0.34);
    const branchEnd = midPt.clone().add(new THREE.Vector3(perpDir.x, 0, perpDir.z).multiplyScalar(0.65));
    addWalkway(midPt, branchEnd, 0.34);
    const crateMat = new THREE.MeshStandardMaterial({ color: 0x8a6a3f, roughness: 0.85, flatShading: true });
    for (let i = 0; i < 2; i++) {
      const crate = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.13, 0.13), crateMat);
      crate.position.set(branchEnd.x + i * 0.02, deckY + 0.09 + i * 0.13, branchEnd.z - i * 0.02);
      crate.rotation.y = i * 0.5;
      group.add(crate);
    }
  } else {
    // longer dock with mooring posts and a tied-up rowboat
    const endPt = new THREE.Vector3(lake.x + dir.x * lake.radius * 0.15, deckY, lake.z + dir.z * lake.radius * 0.15);
    addWalkway(startPt, endPt, 0.4);
    for (const side of [-1, 1]) {
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.03, 0.35, 6), postMat);
      post.position.set(endPt.x + perpDir.x * side * 0.28, deckY + 0.05, endPt.z + perpDir.z * side * 0.28);
      group.add(post);
    }
    const boat = buildRowboat();
    const boatX = endPt.x + perpDir.x * 0.55;
    const boatZ = endPt.z + perpDir.z * 0.55;
    boat.position.set(boatX, lake.waterY + 0.03, boatZ);
    boat.rotation.y = angle;
    group.add(boat);
    group.userData.boat = boat;
    group.userData.boatOffset = { cx: boatX - lake.x, cz: boatZ - lake.z };
  }

  group.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  return group;
}

// ---- trees & bushes ---------------------------------------------------
function buildTree(seed) {
  const group = new THREE.Group();
  const trunk = new THREE.Mesh(
    new THREE.CylinderGeometry(0.03, 0.045, 0.28, 6),
    new THREE.MeshStandardMaterial({ color: 0x5b3d26, roughness: 0.9 })
  );
  trunk.position.y = 0.14;
  group.add(trunk);

  const green = TREE_GREENS[seed % TREE_GREENS.length];
  const canopyMat = new THREE.MeshStandardMaterial({ color: green, roughness: 0.85, flatShading: true });
  if (seed % 2 === 0) {
    for (let i = 0; i < 3; i++) {
      const s = 1 - i * 0.22;
      const cone = new THREE.Mesh(new THREE.ConeGeometry(0.22 * s, 0.26, 7), canopyMat);
      cone.position.y = 0.28 + i * 0.16;
      group.add(cone);
    }
  } else {
    for (let i = 0; i < 3; i++) {
      const sph = new THREE.Mesh(new THREE.IcosahedronGeometry(0.16 + (i % 2) * 0.03, 0), canopyMat);
      sph.position.set((Math.random() - 0.5) * 0.12, 0.34 + i * 0.06, (Math.random() - 0.5) * 0.12);
      group.add(sph);
    }
  }
  group.scale.setScalar(0.85 + (seed % 5) / 12);
  group.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  return group;
}

function buildBush(seed) {
  const group = new THREE.Group();
  const green = TREE_GREENS[(seed + 1) % TREE_GREENS.length];
  const mat = new THREE.MeshStandardMaterial({ color: green, roughness: 0.9, flatShading: true });
  for (let i = 0; i < 3; i++) {
    const sph = new THREE.Mesh(new THREE.IcosahedronGeometry(0.09, 0), mat);
    sph.position.set((Math.random() - 0.5) * 0.14, 0.06 + Math.random() * 0.03, (Math.random() - 0.5) * 0.14);
    group.add(sph);
  }
  group.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  return group;
}

// ---- jointed low-poly villager ------------------------------------------
function buildPerson(seed) {
  const group = new THREE.Group();
  const skin = SKIN_TONES[seed % SKIN_TONES.length];
  const tunic = TUNIC_COLORS[(seed >> 2) % TUNIC_COLORS.length];
  const pants = PANTS_COLORS[(seed >> 4) % PANTS_COLORS.length];
  const hair = HAIR_COLORS[(seed >> 6) % HAIR_COLORS.length];
  const cloakColor = CLOAK_COLORS[(seed >> 10) % CLOAK_COLORS.length];
  const hasCloak = (seed & 1) === 0;
  const hasBeard = ((seed >> 8) % 3) === 0;

  const hipY = 0.16;
  const legLen = 0.16;
  const torsoH = 0.18;

  const skinMat = new THREE.MeshStandardMaterial({ color: skin, roughness: 0.7 });
  const bootMat = new THREE.MeshStandardMaterial({ color: BOOT_COLOR, roughness: 0.85 });
  const legMat = new THREE.MeshStandardMaterial({ color: pants, roughness: 0.8 });
  const legGeo = new THREE.CapsuleGeometry(0.035, legLen, 4, 6);
  function makeLeg(xOff) {
    const pivot = new THREE.Group();
    const mesh = new THREE.Mesh(legGeo, legMat);
    mesh.position.y = -legLen / 2;
    pivot.add(mesh);
    const boot = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.04, 0.075), bootMat);
    boot.position.set(0, -legLen - 0.02, 0.012);
    pivot.add(boot);
    pivot.position.set(xOff, hipY, 0);
    return pivot;
  }
  const legL = makeLeg(-0.045);
  const legR = makeLeg(0.045);
  group.add(legL, legR);

  const torso = new THREE.Mesh(
    new THREE.CapsuleGeometry(0.07, torsoH, 4, 8),
    new THREE.MeshStandardMaterial({ color: tunic, roughness: 0.75 })
  );
  const shoulderY = hipY + legLen + torsoH * 0.85;
  const waistY = hipY + legLen;
  torso.position.y = waistY + torsoH / 2;
  group.add(torso);

  const belt = new THREE.Mesh(
    new THREE.TorusGeometry(0.072, 0.012, 6, 12),
    new THREE.MeshStandardMaterial({ color: BELT_COLOR, roughness: 0.8 })
  );
  belt.rotation.x = Math.PI / 2;
  belt.position.y = waistY + 0.02;
  group.add(belt);

  if (hasCloak) {
    const cloak = new THREE.Mesh(
      new THREE.BoxGeometry(0.15, torsoH + 0.06, 0.02),
      new THREE.MeshStandardMaterial({ color: cloakColor, roughness: 0.85, flatShading: true })
    );
    cloak.position.set(0, waistY + (torsoH + 0.06) / 2 - 0.02, -0.06);
    group.add(cloak);
  }

  const armGeo = new THREE.CapsuleGeometry(0.028, 0.16, 4, 6);
  function makeArm(xOff) {
    const pivot = new THREE.Group();
    const mesh = new THREE.Mesh(armGeo, skinMat);
    mesh.position.y = -0.08;
    pivot.add(mesh);
    const hand = new THREE.Mesh(new THREE.SphereGeometry(0.03, 8, 8), skinMat);
    hand.position.y = -0.16;
    pivot.add(hand);
    pivot.position.set(xOff, shoulderY, 0);
    return pivot;
  }
  const armL = makeArm(-0.11);
  const armR = makeArm(0.11);
  group.add(armL, armR);

  // simple tool (hammer/pick) held in the right hand — visible only while active
  const tool = new THREE.Group();
  const handle = new THREE.Mesh(
    new THREE.CylinderGeometry(0.012, 0.012, 0.14, 5),
    new THREE.MeshStandardMaterial({ color: 0x4b3b2a, roughness: 0.9 })
  );
  handle.position.y = -0.15;
  tool.add(handle);
  const head = new THREE.Mesh(
    new THREE.BoxGeometry(0.05, 0.03, 0.03),
    new THREE.MeshStandardMaterial({ color: 0x8a8a8a, roughness: 0.5, metalness: 0.3 })
  );
  head.position.y = -0.08;
  tool.add(head);
  tool.visible = false;
  armR.add(tool);

  const headMesh = new THREE.Mesh(new THREE.SphereGeometry(0.07, 12, 12), skinMat);
  headMesh.position.y = shoulderY + 0.12;
  group.add(headMesh);

  const eyeMat = new THREE.MeshStandardMaterial({ color: 0x1c140c, roughness: 0.5 });
  for (const xOff of [-0.026, 0.026]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.009, 6, 6), eyeMat);
    eye.position.set(xOff, headMesh.position.y + 0.005, 0.064);
    group.add(eye);
  }

  const hairMesh = new THREE.Mesh(
    new THREE.SphereGeometry(0.074, 10, 10, 0, Math.PI * 2, 0, Math.PI * 0.55),
    new THREE.MeshStandardMaterial({ color: hair, roughness: 0.85 })
  );
  hairMesh.position.y = headMesh.position.y + 0.012;
  group.add(hairMesh);

  if (hasBeard) {
    const beard = new THREE.Mesh(
      new THREE.SphereGeometry(0.045, 8, 8, 0, Math.PI * 2, Math.PI * 0.35, Math.PI * 0.4),
      new THREE.MeshStandardMaterial({ color: hair, roughness: 0.85 })
    );
    beard.position.set(0, headMesh.position.y - 0.025, 0.045);
    group.add(beard);
  }

  group.userData.legL = legL;
  group.userData.legR = legR;
  group.userData.armL = armL;
  group.userData.armR = armR;
  group.userData.tool = tool;
  group.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  return group;
}

// ---- the Great Keep: a fixed landmark at the island's heart --------------
const KEEP_KEY = '__keep__';
function buildKeep() {
  const group = new THREE.Group();
  const stoneMat = new THREE.MeshStandardMaterial({ color: 0x9a8f7a, roughness: 0.85, flatShading: true });
  const roofMat = new THREE.MeshStandardMaterial({ color: 0x4a3f33, roughness: 0.85, flatShading: true });

  const plinth = new THREE.Mesh(
    new THREE.CylinderGeometry(0.85, 0.92, 0.08, 12),
    new THREE.MeshStandardMaterial({ color: 0x6b5d4a, roughness: 0.95, flatShading: true })
  );
  plinth.position.y = 0.04;
  group.add(plinth);

  const base = 0.08;
  const keep = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.65, 1.3, 8), stoneMat);
  keep.position.y = 0.65 + base;
  group.add(keep);
  const roof = new THREE.Mesh(new THREE.ConeGeometry(0.62, 0.6, 8), roofMat);
  roof.position.y = 1.3 + 0.3 + base;
  group.add(roof);

  for (const a of [0, Math.PI / 2, Math.PI, (3 * Math.PI) / 2]) {
    const turret = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.18, 1.0, 6), stoneMat);
    turret.position.set(Math.cos(a) * 0.6, 0.5 + base, Math.sin(a) * 0.6);
    group.add(turret);
    const turretRoof = new THREE.Mesh(new THREE.ConeGeometry(0.19, 0.28, 6), roofMat);
    turretRoof.position.set(Math.cos(a) * 0.6, 1.0 + 0.14 + base, Math.sin(a) * 0.6);
    group.add(turretRoof);
  }

  const flagPole = makeFlag(0, 0.5, 0.02);
  flagPole.position.y = 1.3 + 0.6 + base;
  group.add(flagPole);
  group.userData.flag = flagPole.userData.flagPivot;

  group.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  return group;
}

const keepGroup = buildKeep();
const keepSurface = surfacePointAt(0, 0) || new THREE.Vector3(0, 0, 0);
keepGroup.position.copy(keepSurface);
islandGroup.add(keepGroup);
keepGroup.children[0].userData.tileKey = KEEP_KEY; // the main cylinder is the hit target

// Dedicated sub-groups so rebuilding tiles never touches decoration (or
// vice versa) — previously both lived as flat siblings and a rebuild would
// wipe out every tree/bush the first time a project's status changed.
const tilesGroup = new THREE.Group();
islandGroup.add(tilesGroup);
const decorGroup = new THREE.Group();
islandGroup.add(decorGroup);
const roadGroup = new THREE.Group();
islandGroup.add(roadGroup);

// ---- dirt road ribbons, hub-and-spoke from the Keep ----------------------
function buildRoadSegment(from, to) {
  const dist = Math.hypot(to.x - from.x, to.z - from.z);
  const segments = Math.max(4, Math.round(dist * 6));
  const w = 0.11;
  const pts = [];
  for (let i = 0; i <= segments; i++) {
    const tt = i / segments;
    const x = from.x + (to.x - from.x) * tt;
    const z = from.z + (to.z - from.z) * tt;
    pts.push(new THREE.Vector3(x, raycastHeight(islandMesh, x, z) + 0.025, z));
  }
  const positions = [];
  for (let i = 0; i < pts.length; i++) {
    const prev = pts[Math.max(0, i - 1)];
    const next = pts[Math.min(pts.length - 1, i + 1)];
    const dir = next.clone().sub(prev);
    if (dir.lengthSq() < 1e-8) dir.set(1, 0, 0);
    dir.normalize();
    const perp = new THREE.Vector3(-dir.z, 0, dir.x).multiplyScalar(w / 2);
    const p = pts[i];
    positions.push(p.x - perp.x, p.y, p.z - perp.z, p.x + perp.x, p.y, p.z + perp.z);
  }
  const idx = [];
  for (let i = 0; i < segments; i++) {
    const a = i * 2, b = i * 2 + 1, c = i * 2 + 2, d = i * 2 + 3;
    idx.push(a, b, c, b, d, c);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(positions), 3));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  const mesh = new THREE.Mesh(geo, roadMat);
  mesh.receiveShadow = true;
  return mesh;
}
const roadMat = new THREE.MeshStandardMaterial({ color: 0x8a7355, roughness: 0.98 });

function buildRoads(spots) {
  roadGroup.clear();
  const hub = spots[0];
  for (let i = 1; i < spots.length; i++) {
    roadGroup.add(buildRoadSegment(hub, spots[i]));
  }
}

// ---- wandering villagers: pure decoration, no ties to any project -------
const wanderersGroup = new THREE.Group();
islandGroup.add(wanderersGroup);
const wanderers = [];

function pickWanderSpot() {
  for (let tries = 0; tries < 20; tries++) {
    const angle = Math.random() * Math.PI * 2;
    const r = Math.sqrt(Math.random()) * ISLAND_RADIUS * 0.85;
    const x = Math.cos(angle) * r;
    const z = Math.sin(angle) * r;
    if (LAKES.some((l) => Math.hypot(x - l.x, z - l.z) < l.radius + 0.2)) continue;
    const surface = surfacePointAt(x, z);
    if (!surface || surface.y < -1.4) continue;
    return surface;
  }
  return new THREE.Vector3(0, 0, 0);
}

function spawnWanderers(count) {
  for (let i = 0; i < count; i++) {
    const seed = Math.floor(Math.random() * 1e6);
    const person = buildPerson(seed);
    const scale = 0.9 + Math.random() * 0.25;
    person.scale.setScalar(scale);
    const start = pickWanderSpot();
    person.position.copy(start);
    wanderersGroup.add(person);
    wanderers.push({
      person,
      target: pickWanderSpot(),
      speed: 0.22 + Math.random() * 0.18,
      walkPhase: Math.random() * Math.PI * 2,
      pauseUntil: 0,
    });
  }
}

function updateWanderers(t, dtSec) {
  const now = performance.now();
  for (const w of wanderers) {
    const p = w.person;
    const { legL, legR, armL, armR } = p.userData;

    if (now < w.pauseUntil) {
      legL.rotation.x = 0;
      legR.rotation.x = 0;
      armL.rotation.x = Math.sin(t * 1.2 + w.walkPhase) * 0.05;
      armR.rotation.x = -Math.sin(t * 1.2 + w.walkPhase) * 0.05;
      continue;
    }

    const dx = w.target.x - p.position.x;
    const dz = w.target.z - p.position.z;
    const dist = Math.hypot(dx, dz);

    if (dist < 0.1) {
      w.target = pickWanderSpot();
      w.pauseUntil = now + 1200 + Math.random() * 2800;
      continue;
    }

    const step = Math.min(dist, w.speed * dtSec);
    p.position.x += (dx / dist) * step;
    p.position.z += (dz / dist) * step;
    const surface = surfacePointAt(p.position.x, p.position.z);
    if (surface) p.position.y = surface.y;
    p.rotation.y = Math.atan2(dx, dz);

    const swing = Math.sin(t * 6.5 + w.walkPhase) * 0.5;
    legL.rotation.x = swing;
    legR.rotation.x = -swing;
    armL.rotation.x = -swing * 0.75;
    armR.rotation.x = swing * 0.75;
    p.position.y += Math.abs(Math.sin(t * 6.5 + w.walkPhase)) * 0.025;
  }
}

// ---- scene graph for projects -------------------------------------------
const tiles = new Map(); // path -> { group, building, person, walkPhase, hitMesh, project }
const ADD_SLOT_KEY = '__add__';

function clearTile(path) {
  const tile = tiles.get(path);
  if (!tile) return;
  tilesGroup.remove(tile.group);
  tiles.delete(path);
}

function placeTile(key, index, totalGuess, isAddSlot, project) {
  const { x, z } = scatterPoint(index, totalGuess);
  const surface = surfacePointAt(x, z) || new THREE.Vector3(x, 0, z);

  const group = new THREE.Group();
  group.position.copy(surface);
  tilesGroup.add(group);

  let hitMesh;
  if (isAddSlot) {
    const padBase = new THREE.Mesh(
      new THREE.CylinderGeometry(0.26, 0.29, 0.05, 10),
      new THREE.MeshStandardMaterial({ color: 0x6b5d4a, roughness: 0.95, flatShading: true })
    );
    padBase.position.y = 0.025;
    padBase.receiveShadow = true;
    group.add(padBase);
    // stone waypost with a warm carved-rune glow
    const post = new THREE.Mesh(
      new THREE.CylinderGeometry(0.05, 0.06, 0.5, 6),
      new THREE.MeshStandardMaterial({ color: 0x6b5a3e, roughness: 0.9 })
    );
    post.position.y = 0.28;
    group.add(post);
    const sign = new THREE.Mesh(
      new THREE.BoxGeometry(0.32, 0.22, 0.04),
      new THREE.MeshStandardMaterial({ color: 0x8b5a2b, roughness: 0.8, emissive: 0xff9a3c, emissiveIntensity: 0.25 })
    );
    sign.position.y = 0.48;
    group.add(sign);
    hitMesh = post;
  } else {
    const plinth = new THREE.Mesh(
      new THREE.CylinderGeometry(0.42, 0.47, 0.06, 10),
      new THREE.MeshStandardMaterial({ color: 0x6b5d4a, roughness: 0.95, flatShading: true })
    );
    plinth.position.y = 0.03;
    plinth.receiveShadow = true;
    group.add(plinth);

    const seed = seedFrom(project.name);
    const building = buildBuilding(seed);
    building.position.y = 0.06;
    group.add(building);
    const person = buildPerson(seed >>> 3);
    person.position.set(0.5, 0.06, 0.3);
    group.add(person);

    const torch = new THREE.PointLight(0xff9a3c, 0, 2.2);
    torch.position.set(0, (building.userData.height || 1) * 0.4, 0.3);
    group.add(torch);

    hitMesh = building.children[0];
    tiles.set(key, { group, building, person, torch, walkPhase: Math.random() * Math.PI * 2, hitMesh, project });
  }

  hitMesh.userData.tileKey = key;
  return hitMesh;
}

let projects = [];
const clickables = [];
const prevActive = new Map(); // path -> bool, to detect transitions for toasts
const lastChange = new Map(); // path -> timestamp, for the sidebar's relative time

function rebuildScene() {
  for (const [key] of tiles) clearTile(key);
  clickables.length = 0;
  clickables.push(keepGroup.children[0]);

  // Reset to pristine terrain, then flatten a pad at every current
  // building/keep/waypost position before anything gets placed.
  resetTerrain();
  const total = projects.length + 1;
  const spots = [{ x: 0, z: 0, radius: 2.0, y: raycastHeight(islandMesh, 0, 0) }];
  const projectPts = projects.map((project, i) => {
    const { x, z } = scatterPoint(i, total);
    return { project, x, z };
  });
  for (const p of projectPts) {
    spots.push({ x: p.x, z: p.z, radius: 1.1, y: raycastHeight(islandMesh, p.x, p.z) });
  }
  const addPt = scatterPoint(projects.length, total);
  spots.push({ x: addPt.x, z: addPt.z, radius: 0.7, y: raycastHeight(islandMesh, addPt.x, addPt.z) });
  flattenSpots(spots);

  projectPts.forEach((p, i) => {
    const hit = placeTile(p.project.path, i, total, false, p.project);
    clickables.push(hit);
  });
  const addHit = placeTile(ADD_SLOT_KEY, projects.length, total, true, null);
  clickables.push(addHit);

  buildRoads(spots);
}

// ---- natural decoration: random rejection-sampled trees & bushes --------
let decorGenerated = false;
function generateDecor() {
  if (decorGenerated) return;
  decorGenerated = true;

  const occupied = [
    ...[...tiles.values()].map((t) => ({ x: t.group.position.x, z: t.group.position.z, r: 0.55 })),
    ...LAKES.map((l) => ({ x: l.x, z: l.z, r: l.radius + 0.4 })),
  ];

  function tooClose(x, z, minDist) {
    return occupied.some((o) => Math.hypot(x - o.x, z - o.z) < Math.max(minDist, o.r));
  }

  function scatterRandom(count, build, minDist, onPlace, flattenRadius) {
    let placed = 0;
    let attempts = 0;
    while (placed < count && attempts < count * 25) {
      attempts++;
      const angle = Math.random() * Math.PI * 2;
      const r = Math.sqrt(Math.random()) * ISLAND_RADIUS * 0.88;
      const x = Math.cos(angle) * r;
      const z = Math.sin(angle) * r;
      if (tooClose(x, z, minDist)) continue;
      const surface = surfacePointAt(x, z);
      if (!surface || surface.y < -1.6) continue;
      if (flattenRadius) {
        // Rigid structures (unlike trees/bushes) need a flat pad or they
        // float/clip like the buildings used to — same fix as tiles.
        flattenSpots([{ x, z, radius: flattenRadius, y: surface.y }]);
      }
      const seed = Math.floor(Math.random() * 1e6);
      const obj = build(seed);
      obj.position.copy(surface);
      obj.rotation.y = Math.random() * Math.PI * 2;
      decorGroup.add(obj);
      occupied.push({ x, z, r: minDist });
      placed++;
      if (onPlace) onPlace(obj, seed);
    }
  }

  // Sparse, larger-footprint decorative landmarks go first, while the
  // island is still empty — otherwise by the time ~125 trees/bushes/rocks
  // already dot the island, a spot 1.6 units from all of them is nearly
  // impossible to find within a handful of attempts and the landmark
  // silently fails to place. Pure atmosphere: no click handler, no tie to
  // any project.
  scatterRandom(1, buildTavern, 1.6, (obj) => cozyBuildings.push(obj), 1.1);
  scatterRandom(2, buildWell, 0.9, null, 0.55);
  scatterRandom(1, buildWindmill, 1.4, (obj) => windmills.push(obj), 0.75);

  scatterRandom(48, buildTree, 0.5);
  scatterRandom(34, buildBush, 0.3);
  scatterRandom(20, buildRock, 0.4);
  scatterRandom(24, buildFlowerPatch, 0.25);

  for (let li = 0; li < LAKES.length; li++) {
    const lake = LAKES[li];
    const dock = buildDock(lake, li);
    decorGroup.add(dock);
    if (dock.userData.lantern) lanterns.push(dock.userData.lantern);
    if (dock.userData.boat) {
      boats.push({ obj: dock.userData.boat, lake, cx: dock.userData.boatOffset.cx, cz: dock.userData.boatOffset.cz });
    }
    spawnFish(lake, 3);
  }
}

// ---- a few birds circling the island for ambience ------------------------
const birds = [];
function buildBird() {
  const group = new THREE.Group();
  const mat = new THREE.MeshBasicMaterial({ color: 0x2b2620, side: THREE.DoubleSide });
  const wingL = new THREE.Mesh(new THREE.PlaneGeometry(0.14, 0.05), mat);
  wingL.position.x = -0.06;
  const wingR = new THREE.Mesh(new THREE.PlaneGeometry(0.14, 0.05), mat);
  wingR.position.x = 0.06;
  group.add(wingL, wingR);
  group.userData.wingL = wingL;
  group.userData.wingR = wingR;
  return group;
}
for (let i = 0; i < 5; i++) {
  const bird = buildBird();
  scene.add(bird);
  birds.push({
    obj: bird,
    radius: ISLAND_RADIUS * (0.6 + Math.random() * 0.5),
    height: 3.5 + Math.random() * 1.5,
    speed: 0.15 + Math.random() * 0.1,
    phase: Math.random() * Math.PI * 2,
  });
}

// ---- realm log sidebar + toasts ------------------------------------------
function relativeTime(ts) {
  if (!ts) return '';
  const diff = Math.max(0, Date.now() - ts);
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function renderSidebar() {
  sidebarList.innerHTML = '';
  const sorted = [...projects].sort((a, b) => (b.active - a.active) || (lastChange.get(b.path) || 0) - (lastChange.get(a.path) || 0));
  for (const project of sorted) {
    const li = document.createElement('li');
    li.className = project.active ? 'active' : '';
    const dot = document.createElement('span');
    dot.className = 'dot';
    const name = document.createElement('span');
    name.className = 'name';
    name.textContent = project.name;
    const when = document.createElement('span');
    when.className = 'when';
    when.textContent = project.active ? 'building' : relativeTime(lastChange.get(project.path));
    li.append(dot, name, when);
    li.addEventListener('click', () => window.agentColony.launchAgent(project.path));
    sidebarList.appendChild(li);
  }
  const buildingN = projects.filter((p) => p.active).length;
  if (buildingN > 0) {
    buildingCountEl.hidden = false;
    buildingCountEl.textContent = `${buildingN} Building`;
  } else {
    buildingCountEl.hidden = true;
  }
}

function showToast(text) {
  const el = document.createElement('div');
  el.className = 'toast';
  el.textContent = text;
  toastHost.appendChild(el);
  setTimeout(() => {
    el.classList.add('leaving');
    setTimeout(() => el.remove(), 450);
  }, 3800);
}

// ---- selection ring + camera focus ---------------------------------------
const selectionRing = new THREE.Mesh(
  new THREE.RingGeometry(0.55, 0.62, 32),
  new THREE.MeshBasicMaterial({ color: 0xffb347, transparent: true, opacity: 0.85, side: THREE.DoubleSide })
);
selectionRing.rotation.x = -Math.PI / 2;
selectionRing.visible = false;
islandGroup.add(selectionRing);

let selectedKey = null;
let cameraTween = null;

function focusCameraOn(worldPos, radius) {
  const dir = camera.position.clone().sub(controls.target).normalize();
  const dist = Math.max(radius * 3.2, 3.2);
  cameraTween = {
    startPos: camera.position.clone(),
    startTarget: controls.target.clone(),
    endPos: worldPos.clone().addScaledVector(dir, dist).add(new THREE.Vector3(0, radius * 0.6, 0)),
    endTarget: worldPos.clone().add(new THREE.Vector3(0, radius * 0.5, 0)),
    t0: performance.now(),
    duration: 650,
  };
}

function updateCameraTween() {
  if (!cameraTween) return;
  const t = Math.min(1, (performance.now() - cameraTween.t0) / cameraTween.duration);
  const eased = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
  camera.position.lerpVectors(cameraTween.startPos, cameraTween.endPos, eased);
  controls.target.lerpVectors(cameraTween.startTarget, cameraTween.endTarget, eased);
  if (t >= 1) cameraTween = null;
}

function selectTile(key) {
  selectedKey = key;
  if (!key) {
    actionPanel.hidden = true;
    selectionRing.visible = false;
    renderLabels();
    return;
  }

  if (key === KEEP_KEY) {
    const building = projects.filter((p) => p.active).length;
    selectionRing.position.set(keepGroup.position.x, keepGroup.position.y + 0.02, keepGroup.position.z);
    selectionRing.visible = true;
    apTitle.textContent = 'The Great Keep';
    apStatus.textContent = `${projects.length} realm${projects.length === 1 ? '' : 's'} · ${building} building`;
    apLaunch.hidden = true;
    apRemove.hidden = true;
    actionPanel.hidden = false;
    focusCameraOn(keepGroup.position, 1.3);
    renderLabels();
    return;
  }

  const tile = tiles.get(key);
  if (!tile) return;
  selectionRing.position.set(tile.group.position.x, tile.group.position.y + 0.02, tile.group.position.z);
  selectionRing.visible = true;
  apTitle.textContent = tile.project.name;
  apStatus.textContent = tile.project.active ? 'A villager is building here' : 'Idle';
  apLaunch.hidden = false;
  apRemove.hidden = false;
  actionPanel.hidden = false;
  focusCameraOn(tile.group.position, 0.7);
  renderLabels();
}

apLaunch.addEventListener('click', () => {
  if (selectedKey && selectedKey !== KEEP_KEY) window.agentColony.launchAgent(selectedKey);
});
apRemove.addEventListener('click', async () => {
  const tile = tiles.get(selectedKey);
  if (tile && confirm(`Abandon "${tile.project.name}"? It stays removed from the realm only — your files are untouched.`)) {
    await window.agentColony.removeProject(selectedKey);
    selectTile(null);
    refreshProjects();
  }
});
apCancel.addEventListener('click', () => selectTile(null));
window.addEventListener('keydown', (evt) => { if (evt.key === 'Escape') selectTile(null); });

// ---- nameplate labels (HTML overlay tracking 3D positions) --------------
const labelEls = new Map(); // key -> div
function renderLabels() {
  const seen = new Set();
  const addLabel = (key, name, worldPos, height) => {
    seen.add(key);
    let el = labelEls.get(key);
    if (!el) {
      el = document.createElement('div');
      el.className = 'building-label';
      labelHost.appendChild(el);
      labelEls.set(key, el);
    }
    const p = worldPos.clone();
    p.y += height + 0.18;
    p.project(camera);
    if (p.z > 1) { el.classList.add('dim'); return; }
    const x = (p.x * 0.5 + 0.5) * wrap.clientWidth;
    const y = (-p.y * 0.5 + 0.5) * wrap.clientHeight;
    el.style.left = `${x}px`;
    el.style.top = `${y}px`;
    el.textContent = name;
    el.classList.remove('dim');
    el.classList.toggle('selected', selectedKey === key);
    el.classList.toggle('hovered', hoveredKey === key);
  };

  for (const [key, tile] of tiles) {
    addLabel(key, tile.project.name, tile.group.position, (tile.building.userData.height || 1) + 0.1);
  }
  addLabel(KEEP_KEY, 'The Great Keep', keepGroup.position, 1.9);

  for (const [key, el] of labelEls) {
    if (!seen.has(key)) { el.remove(); labelEls.delete(key); }
  }
}

// ---- interaction ----------------------------------------------------
const pointer = new THREE.Vector2();
let downPos = null;
let hoveredKey = null;

function updatePointer(evt) {
  const rect = renderer.domElement.getBoundingClientRect();
  pointer.x = ((evt.clientX - rect.left) / rect.width) * 2 - 1;
  pointer.y = -((evt.clientY - rect.top) / rect.height) * 2 + 1;
}

function pickTileKey() {
  raycaster.setFromCamera(pointer, camera);
  const hits = raycaster.intersectObjects(clickables, false);
  return hits.length ? hits[0].object.userData.tileKey : null;
}

renderer.domElement.addEventListener('pointerdown', (evt) => {
  downPos = { x: evt.clientX, y: evt.clientY };
});

renderer.domElement.addEventListener('pointerup', (evt) => {
  if (!downPos) return;
  const moved = Math.hypot(evt.clientX - downPos.x, evt.clientY - downPos.y);
  downPos = null;
  if (moved > 6) return;
  if (evt.button === 2) return;

  updatePointer(evt);
  const key = pickTileKey();

  if (!key) {
    selectTile(null);
    return;
  }
  if (key === ADD_SLOT_KEY) {
    window.agentColony.addProject().then(refreshProjects);
    return;
  }
  selectTile(key);
});

renderer.domElement.addEventListener('contextmenu', (evt) => evt.preventDefault());

renderer.domElement.addEventListener('pointermove', (evt) => {
  updatePointer(evt);
  const key = pickTileKey();
  hoveredKey = key;
  renderer.domElement.style.cursor = key ? 'pointer' : 'grab';
});

// ---- data -------------------------------------------------------------
async function refreshProjects() {
  projects = await window.agentColony.listProjects();

  for (const project of projects) {
    const wasActive = prevActive.get(project.path);
    if (wasActive !== undefined && wasActive !== project.active) {
      lastChange.set(project.path, Date.now());
      showToast(`${project.name} — ${project.active ? 'session started' : 'session ended'}, just now`);
    } else if (wasActive === undefined) {
      lastChange.set(project.path, Date.now());
    }
    prevActive.set(project.path, project.active);
  }

  emptyMsg.hidden = true;
  rebuildScene();
  renderSidebar();
}
window.agentColony.onStatus(refreshProjects);

// ---- animation loop -----------------------------------------------------
const clock = new THREE.Clock();
let lastDayCycleUpdate = 0;
let lastSidebarTick = 0;
let lastFrameMs = performance.now();

function animate() {
  requestAnimationFrame(animate);
  const t = clock.getElapsedTime();
  const now = performance.now();
  const dtSec = Math.min((now - lastFrameMs) / 1000, 0.1);
  lastFrameMs = now;

  updateWanderers(t, dtSec);

  if (now - lastDayCycleUpdate > 2000) {
    applyDayCycle();
    lastDayCycleUpdate = now;
  }
  if (now - lastSidebarTick > 15000) {
    renderSidebar(); // refresh "Xm ago" labels
    lastSidebarTick = now;
  }

  for (const tile of tiles.values()) {
    const active = tile.project.active;
    const mat = tile.building.userData.windowMat;
    mat.emissive.set(active ? HEARTH_GLOW : 0x000000);
    mat.emissiveIntensity = active ? 0.9 + Math.sin(t * 3) * 0.1 : 0;
    tile.torch.intensity = nightFactor * (active ? 0.55 : 0.3) * (0.85 + Math.sin(t * 5 + tile.walkPhase) * 0.15);

    const flag = tile.building.userData.flag;
    if (flag) flag.rotation.y = Math.sin(t * 2.4 + tile.walkPhase) * 0.35;

    const { legL, legR, armL, armR, tool } = tile.person.userData;
    const phase = tile.walkPhase;
    tool.visible = active;

    if (active) {
      tile.person.position.x = 0.5 + Math.cos(t * 1.1 + phase) * 0.28;
      tile.person.position.z = 0.3 + Math.sin(t * 1.1 + phase) * 0.28;
      tile.person.rotation.y = -(t * 1.1 + phase) + Math.PI / 2;

      const swing = Math.sin(t * 7 + phase) * 0.55;
      legL.rotation.x = swing;
      legR.rotation.x = -swing;
      armL.rotation.x = -swing * 0.8;
      armR.rotation.x = swing * 0.8 - 0.4;
      tile.person.position.y = Math.abs(Math.sin(t * 7 + phase)) * 0.03;
    } else {
      legL.rotation.x = 0;
      legR.rotation.x = 0;
      armL.rotation.x = Math.sin(t * 1.2 + phase) * 0.05;
      armR.rotation.x = -Math.sin(t * 1.2 + phase) * 0.05;
      tile.person.position.y = Math.sin(t * 1.2 + phase) * 0.015;
    }
  }

  if (keepGroup.userData.flag) keepGroup.userData.flag.rotation.y = Math.sin(t * 2) * 0.3;

  for (const b of birds) {
    const angle = t * b.speed + b.phase;
    b.obj.position.set(Math.cos(angle) * b.radius, b.height + Math.sin(t * 0.5 + b.phase) * 0.3, Math.sin(angle) * b.radius);
    b.obj.rotation.y = -angle + Math.PI / 2;
    const flap = Math.sin(t * 10 + b.phase) * 0.7;
    b.obj.userData.wingL.rotation.z = flap;
    b.obj.userData.wingR.rotation.z = -flap;
  }

  for (const mill of windmills) mill.userData.hub.rotation.z = t * 0.6;
  for (const cozy of cozyBuildings) {
    const mat = cozy.userData.windowMat;
    if (mat) mat.emissiveIntensity = 0.15 + nightFactor * (0.55 + Math.sin(t * 3) * 0.1);
  }
  for (const lantern of lanterns) {
    lantern.emissiveIntensity = 0.2 + nightFactor * (0.7 + Math.sin(t * 4) * 0.15);
  }
  updateWater(t);
  updateBoats(t);
  updateFish(t, dtSec);
  updateRipples(now);
  maybeSpawnRipple(now);

  updateCameraTween();
  renderLabels();
  controls.update();
  renderer.render(scene, camera);
}

resize();
applyDayCycle();
refreshProjects().then(() => {
  generateDecor();
  spawnWanderers(8);
  animate();
});
