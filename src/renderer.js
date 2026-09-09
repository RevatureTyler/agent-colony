import * as THREE from 'three';
import { OrbitControls } from '../node_modules/three/examples/jsm/controls/OrbitControls.js';

window.addEventListener('error', (e) => console.error('[scene]', e.message, e.filename, e.lineno));
window.addEventListener('unhandledrejection', (e) => console.error('[scene]', e.reason));

// ---------------------------------------------------------------------
// A small floating "island planet". Projects scatter organically across
// the top surface as little buildings with a resident character each.
// Scroll to zoom, drag to orbit; click a building to launch, right-click
// to remove.
// ---------------------------------------------------------------------

const wrap = document.getElementById('scene-wrap');
const emptyMsg = document.getElementById('empty');

const ISLAND_RADIUS = 6;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x070a12);
scene.fog = new THREE.FogExp2(0x070a12, 0.028);

const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 200);
camera.position.set(9, 8, 11);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
wrap.appendChild(renderer.domElement);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.08;
controls.enablePan = false;
controls.minDistance = 6;
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

// ---- lighting -------------------------------------------------------
scene.add(new THREE.AmbientLight(0x8fa5ff, 0.55));
const sun = new THREE.DirectionalLight(0xfff2d6, 1.1);
sun.position.set(8, 14, 6);
scene.add(sun);
const rim = new THREE.PointLight(0x5470ff, 0.8, 40);
rim.position.set(-8, 6, -8);
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

// ---- organic island terrain --------------------------------------------
function buildIsland() {
  const group = new THREE.Group();

  const geo = new THREE.IcosahedronGeometry(ISLAND_RADIUS, 4);
  const pos = geo.attributes.position;
  const colors = new Float32Array(pos.count * 3);
  const top = new THREE.Color(0x3f8f5c);
  const mid = new THREE.Color(0x2f6b46);
  const rock = new THREE.Color(0x4b4438);

  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    const len = Math.hypot(x, y, z);
    const nx = x / len, ny = y / len, nz = z / len;

    // flatten into a lens/island shape rather than a full sphere
    const flatten = 0.34 + 0.1 * Math.max(ny, 0);
    let py = ny * ISLAND_RADIUS * flatten;

    // organic bumps via layered sine noise (keeps us dependency-free)
    const bump =
      Math.sin(nx * 5.2 + nz * 3.1) * 0.35 +
      Math.sin(nx * 9.7 - nz * 6.3 + 1.7) * 0.16 +
      Math.sin(nz * 13.1 + nx * 2.4) * 0.08;
    const bumpAmount = ny > 0.05 ? bump * 0.9 : bump * 0.15; // calmer underside
    py += bumpAmount;

    pos.setXYZ(i, x * (0.9 + 0.05 * Math.sin(nz * 4)), py, z * (0.9 + 0.05 * Math.cos(nx * 4)));

    const c = ny > 0.15 ? top.clone().lerp(mid, Math.random() * 0.4) : rock.clone().lerp(mid, 0.2);
    colors[i * 3] = c.r;
    colors[i * 3 + 1] = c.g;
    colors[i * 3 + 2] = c.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geo.computeVertexNormals();

  const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, flatShading: true });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.name = 'islandSurface';
  group.add(mesh);

  // soft underglow so the island reads as floating
  const glowGeo = new THREE.CircleGeometry(ISLAND_RADIUS * 1.3, 32);
  const glowMat = new THREE.MeshBasicMaterial({ color: 0x3d5aff, transparent: true, opacity: 0.12 });
  const glow = new THREE.Mesh(glowGeo, glowMat);
  glow.rotation.x = -Math.PI / 2;
  glow.position.y = -ISLAND_RADIUS * 0.5;
  group.add(glow);

  return { group, mesh };
}

const { group: islandGroup, mesh: islandMesh } = buildIsland();
scene.add(islandGroup);

const raycaster = new THREE.Raycaster();
function surfacePointAt(x, z) {
  raycaster.set(new THREE.Vector3(x, ISLAND_RADIUS * 2, z), new THREE.Vector3(0, -1, 0));
  const hit = raycaster.intersectObject(islandMesh, false)[0];
  return hit ? hit.point : null;
}

// ---- organic scatter (sunflower / phyllotaxis layout) -------------------
const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));
function scatterPoint(index, totalGuess) {
  const spread = ISLAND_RADIUS * 0.72;
  const r = spread * Math.sqrt((index + 0.5) / Math.max(totalGuess, 6));
  const theta = index * GOLDEN_ANGLE;
  return { x: r * Math.cos(theta), z: r * Math.sin(theta) };
}

