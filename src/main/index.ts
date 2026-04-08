import { app, shell, BrowserWindow, Menu, nativeImage, session, systemPreferences } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import log from 'electron-log/main'
import { APP_DEFAULTS } from '../shared/constants/defaults'
import { getDb, closeDb } from './db/connection'
import { registerAllIpcHandlers } from './ipc/register-all'
import { cleanupAllAgents } from './services/agent-manager'
import { initializeServices, startServices, stopServices } from './services/service-orchestrator'

log.initialize()
log.transports.file.level = 'info'
log.transports.console.level = is.dev ? 'debug' : 'warn'

function createWindow(): void {
  const iconPath = process.platform === 'win32' ? join(__dirname, '../../build/icon.ico') : join(__dirname, '../../build/icon.png')
  const icon = nativeImage.createFromPath(iconPath)

  const mainWindow = new BrowserWindow({
    width: APP_DEFAULTS.WINDOW_WIDTH,
    height: APP_DEFAULTS.WINDOW_HEIGHT,
    minWidth: APP_DEFAULTS.MIN_WIDTH,
    minHeight: APP_DEFAULTS.MIN_HEIGHT,
    show: false,
    autoHideMenuBar: true,
    titleBarStyle: 'hiddenInset',
    ...(process.platform === 'linux' || process.platform === 'darwin' ? { icon } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: true
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
    if (is.dev) mainWindow.webContents.openDevTools()
    log.info('Main window shown')
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

app.whenReady().then(() => {
  electronApp.setAppUserModelId('com.agenthub')

  // macOS requires an Edit menu for Cmd+C/V/X/A to work
  const menu = Menu.buildFromTemplate([
    { role: 'appMenu' },
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'selectAll' }
      ]
    },
    {
      label: 'View',
      submenu: [
        { role: 'reload' },
        { role: 'forceReload' },
        { role: 'toggleDevTools' },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { role: 'togglefullscreen' }
      ]
    }
  ])
  Menu.setApplicationMenu(menu)

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  // Allow microphone access from the renderer (required for voice input)
  session.defaultSession.setPermissionRequestHandler((_webContents, permission, callback) => {
    if (permission === 'media') {
      if (process.platform === 'darwin') {
        systemPreferences.askForMediaAccess('microphone').then((granted) => callback(granted))
      } else {
        callback(true)
      }
      return
    }
    callback(false)
  })

  // Set app icon for macOS dock
  if (process.platform === 'darwin') {
    const nativeIcon = nativeImage.createFromPath(join(__dirname, '../../build/icon.png'))
    app.dock?.setIcon(nativeIcon)
  }

  // Initialize database
  const dbPath = join(app.getPath('userData'), 'agenthub.db')
  const db = getDb(dbPath)
  log.info('Database initialized', { path: dbPath })

  // Register all IPC handlers
  registerAllIpcHandlers()

  // Initialize services (creates instances, wires dependencies)
  initializeServices(db)

  createWindow()

  // Start periodic services after window is ready
  startServices()

  log.info('AgentHub started', { version: app.getVersion(), platform: process.platform })

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('before-quit', () => {
  log.info('AgentHub shutting down')
  stopServices()
  cleanupAllAgents()
  closeDb()
})
