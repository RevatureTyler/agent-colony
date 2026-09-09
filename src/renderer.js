import * as THREE from 'three';
import { OrbitControls } from '../node_modules/three/examples/jsm/controls/OrbitControls.js';

window.addEventListener('error', (e) => console.error('[scene]', e.message, e.filename, e.lineno));
window.addEventListener('unhandledrejection', (e) => console.error('[scene]', e.reason));

// ---------------------------------------------------------------------
// A small floating island: organic multi-band terrain with carved lakes,
// scattered trees/bushes, varied buildings, and jointed low-poly people.
// Scroll to zoom, drag to orbit; click a building to launch, right-click
// to remove.
// ---------------------------------------------------------------------

const wrap = document.getElementById('scene-wrap');
const emptyMsg = document.getElementById('empty');

const ISLAND_RADIUS = 6;
const LAKES = [
  { x: 2.3, z: -1.6, radius: 1.05 },
  { x: -2.7, z: 1.9, radius: 0.78 },
];

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0b0f1a);
scene.fog = new THREE.FogExp2(0x241f36, 0.022);

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

// ---- lighting: golden-hour mood with soft shadows ------------------------
scene.add(new THREE.HemisphereLight(0x8fa5ff, 0x2f6b46, 0.7));
const sun = new THREE.DirectionalLight(0xffd9a0, 1.3);
sun.position.set(9, 7, 4);
sun.castShadow = true;
sun.shadow.mapSize.set(1024, 1024);
sun.shadow.camera.left = -8;
sun.shadow.camera.right = 8;
sun.shadow.camera.top = 8;
sun.shadow.camera.bottom = -8;
sun.shadow.camera.near = 1;
sun.shadow.camera.far = 26;
scene.add(sun);
const rim = new THREE.PointLight(0x5470ff, 0.45, 30);
rim.position.set(-8, 5, -8);
scene.add(rim);

// ---- starfield --------------------------------------------------------
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
  const starMat = new THREE.PointsMaterial({ color: 0xffffff, size: 0.35, sizeAttenuation: true });
  scene.add(new THREE.Points(starGeo, starMat));
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
  const sand = new THREE.Color(0xd8c48a);
  const grassA = new THREE.Color(0x4a9963);
  const grassB = new THREE.Color(0x2f6b46);
  const rock = new THREE.Color(0x59503f);
  const water = new THREE.Color(0x2a4d63);

  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
    const len = Math.hypot(x, y, z);
    const nx = x / len, ny = y / len, nz = z / len;

    const flatten = 0.3 + 0.12 * Math.max(ny, 0);
    let px = x * (0.86 + 0.09 * Math.sin(nz * 3.4 + 1.2));
    let pz = z * (0.86 + 0.09 * Math.cos(nx * 3.7));
    let py = ny * ISLAND_RADIUS * flatten;
    const bump = heightNoise(nx, ny, nz);
    py += ny > 0.05 ? bump * 0.85 : bump * 0.12;

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
    new THREE.MeshBasicMaterial({ color: 0x3d5aff, transparent: true, opacity: 0.1 })
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

// ---- shared palettes ------------------------------------------------
const BODY_COLORS = [0x7dd3fc, 0xfca5a5, 0xfcd34d, 0xa5b4fc, 0x86efac, 0xf0abfc, 0xfdba74];
const TRIM_COLORS = [0xf5f7ff, 0xffe9c7, 0xdbeafe, 0xfde68a, 0xd1fae5];
const TREE_GREENS = [0x2f6b46, 0x3f8f5c, 0x336b3f, 0x4c7a3d];
const SKIN_TONES = [0xf2c9a1, 0xd8a273, 0xa9704f, 0x8d5a3c, 0xf7dcc0];
const HAIR_COLORS = [0x3a2a1e, 0x1c1c1c, 0x8a5a2b, 0xd9b45c, 0x6b3f2a, 0xe8e8e8];
const SHIRT_COLORS = [0x3d5aff, 0xef4444, 0x10b981, 0xf59e0b, 0x8b5cf6, 0x0ea5e9];
const PANTS_COLORS = [0x2b2f3a, 0x4b3621, 0x334155, 0x5c4033];