// ---- building + character construction ----------------------------------
function seedFrom(str) {
  let h = 0;
  for (const ch of str) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return h;
}

const PALETTE = [0x7dd3fc, 0xfca5a5, 0xfcd34d, 0xa5b4fc, 0x86efac, 0xf0abfc];

function buildBuilding(seed) {
  const group = new THREE.Group();
  const hue = PALETTE[seed % PALETTE.length];
  const height = 0.9 + ((seed >> 3) % 10) / 10;
  const width = 0.55 + ((seed >> 6) % 5) / 20;

  const body = new THREE.Mesh(
    new THREE.BoxGeometry(width, height, width),
    new THREE.MeshStandardMaterial({ color: hue, roughness: 0.6, flatShading: true })
  );
  body.position.y = height / 2;
  group.add(body);

  const roofHeight = 0.35 + ((seed >> 9) % 4) / 10;
  const roof = new THREE.Mesh(
    new THREE.ConeGeometry(width * 0.85, roofHeight, 4),
    new THREE.MeshStandardMaterial({ color: 0xe8ecf5, roughness: 0.5, flatShading: true })
  );
  roof.rotation.y = Math.PI / 4;
  roof.position.y = height + roofHeight / 2;
  group.add(roof);

  group.userData.windowMat = new THREE.MeshStandardMaterial({
    color: 0x1c4a30,
    emissive: 0x000000,
    emissiveIntensity: 0,
  });
  const win = new THREE.Mesh(new THREE.PlaneGeometry(width * 0.3, width * 0.3), group.userData.windowMat);
  win.position.set(0, height * 0.6, width / 2 + 0.01);
  group.add(win);

  group.userData.height = height + roofHeight;
  return group;
}

function buildCharacter(active) {
  const group = new THREE.Group();
  const body = new THREE.Mesh(
    new THREE.SphereGeometry(0.16, 10, 10),
    new THREE.MeshStandardMaterial({ color: 0xffe08a, roughness: 0.5 })
  );
  group.add(body);
  const eyeMat = new THREE.MeshStandardMaterial({ color: 0x20242f });
  for (const dx of [-0.06, 0.06]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.025, 6, 6), eyeMat);
    eye.position.set(dx, 0.02, 0.14);
    group.add(eye);
  }
  return group;
}

// ---- scene graph for projects -------------------------------------------
const tiles = new Map(); // path -> { group, building, character, walkPhase, hitMesh }
const ADD_SLOT_KEY = '__add__';
let hoveredHit = null;

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
    const plus = new THREE.Mesh(
      new THREE.BoxGeometry(0.3, 0.06, 0.06),
      new THREE.MeshStandardMaterial({ color: 0xe8ecf5 })
    );
    plus.position.y = 0.15;
    const plus2 = plus.clone();
    plus2.rotation.y = Math.PI / 2;
    group.add(plus, plus2);
    hitMesh = pad;
  } else {
    const seed = seedFrom(project.name);
    const building = buildBuilding(seed);
    group.add(building);
    const character = buildCharacter(project.active);
    character.position.set(0.5, 0, 0.3);
    group.add(character);

    hitMesh = building.children[0];
    tiles.set(key, { group, building, character, walkPhase: Math.random() * Math.PI * 2, hitMesh, project });
  }

  hitMesh.userData.tileKey = key;
  return hitMesh;
}

let projects = [];
const clickables = [];

function rebuildScene() {
  for (const [key] of tiles) clearTile(key);
  while (islandGroup.children.length > 2) islandGroup.remove(islandGroup.children[islandGroup.children.length - 1]);
  clickables.length = 0;

  const total = projects.length + 1;
  projects.forEach((project, i) => {
    const hit = placeTile(project.path, i, total, false, project);
    clickables.push(hit);
  });
  const addHit = placeTile(ADD_SLOT_KEY, projects.length, total, true, null);
  clickables.push(addHit);
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
  if (moved > 6) return; // treat as a drag/orbit, not a click

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
  hoveredHit = key;
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

    const phase = tile.walkPhase;
    if (active) {
      tile.character.position.x = 0.5 + Math.cos(t * 1.4 + phase) * 0.25;
      tile.character.position.z = 0.3 + Math.sin(t * 1.4 + phase) * 0.25;
      tile.character.position.y = Math.abs(Math.sin(t * 6 + phase)) * 0.05;
      tile.character.rotation.y = t * 1.4 + phase;
    } else {
      tile.character.position.y = Math.sin(t * 1.2 + phase) * 0.02;
    }
  }

  controls.update();
  renderer.render(scene, camera);
}

resize();
refreshProjects().then(animate);
