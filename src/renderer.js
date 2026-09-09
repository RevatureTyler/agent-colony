// --- Isometric hex-planet scene -------------------------------------------
// Each registered project becomes a hex tile arranged in rings around a
// center "hub", drawn as a small 3D-ish block with a building on top and a
// little character that idles or walks when a claude session is active.

const canvas = document.getElementById('scene');
const ctx = canvas.getContext('2d');
const emptyMsg = document.getElementById('empty');

const HEX_SIZE = 46; // center-to-corner radius, in world units
const SQUISH = 0.62; // vertical squash for the isometric look
const TILE_DEPTH = 16; // how "thick" each hex block looks

let projects = []; // [{ path, name, active }]
let tiles = []; // [{ project|null, cube:{x,y,z}, px, py, buildingSeed, walk }]
let hovered = null;
let stars = [];
let t = 0;

function resize() {
  canvas.width = canvas.clientWidth * devicePixelRatio;
  canvas.height = canvas.clientHeight * devicePixelRatio;
}
window.addEventListener('resize', resize);

// ---- hex cube-coordinate spiral (red-blob-games style) --------------------
const DIRS = [
  { x: 1, y: -1, z: 0 },
  { x: 1, y: 0, z: -1 },
  { x: 0, y: 1, z: -1 },
  { x: -1, y: 1, z: 0 },
  { x: -1, y: 0, z: 1 },
  { x: 0, y: -1, z: 1 },
];
const cubeAdd = (a, b) => ({ x: a.x + b.x, y: a.y + b.y, z: a.z + b.z });
const cubeScale = (a, k) => ({ x: a.x * k, y: a.y * k, z: a.z * k });

function spiral(count) {
  const results = [{ x: 0, y: 0, z: 0 }];
  let ring = 1;
  while (results.length < count) {
    let hex = cubeAdd({ x: 0, y: 0, z: 0 }, cubeScale(DIRS[4], ring));
    for (let side = 0; side < 6; side++) {
      for (let step = 0; step < ring; step++) {
        results.push(hex);
        hex = cubeAdd(hex, DIRS[side]);
      }
    }
    ring++;
  }
  return results.slice(0, count);
}

function cubeToPixel(cube) {
  const x = HEX_SIZE * 1.5 * cube.x;
  const y = HEX_SIZE * Math.sqrt(3) * (cube.z + cube.x / 2);
  return { x, y: y * SQUISH };
}

function seedFrom(str) {
  let h = 0;
  for (const ch of str) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return h;
}

function rebuildTiles() {
  const coords = spiral(Math.max(projects.length + 1, 7));
  tiles = coords.map((cube, i) => {
    const project = projects[i] || null;
    const p = cubeToPixel(cube);
    return {
      project,
      cube,
      px: p.x,
      py: p.y,
      isAddSlot: !project,
      buildingSeed: project ? seedFrom(project.name) : 0,
      walkPhase: Math.random() * Math.PI * 2,
    };
  });
}

function makeStars(n) {
  stars = Array.from({ length: n }, () => ({
    x: Math.random(),
    y: Math.random(),
    r: Math.random() * 1.4 + 0.3,
    phase: Math.random() * Math.PI * 2,
  }));
}
makeStars(140);

// ---- drawing ----------------------------------------------------------
function hexPoints(cx, cy, size) {
  const pts = [];
  for (let i = 0; i < 6; i++) {
    const angle = (Math.PI / 180) * (60 * i);
    pts.push([cx + size * Math.cos(angle), cy + size * Math.sin(angle) * SQUISH]);
  }
  return pts;
}

function drawHexPath(cx, cy, size) {
  const pts = hexPoints(cx, cy, size);
  ctx.beginPath();
  ctx.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
  ctx.closePath();
}

