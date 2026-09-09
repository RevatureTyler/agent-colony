const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('agentColony', {
  listProjects: () => ipcRenderer.invoke('projects:list'),
  addProject: () => ipcRenderer.invoke('projects:add'),
  removeProject: (path) => ipcRenderer.invoke('projects:remove', path),
  launchAgent: (path) => ipcRenderer.invoke('agent:launch', path),
  onStatus: (cb) => ipcRenderer.on('projects:status', (_evt, data) => cb(data)),
});