function seedFrom(str) {
  let h = 0;
  for (const ch of str) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return h;
}

// ---- building archetypes ------------------------------------------------
function buildBuilding(seed) {
  const group = new THREE.Group();
  const archetype = seed % 4;
  const bodyColor = BODY_COLORS[seed % BODY_COLORS.length];
  const trimColor = TRIM_COLORS[(seed >> 4) % TRIM_COLORS.length];
  const height = 0.8 + ((seed >> 3) % 10) / 12;
  const width = 0.5 + ((seed >> 6) % 5) / 22;
  const bodyMat = new THREE.MeshStandardMaterial({ color: bodyColor, roughness: 0.65, flatShading: true });
  const trimMat = new THREE.MeshStandardMaterial({ color: trimColor, roughness: 0.5, flatShading: true });

  let topY;
  if (archetype === 0) {
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
    const body = new THREE.Mesh(new THREE.CylinderGeometry(width * 0.42, width * 0.5, height * 1.3, 6), bodyMat);
    body.position.y = (height * 1.3) / 2;
    group.add(body);
    const roofH = 0.35;
    const roof = new THREE.Mesh(new THREE.ConeGeometry(width * 0.5, roofH, 6), trimMat);
    roof.position.y = height * 1.3 + roofH / 2;
    group.add(roof);
    const antenna = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.3, 4), trimMat);
    antenna.position.y = height * 1.3 + roofH + 0.15;
    group.add(antenna);
    topY = height * 1.3 + roofH + 0.3;
  } else if (archetype === 2) {
    const body = new THREE.Mesh(new THREE.BoxGeometry(width * 1.1, height * 0.7, width * 1.1), bodyMat);
    body.position.y = (height * 0.7) / 2;
    group.add(body);
    const dome = new THREE.Mesh(
      new THREE.SphereGeometry(width * 0.55, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2),
      trimMat
    );
    dome.position.y = height * 0.7;
    group.add(dome);
    topY = height * 0.7 + width * 0.55;
  } else {
    const body = new THREE.Mesh(new THREE.BoxGeometry(width, height * 0.9, width), bodyMat);
    body.position.y = (height * 0.9) / 2;
    group.add(body);
    const parapet = new THREE.Mesh(new THREE.BoxGeometry(width * 1.05, 0.06, width * 1.05), trimMat);
    parapet.position.y = height * 0.9 + 0.03;
    group.add(parapet);
    const vent = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.12, 8), trimMat);
    vent.position.set(width * 0.2, height * 0.9 + 0.12, width * 0.2);
    group.add(vent);
    topY = height * 0.9 + 0.2;
  }

  const winMat = new THREE.MeshStandardMaterial({ color: 0x1c4a30, emissive: 0x000000, emissiveIntensity: 0 });
  const win = new THREE.Mesh(new THREE.PlaneGeometry(width * 0.25, width * 0.25), winMat);
  win.position.set(0, height * 0.4, width / 2 + 0.01);
  group.add(win);

  group.userData.windowMat = winMat;
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

