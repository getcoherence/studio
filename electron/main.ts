import { app, BrowserWindow, Tray, Menu, nativeImage } from 'electron'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import fs from 'node:fs/promises'
import { createHudOverlayWindow, createEditorWindow, createSourceSelectorWindow } from './windows'
import { registerIpcHandlers } from './ipc/handlers'


const __dirname = path.dirname(fileURLToPath(import.meta.url))

export const RECORDINGS_DIR = path.join(app.getPath('userData'), 'recordings')

// Cleanup old recordings (older than 1 day)
async function cleanupOldRecordings() {
  try {
    const files = await fs.readdir(RECORDINGS_DIR)
    const now = Date.now()
    const maxAge = 1 * 24 * 60 * 60 * 1000
    
    for (const file of files) {
      const filePath = path.join(RECORDINGS_DIR, file)
      const stats = await fs.stat(filePath)
      
      if (now - stats.mtimeMs > maxAge) {
        await fs.unlink(filePath)
        console.log(`Deleted old recording: ${file}`)
      }
    }
  } catch (error) {
    console.error('Failed to cleanup old recordings:', error)
  }
}

async function ensureRecordingsDir() {
  try {
    await fs.mkdir(RECORDINGS_DIR, { recursive: true })
    console.log('RECORDINGS_DIR:', RECORDINGS_DIR)
    console.log('User Data Path:', app.getPath('userData'))
  } catch (error) {
    console.error('Failed to create recordings directory:', error)
  }
}

// The built directory structure
//
// ├─┬─┬ dist
// │ │ └── index.html
// │ │
// │ ├─┬ dist-electron
// │ │ ├── main.js
// │ │ └── preload.mjs
// │
process.env.APP_ROOT = path.join(__dirname, '..')

// Use ['ENV_NAME'] avoid vite:define plugin - Vite@2.x
export const VITE_DEV_SERVER_URL = process.env['VITE_DEV_SERVER_URL']
export const MAIN_DIST = path.join(process.env.APP_ROOT, 'dist-electron')
export const RENDERER_DIST = path.join(process.env.APP_ROOT, 'dist')

process.env.VITE_PUBLIC = VITE_DEV_SERVER_URL ? path.join(process.env.APP_ROOT, 'public') : RENDERER_DIST

// Window references
let mainWindow: BrowserWindow | null = null
let sourceSelectorWindow: BrowserWindow | null = null
let tray: Tray | null = null
let selectedSourceName = ''

function createWindow() {
  mainWindow = createHudOverlayWindow()
}

function createTray() {
  const iconPath = path.join(process.env.VITE_PUBLIC || RENDERER_DIST, 'rec-button.png');
  let icon = nativeImage.createFromPath(iconPath);
  icon = icon.resize({ width: 24, height: 24, quality: 'best' });
  tray = new Tray(icon);
  updateTrayMenu();
}

function updateTrayMenu() {
  if (!tray) return;
  const menuTemplate = [
    {
      label: 'Stop Recording',
      click: () => {
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('stop-recording-from-tray');
        }
      }
    }
  ];
  const contextMenu = Menu.buildFromTemplate(menuTemplate);
  tray.setContextMenu(contextMenu);
  tray.setToolTip(`Recording: ${selectedSourceName}`);
}

function createEditorWindowWrapper() {
  if (mainWindow) {
    mainWindow.close()
    mainWindow = null
  }
  mainWindow = createEditorWindow()
}

function createSourceSelectorWindowWrapper() {
  sourceSelectorWindow = createSourceSelectorWindow()
  sourceSelectorWindow.on('closed', () => {
    sourceSelectorWindow = null
  })
  return sourceSelectorWindow
}

// On macOS, applications and their menu bar stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  // Keep app running (macOS behavior)
})

app.on('activate', () => {
  // On OS X it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow()
  }
})

// Cleanup old recordings on quit (both macOS and other platforms)
app.on('before-quit', async (event) => {
  event.preventDefault()

  await cleanupOldRecordings()
  app.exit(0)
})

// Register all IPC handlers when app is ready
app.whenReady().then(async () => {
  // Ensure recordings directory exists
  await ensureRecordingsDir()
  
  registerIpcHandlers(
    createEditorWindowWrapper,
    createSourceSelectorWindowWrapper,
    () => mainWindow,
    () => sourceSelectorWindow,
    (recording: boolean, sourceName: string) => {
      selectedSourceName = sourceName
      if (recording) {
        if (!tray) createTray();
        updateTrayMenu();
        if (mainWindow) mainWindow.minimize();
      } else {
        if (tray) {
          tray.destroy();
          tray = null;
        }
        if (mainWindow) mainWindow.restore();
      }
    }
  )
  createWindow()
})
