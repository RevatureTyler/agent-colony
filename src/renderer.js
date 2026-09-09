const FACES = ['🧑‍💻', '🤖', '👾', '🧙', '🦾', '🛰️'];

function faceFor(name) {
  let hash = 0;
  for (const ch of name) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  return FACES[hash % FACES.length];
}

async function render() {
  const grid = document.getElementById('grid');
  const empty = document.getElementById('empty');
  const projects = await window.agentColony.listProjects();

  grid.innerHTML = '';
  empty.hidden = projects.length > 0;

  for (const project of projects) {
    const tile = document.createElement('div');
    tile.className = 'hex-tile' + (project.active ? ' active' : '');
    tile.dataset.path = project.path;

    const removeBtn = document.createElement('button');
    removeBtn.className = 'remove-btn';
    removeBtn.title = 'Remove';
    removeBtn.textContent = '✕';

    const face = document.createElement('div');
    face.className = 'tile-face';
    face.textContent = faceFor(project.name);

    const name = document.createElement('div');
    name.className = 'tile-name';
    name.textContent = project.name;

    const status = document.createElement('div');
    status.className = 'tile-status';
    status.textContent = project.active ? 'session open' : 'idle';

    tile.append(removeBtn, face, name, status);

    tile.addEventListener('click', (e) => {
      if (e.target === removeBtn) return;
      window.agentColony.launchAgent(project.path);
    });
    removeBtn.addEventListener('click', async () => {
      await window.agentColony.removeProject(project.path);
      render();
    });
    grid.appendChild(tile);
  }
}

document.getElementById('addBtn').addEventListener('click', async () => {
  await window.agentColony.addProject();
  render();
});

window.agentColony.onStatus(() => render());

render();
