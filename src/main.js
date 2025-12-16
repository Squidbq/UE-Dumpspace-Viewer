const { app, BrowserWindow, ipcMain, dialog, clipboard } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');

let mainWindow;

function createWindow() {
  const iconPath = path.join(__dirname, '..', 'build', 'icon.ico');
  const iconExists = fs.existsSync(iconPath);
  
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1000,
    minHeight: 600,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true
    },
    backgroundColor: '#1a1a1a',
    titleBarStyle: 'default',
    autoHideMenuBar: true,
    show: false,
    ...(iconExists && { icon: iconPath })
  });

  mainWindow.loadFile(path.join(__dirname, 'index.html'));

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  if (process.env.NODE_ENV === 'development') {
    mainWindow.webContents.openDevTools();
  }
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

let selectedFolderPath = null;

ipcMain.handle('select-folder', async () => {
  try {
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ['openDirectory'],
      title: 'Select folder containing JSON files'
    });

    if (!result.canceled && result.filePaths.length > 0) {
      selectedFolderPath = result.filePaths[0];
      return { success: true, path: selectedFolderPath };
    }
    return { success: false };
  } catch (error) {
    console.error('Error selecting folder:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('get-selected-folder', () => {
  return selectedFolderPath;
});

ipcMain.handle('check-files-exist', async (event, filenames, folderPath = null) => {
  try {
    const targetFolder = folderPath || selectedFolderPath;
    
    if (!targetFolder) {
      return { success: false, error: 'No folder selected' };
    }
    
    const results = [];
    for (const filename of filenames) {
      const filePath = path.join(targetFolder, filename);
      const exists = fs.existsSync(filePath);
      results.push({ filename, exists });
    }
    
    const missingFiles = results.filter(r => !r.exists).map(r => r.filename);
    const allExist = missingFiles.length === 0;
    
    return {
      success: allExist,
      missingFiles: missingFiles,
      results: results
    };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('load-json-file', async (event, filename, folderPath = null) => {
  try {
    const targetFolder = folderPath || selectedFolderPath;
    
    if (!targetFolder) {
      return { success: false, error: `No folder selected. Please select a folder containing ${filename}` };
    }
    
    const filePath = path.join(targetFolder, filename);
    
    if (!fs.existsSync(filePath)) {
      return { success: false, error: `File not found: ${filename}` };
    }
    
    const data = fs.readFileSync(filePath, 'utf-8');
    return { success: true, data: JSON.parse(data) };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('save-file', async (event, content, defaultFilename) => {
  try {
    const ext = defaultFilename.split('.').pop() || 'txt';
    
    const { filePath } = await dialog.showSaveDialog(mainWindow, {
      defaultPath: defaultFilename,
      filters: [
        { name: 'C++ Files', extensions: ['cpp', 'h', 'hpp'] },
        { name: 'C# Files', extensions: ['cs'] },
        { name: 'Text Files', extensions: ['txt'] },
        { name: 'All Files', extensions: ['*'] }
      ]
    });

    if (filePath) {
      fs.writeFileSync(filePath, content, 'utf-8');
      return { success: true, path: filePath };
    }
    return { success: false, error: 'Save cancelled' };
  } catch (error) {
    console.error('Error saving file:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('copy-to-clipboard', async (event, text) => {
  try {
    clipboard.writeText(text);
    return { success: true };
  } catch (error) {
    console.error('Error copying to clipboard:', error);
    return { success: false, error: error.message };
  }
});

const getCollectionsPath = () => {
  const userDataPath = app.getPath('userData');
  return path.join(userDataPath, 'collections.json');
};

const getBackupsPath = () => {
  const userDataPath = app.getPath('userData');
  return path.join(userDataPath, 'collections_backup.json');
};

ipcMain.handle('save-collections', async (event, collections) => {
  try {
    const filePath = getCollectionsPath();
    const backupPath = getBackupsPath();
    
    if (fs.existsSync(filePath)) {
      const existingData = fs.readFileSync(filePath, 'utf-8');
      const backups = fs.existsSync(backupPath) ? JSON.parse(fs.readFileSync(backupPath, 'utf-8')) : [];
      backups.push({
        timestamp: new Date().toISOString(),
        data: JSON.parse(existingData)
      });
      
      if (backups.length > 5) {
        backups.shift();
      }
      
      fs.writeFileSync(backupPath, JSON.stringify(backups, null, 2), 'utf-8');
    }
    
    fs.writeFileSync(filePath, JSON.stringify(collections, null, 2), 'utf-8');
    return { success: true };
  } catch (error) {
    console.error('Error saving collections:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('load-collections', async () => {
  try {
    const filePath = getCollectionsPath();
    if (!fs.existsSync(filePath)) {
      return { success: true, data: [] };
    }
    const data = fs.readFileSync(filePath, 'utf-8');
    return { success: true, data: JSON.parse(data) };
  } catch (error) {
    console.error('Error loading collections:', error);
    return { success: false, error: error.message, data: [] };
  }
});

ipcMain.handle('get-collections-path', () => {
  return getCollectionsPath();
});