function drawTileBlock(cx, cy, topColor, sideColor, size) {
  // side (extruded) faces first, so the top face draws over the seam
  const pts = hexPoints(cx, cy, size);
  ctx.fillStyle = sideColor;
  for (let i = 0; i < 6; i++) {
    const [x1, y1] = pts[i];
    const [x2, y2] = pts[(i + 1) % 6];
    if (y1 < cy && y2 < cy) continue; // skip top-facing edges (back side)
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.lineTo(x2, y2 + TILE_DEPTH);
    ctx.lineTo(x1, y1 + TILE_DEPTH);
    ctx.closePath();
    ctx.fill();
  }
  drawHexPath(cx, cy, size);
  ctx.fillStyle = topColor;
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.12)';
  ctx.lineWidth = 1.5;
  ctx.stroke();
}

function drawBuilding(cx, cy, seed, active) {
  const rnd = (n) => ((seed >> n) & 0xff) / 255;
  const h = 18 + rnd(0) * 22;
  const w = 20 + rnd(8) * 10;
  const hueA = ['#7dd3fc', '#fca5a5', '#fcd34d', '#a5b4fc', '#86efac'][seed % 5];
  const hueB = ['#0ea5e9', '#ef4444', '#f59e0b', '#6366f1', '#22c55e'][seed % 5];

  const baseY = cy - 4;
  // body
  ctx.fillStyle = hueB;
  ctx.fillRect(cx - w / 2, baseY - h, w, h);
  ctx.fillStyle = hueA;
  ctx.fillRect(cx - w / 2, baseY - h, w * 0.5, h);
  // roof
  ctx.beginPath();
  ctx.moveTo(cx - w / 2 - 3, baseY - h);
  ctx.lineTo(cx + w / 2 + 3, baseY - h);
  ctx.lineTo(cx, baseY - h - 12);
  ctx.closePath();
  ctx.fillStyle = active ? '#6ee89f' : '#cbd5f5';
  ctx.fill();
  // window glow
  if (active) {
    ctx.fillStyle = 'rgba(110,232,159,0.85)';
    ctx.fillRect(cx - w / 4, baseY - h * 0.5, 4, 4);
    ctx.fillRect(cx + w / 8, baseY - h * 0.5, 4, 4);
  }
}

function drawCharacter(cx, cy, tile, active) {
  const bob = active ? Math.sin(t * 4 + tile.walkPhase) * 2 : Math.sin(t + tile.walkPhase) * 0.6;
  const walkX = active ? Math.cos(t * 1.6 + tile.walkPhase) * 16 : 0;
  const x = cx + walkX;
  const y = cy + 6 + bob;

  // shadow
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.beginPath();
  ctx.ellipse(x, cy + 8, 7, 2.5, 0, 0, Math.PI * 2);
  ctx.fill();

  // body
  ctx.fillStyle = active ? '#ffe08a' : '#c9d3e6';
  ctx.beginPath();
  ctx.arc(x, y, 6, 0, Math.PI * 2);
  ctx.fill();

  // face
  ctx.fillStyle = '#20242f';
  ctx.beginPath();
  ctx.arc(x - 2, y - 1, 1, 0, Math.PI * 2);
  ctx.arc(x + 2, y - 1, 1, 0, Math.PI * 2);
  ctx.fill();
  if (active) {
    ctx.strokeStyle = '#20242f';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(x, y + 1, 2, 0, Math.PI);
    ctx.stroke();
  }
}