// ---- jointed low-poly person -------------------------------------------
function buildPerson(seed) {
  const group = new THREE.Group();
  const skin = SKIN_TONES[seed % SKIN_TONES.length];
  const shirt = SHIRT_COLORS[(seed >> 2) % SHIRT_COLORS.length];
  const pants = PANTS_COLORS[(seed >> 4) % PANTS_COLORS.length];
  const hair = HAIR_COLORS[(seed >> 6) % HAIR_COLORS.length];

  const hipY = 0.16;
  const legLen = 0.16;
  const torsoH = 0.18;

  const legMat = new THREE.MeshStandardMaterial({ color: pants, roughness: 0.7 });
  const legGeo = new THREE.CapsuleGeometry(0.035, legLen, 4, 6);
  function makeLeg(xOff) {
    const pivot = new THREE.Group();
    const mesh = new THREE.Mesh(legGeo, legMat);
    mesh.position.y = -legLen / 2;
    pivot.add(mesh);
    pivot.position.set(xOff, hipY, 0);
    return pivot;
  }
  const legL = makeLeg(-0.045);
  const legR = makeLeg(0.045);
  group.add(legL, legR);

  const torso = new THREE.Mesh(
    new THREE.CapsuleGeometry(0.07, torsoH, 4, 8),
    new THREE.MeshStandardMaterial({ color: shirt, roughness: 0.6 })
  );
  const shoulderY = hipY + legLen + torsoH * 0.85;
  torso.position.y = hipY + legLen + torsoH / 2;
  group.add(torso);

  const armMat = new THREE.MeshStandardMaterial({ color: skin, roughness: 0.7 });
  const armGeo = new THREE.CapsuleGeometry(0.028, 0.16, 4, 6);
  function makeArm(xOff) {
    const pivot = new THREE.Group();
    const mesh = new THREE.Mesh(armGeo, armMat);
    mesh.position.y = -0.08;
    pivot.add(mesh);
    pivot.position.set(xOff, shoulderY, 0);
    return pivot;
  }
  const armL = makeArm(-0.11);
  const armR = makeArm(0.11);
  group.add(armL, armR);

  const head = new THREE.Mesh(
    new THREE.SphereGeometry(0.07, 10, 10),
    new THREE.MeshStandardMaterial({ color: skin, roughness: 0.6 })
  );
  head.position.y = shoulderY + 0.12;
  group.add(head);

  const hairMesh = new THREE.Mesh(
    new THREE.SphereGeometry(0.074, 10, 10, 0, Math.PI * 2, 0, Math.PI * 0.55),
    new THREE.MeshStandardMaterial({ color: hair, roughness: 0.85 })
  );
  hairMesh.position.y = head.position.y + 0.012;
  group.add(hairMesh);

  group.userData.legL = legL;
  group.userData.legR = legR;
  group.userData.armL = armL;
  group.userData.armR = armR;
  group.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  return group;
}

// ---- scene graph for projects -------------------------------------------
const tiles = new Map(); // path -> { group, building, person, walkPhase, hitMesh, project }
const ADD_SLOT_KEY = '__add__';

function clearTile(path) {
  const tile = tiles.get(path);
  if (!tile) return;
  islandGroup.remove(tile.group);
  tiles.delete(path);
}

function placeTile(key, index, totalGuess, isAddSlot, project) {
  const { x, z } = scatterPoint(index, totalGuess);
  const surface = surfacePointAt(x, z) || new THREE.Vector3(x, 0, z);

  const group = new THREE.Group();
  group.position.copy(surface);
  islandGroup.add(group);

  let hitMesh;
  if (isAddSlot) {
    const pad = new THREE.Mesh(
      new THREE.CylinderGeometry(0.4, 0.4, 0.08, 16),
      new THREE.MeshStandardMaterial({ color: 0x6c7a99, transparent: true, opacity: 0.5, emissive: 0x3d5aff, emissiveIntensity: 0.3 })
    );
    pad.position.y = 0.04;
    group.add(pad);
    const plus = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.06, 0.06), new THREE.MeshStandardMaterial({ color: 0xe8ecf5 }));
    plus.position.y = 0.15;
    const plus2 = plus.clone();
    plus2.rotation.y = Math.PI / 2;
    group.add(plus, plus2);
    hitMesh = pad;
  } else {
    const seed = seedFrom(project.name);
    const building = buildBuilding(seed);
    group.add(building);
    const person = buildPerson(seed >>> 3);
    person.position.set(0.5, 0, 0.3);
    group.add(person);

    hitMesh = building.children[0];
    tiles.set(key, { group, building, person, walkPhase: Math.random() * Math.PI * 2, hitMesh, project });
  }

  hitMesh.userData.tileKey = key;
  return hitMesh;
}

