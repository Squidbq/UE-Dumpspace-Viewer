const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  selectFolder: () => ipcRenderer.invoke('select-folder'),
  getSelectedFolder: () => ipcRenderer.invoke('get-selected-folder'),
  checkFilesExist: (filenames, folderPath) => ipcRenderer.invoke('check-files-exist', filenames, folderPath),
  loadJSONFile: (filename, folderPath) => ipcRenderer.invoke('load-json-file', filename, folderPath),
  saveFile: (content, defaultFilename) => ipcRenderer.invoke('save-file', content, defaultFilename),
  copyToClipboard: (text) => ipcRenderer.invoke('copy-to-clipboard', text),
  saveCollections: (collections) => ipcRenderer.invoke('save-collections', collections),
  loadCollections: () => ipcRenderer.invoke('load-collections'),
  getCollectionsPath: () => ipcRenderer.invoke('get-collections-path')
});