function drawStars() {
  ctx.save();
  for (const s of stars) {
    const alpha = 0.4 + 0.6 * Math.abs(Math.sin(t * 0.8 + s.phase));
    ctx.fillStyle = `rgba(255,255,255,${alpha.toFixed(2)})`;
    ctx.beginPath();
    ctx.arc(s.x * canvas.width, s.y * canvas.height, s.r * devicePixelRatio, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function draw() {
  const w = canvas.width;
  const h = canvas.height;
  ctx.clearRect(0, 0, w, h);

  // space background
  ctx.fillStyle = '#070a12';
  ctx.fillRect(0, 0, w, h);
  drawStars();

  ctx.save();
  ctx.translate(w / 2, h / 2);
  ctx.scale(devicePixelRatio, devicePixelRatio);

  // planet glow behind the tiles
  const radius = HEX_SIZE * 1.5 * (Math.sqrt(tiles.length) + 2);
  const glow = ctx.createRadialGradient(0, 0, radius * 0.1, 0, 0, radius);
  glow.addColorStop(0, 'rgba(61,90,255,0.22)');
  glow.addColorStop(1, 'rgba(61,90,255,0)');
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(0, 0, radius, 0, Math.PI * 2);
  ctx.fill();

  // draw back-to-front by py so overlapping tiles look layered
  const ordered = [...tiles].sort((a, b) => a.py - b.py);
  for (const tile of ordered) {
    const isHover = hovered === tile;
    const size = HEX_SIZE * (isHover ? 1.05 : 1);

    if (tile.isAddSlot) {
      drawHexPath(tile.px, tile.py, size);
      ctx.setLineDash([4, 4]);
      ctx.strokeStyle = 'rgba(108,122,153,0.6)';
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.setLineDash([]);
      if (tile === tiles.find((x) => x.isAddSlot)) {
        ctx.fillStyle = 'rgba(108,122,153,0.6)';
        ctx.font = '20px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('+', tile.px, tile.py + 7);
      }
      continue;
    }

    const active = tile.project.active;
    const top = active ? '#1c4a30' : '#24304a';
    const side = active ? '#123322' : '#182238';
    drawTileBlock(tile.px, tile.py, top, side, size);
    drawBuilding(tile.px, tile.py - 6, tile.buildingSeed, active);
    drawCharacter(tile.px, tile.py + 4, tile, active);

    ctx.fillStyle = active ? '#9ff5c4' : '#9fb0d0';
    ctx.font = '11px -apple-system, "Segoe UI", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(tile.project.name, tile.px, tile.py + TILE_DEPTH + 22);
    ctx.fillStyle = active ? '#6ee89f' : '#5c6a8a';
    ctx.font = '9px -apple-system, "Segoe UI", sans-serif';
    ctx.fillText(active ? 'session open' : 'idle', tile.px, tile.py + TILE_DEPTH + 34);
  }

  ctx.restore();
}

function loop() {
  t += 0.016;
  draw();
  requestAnimationFrame(loop);
}

// ---- interaction --------------------------------------------------------
function eventToWorld(evt) {
  const rect = canvas.getBoundingClientRect();
  const x = (evt.clientX - rect.left) * devicePixelRatio - canvas.width / 2;
  const y = (evt.clientY - rect.top) * devicePixelRatio - canvas.height / 2;
  return { x: x / devicePixelRatio, y: y / devicePixelRatio };
}

function tileAt(worldX, worldY) {
  let closest = null;
  let closestDist = Infinity;
  for (const tile of tiles) {
    const dx = worldX - tile.px;
    const dy = (worldY - (tile.py + TILE_DEPTH / 2)) / SQUISH;
    const dist = Math.hypot(dx, dy);
    if (dist < HEX_SIZE && dist < closestDist) {
      closest = tile;
      closestDist = dist;
    }
  }
  return closest;
}

canvas.addEventListener('mousemove', (evt) => {
  const { x, y } = eventToWorld(evt);
  hovered = tileAt(x, y);
  canvas.style.cursor = hovered ? 'pointer' : 'default';
});

canvas.addEventListener('mouseleave', () => { hovered = null; });

canvas.addEventListener('click', (evt) => {
  const { x, y } = eventToWorld(evt);
  const tile = tileAt(x, y);
  if (!tile) return;
  if (tile.isAddSlot) {
    window.agentColony.addProject().then(refreshProjects);
  } else {
    window.agentColony.launchAgent(tile.project.path);
  }
});

canvas.addEventListener('contextmenu', async (evt) => {
  evt.preventDefault();
  const { x, y } = eventToWorld(evt);
  const tile = tileAt(x, y);
  if (!tile || tile.isAddSlot) return;
  if (confirm(`Remove "${tile.project.name}" from Agent Colony?`)) {
    await window.agentColony.removeProject(tile.project.path);
    refreshProjects();
  }
});

// ---- data ---------------------------------------------------------------
async function refreshProjects() {
  projects = await window.agentColony.listProjects();
  emptyMsg.hidden = true; // the "+" tile always shows the way in
  rebuildTiles();
}

window.agentColony.onStatus(refreshProjects);

resize();
refreshProjects().then(loop);
