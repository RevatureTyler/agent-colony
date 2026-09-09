const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');

const dataFile = path.join(app.getPath('userData'), 'projects.json');
const activeSessions = new Map(); // projectPath -> child process

function loadProjects() {
  try {
    return JSON.parse(fs.readFileSync(dataFile, 'utf8'));
  } catch {
    return [];
  }
}

function saveProjects(projects) {
  fs.writeFileSync(dataFile, JSON.stringify(projects, null, 2));
}

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1100,
    height: 800,
    backgroundColor: '#0e1420',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
    },
  });
  mainWindow.setMenuBarVisibility(false);
  mainWindow.webContents.on('console-message', (_evt, _level, message, line, sourceId) => {
    console.log(`[renderer] ${message} (${sourceId}:${line})`);
  });
  mainWindow.loadFile(path.join(__dirname, 'index.html'));
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

ipcMain.handle('projects:list', () => {
  const projects = loadProjects();
  return projects.map((p) => ({ ...p, active: activeSessions.has(p.path) }));
});

ipcMain.handle('projects:add', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory'],
  });
  if (result.canceled || result.filePaths.length === 0) return loadProjects();

  const folderPath = result.filePaths[0];
  const projects = loadProjects();
  if (!projects.some((p) => p.path === folderPath)) {
    projects.push({
      path: folderPath,
      name: path.basename(folderPath),
      addedAt: Date.now(),
    });
    saveProjects(projects);
  }
  return projects;
});

ipcMain.handle('projects:remove', (_evt, projectPath) => {
  const projects = loadProjects().filter((p) => p.path !== projectPath);
  saveProjects(projects);
  const session = activeSessions.get(projectPath);
  if (session) {
    try { session.kill(); } catch {}
    activeSessions.delete(projectPath);
  }
  return projects;
});

function notifyStatus(projectPath, active) {
  if (mainWindow) {
    mainWindow.webContents.send('projects:status', { path: projectPath, active });
  }
}

ipcMain.handle('agent:launch', (_evt, projectPath) => {
  if (activeSessions.has(projectPath)) return { ok: true, already: true };

  const isWindows = process.platform === 'win32';
  const isMac = process.platform === 'darwin';

  let child;
  if (isWindows) {
    // Opens a new console window running `claude` in the project directory.
    // projectPath is passed as its own argv entry (via /D) rather than
    // interpolated into a shell command string, so it can't break out
    // even if it contains quotes or shell metacharacters.
    child = spawn('cmd.exe', ['/c', 'start', '""', '/D', projectPath, 'cmd.exe', '/k', 'claude'], {
      cwd: projectPath,
      detached: true,
      shell: false,
      windowsHide: false,
    });
  } else if (isMac) {
    // Escape for the POSIX shell (single-quote the path), then escape that
    // result for the AppleScript double-quoted string it's embedded in.
    const shQuoted = `'${projectPath.replace(/'/g, "'\\''")}'`;
    const asQuoted = shQuoted.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
    const script = `tell application "Terminal" to do script "cd ${asQuoted} && claude"`;
    child = spawn('osascript', ['-e', script], { detached: true });
  } else {
    // Pass projectPath as a positional arg ($0) instead of interpolating it
    // into the shell command string.
    child = spawn(
      'x-terminal-emulator',
      ['-e', 'bash', '-c', 'cd "$0" && claude; exec bash', projectPath],
      { cwd: projectPath, detached: true }
    );
  }

  activeSessions.set(projectPath, child);
  notifyStatus(projectPath, true);

  child.on('exit', () => {
    activeSessions.delete(projectPath);
    notifyStatus(projectPath, false);
  });
  child.on('error', () => {
    activeSessions.delete(projectPath);
    notifyStatus(projectPath, false);
  });
  child.unref();

  return { ok: true };
});
