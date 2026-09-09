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

const ISLAND_RADIUS = 6;
const LAKES = [
  { x: 2.3, z: -1.6, radius: 1.05 },
  { x: -2.7, z: 1.9, radius: 0.78 },
];

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 200);
camera.position.set(9, 8, 11);

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
controls.maxDistance = 32;
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

    // Soft-cap ny before it drives height: without this the island is a
    // dome that peaks steeply at dead-center, so anything placed there
    // (the Keep) sits atop a small mountain and the ground falls away
    // fast just past it — no amount of *local* flattening fixes that,
    // since the surrounding terrain a couple units out is genuinely much
    // lower. Capping keeps the whole village area (out to the usual
    // building-scatter radius) a gentle plateau; the coastline still
    // slopes down normally since only high ny is affected.
    const nyClamped = Math.max(ny, 0);
    const nyForFlatten = nyClamped <= 0.5 ? nyClamped : 0.5 + (nyClamped - 0.5) * 0.12;
    const flatten = 0.3 + 0.12 * nyForFlatten;
    let px = x * (0.86 + 0.09 * Math.sin(nz * 3.4 + 1.2));
    let pz = z * (0.86 + 0.09 * Math.cos(nx * 3.7));
    let py = ny * ISLAND_RADIUS * flatten;
    const bump = heightNoise(nx, ny, nz);
    py += ny > 0.05 ? bump * 0.5 : bump * 0.12;

    let inLake = false;
    if (ny > 0) {
      for (const lake of LAKES) {
        const d = Math.hypot(px - lake.x, pz - lake.z);
        if (d < lake.radius) {
          const dip = 1 - d / lake.radius;
          py -= dip * dip * 0.55;
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

  for (const lake of LAKES) {
    const y = raycastHeight(mesh, lake.x, lake.z) - 0.1;
    const waterMat = new THREE.MeshStandardMaterial({
      color: 0x3d7ea6, transparent: true, opacity: 0.78, roughness: 0.12, metalness: 0.15,
    });
    const surface = new THREE.Mesh(new THREE.CircleGeometry(lake.radius * 0.8, 24), waterMat);
    surface.rotation.x = -Math.PI / 2;
    surface.position.set(lake.x, y, lake.z);
    group.add(surface);
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

  function scatterRandom(count, build, minDist) {
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
      const seed = Math.floor(Math.random() * 1e6);
      const obj = build(seed);
      obj.position.copy(surface);
      obj.rotation.y = Math.random() * Math.PI * 2;
      decorGroup.add(obj);
      occupied.push({ x, z, r: minDist });
      placed++;
    }
  }

  scatterRandom(22, buildTree, 0.5);
  scatterRandom(16, buildBush, 0.3);
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

function animate() {
  requestAnimationFrame(animate);
  const t = clock.getElapsedTime();
  const now = performance.now();

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

  updateCameraTween();
  renderLabels();
  controls.update();
  renderer.render(scene, camera);
}

resize();
applyDayCycle();
refreshProjects().then(() => {
  generateDecor();
  animate();
});