let projects = [];
const clickables = [];

function rebuildScene() {
  for (const [key] of tiles) clearTile(key);
  while (islandGroup.children.length > 2 + LAKES.length) {
    islandGroup.remove(islandGroup.children[islandGroup.children.length - 1]);
  }
  clickables.length = 0;

  const total = projects.length + 1;
  projects.forEach((project, i) => {
    const hit = placeTile(project.path, i, total, false, project);
    clickables.push(hit);
  });
  const addHit = placeTile(ADD_SLOT_KEY, projects.length, total, true, null);
  clickables.push(addHit);
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
      islandGroup.add(obj);
      occupied.push({ x, z, r: minDist });
      placed++;
    }
  }

  scatterRandom(22, buildTree, 0.5);
  scatterRandom(16, buildBush, 0.3);
}

// ---- interaction ----------------------------------------------------
const pointer = new THREE.Vector2();
let downPos = null;

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

renderer.domElement.addEventListener('pointerup', async (evt) => {
  if (!downPos) return;
  const moved = Math.hypot(evt.clientX - downPos.x, evt.clientY - downPos.y);
  downPos = null;
  if (moved > 6) return;

  updatePointer(evt);
  const key = pickTileKey();
  if (!key) return;

  if (evt.button === 2) {
    if (key === ADD_SLOT_KEY) return;
    const tile = tiles.get(key);
    if (tile && confirm(`Remove "${tile.project.name}" from Agent Colony?`)) {
      await window.agentColony.removeProject(key);
      refreshProjects();
    }
    return;
  }

  if (key === ADD_SLOT_KEY) {
    await window.agentColony.addProject();
    refreshProjects();
  } else {
    window.agentColony.launchAgent(key);
  }
});

renderer.domElement.addEventListener('contextmenu', (evt) => evt.preventDefault());

renderer.domElement.addEventListener('pointermove', (evt) => {
  updatePointer(evt);
  const key = pickTileKey();
  renderer.domElement.style.cursor = key ? 'pointer' : 'grab';
});

// ---- data -------------------------------------------------------------
async function refreshProjects() {
  projects = await window.agentColony.listProjects();
  emptyMsg.hidden = true;
  rebuildScene();
}
window.agentColony.onStatus(refreshProjects);

// ---- animation loop -----------------------------------------------------
const clock = new THREE.Clock();
function animate() {
  requestAnimationFrame(animate);
  const t = clock.getElapsedTime();

  for (const tile of tiles.values()) {
    const active = tile.project.active;
    const mat = tile.building.userData.windowMat;
    mat.emissive.set(active ? 0x6ee89f : 0x000000);
    mat.emissiveIntensity = active ? 0.9 + Math.sin(t * 3) * 0.1 : 0;

    const { legL, legR, armL, armR } = tile.person.userData;
    const phase = tile.walkPhase;

    if (active) {
      tile.person.position.x = 0.5 + Math.cos(t * 1.1 + phase) * 0.28;
      tile.person.position.z = 0.3 + Math.sin(t * 1.1 + phase) * 0.28;
      tile.person.rotation.y = -(t * 1.1 + phase) + Math.PI / 2;

      const swing = Math.sin(t * 7 + phase) * 0.55;
      legL.rotation.x = swing;
      legR.rotation.x = -swing;
      armL.rotation.x = -swing * 0.8;
      armR.rotation.x = swing * 0.8;
      tile.person.position.y = Math.abs(Math.sin(t * 7 + phase)) * 0.03;
    } else {
      legL.rotation.x = 0;
      legR.rotation.x = 0;
      armL.rotation.x = Math.sin(t * 1.2 + phase) * 0.05;
      armR.rotation.x = -Math.sin(t * 1.2 + phase) * 0.05;
      tile.person.position.y = Math.sin(t * 1.2 + phase) * 0.015;
    }
  }

  controls.update();
  renderer.render(scene, camera);
}

resize();
refreshProjects().then(() => {
  generateDecor();
  animate();
});
