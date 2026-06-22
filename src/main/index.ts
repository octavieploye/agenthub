import { app, shell, BrowserWindow, Menu, nativeImage, session, systemPreferences } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import log from 'electron-log/main'
import { APP_DEFAULTS } from '../shared/constants/defaults'
import { getDb, closeDb, markShuttingDown } from './db/connection'
import { registerAllIpcHandlers } from './ipc/register-all'
import { cleanupAllAgents } from './services/agent-manager'
import { initializeServices, startServices, stopServices } from './services/service-orchestrator'
import { getShutdownReason, setShutdownReason } from './shutdown-reason'

log.initialize()
log.transports.file.level = 'debug'
log.transports.console.level = is.dev ? 'debug' : 'warn'

process.on('uncaughtException', (err) => {
  log.error('Uncaught exception', { message: err.message, stack: err.stack })
})

process.on('unhandledRejection', (reason) => {
  log.error('Unhandled rejection', { reason: reason instanceof Error ? { message: reason.message, stack: reason.stack } : String(reason) })
})

process.on('exit', (code) => {
  log.info('Process exit', { code, shutdownReason: getShutdownReason() })
})

// OS signals — these fire before before-quit and tell us WHY
process.on('SIGTERM', () => {
  setShutdownReason('SIGTERM (system termination)')
  log.warn('Received SIGTERM — system requested termination')
})

process.on('SIGINT', () => {
  setShutdownReason('SIGINT (Ctrl+C or system interrupt)')
  log.warn('Received SIGINT')
})

process.on('SIGHUP', () => {
  setShutdownReason('SIGHUP (terminal closed or parent died)')
  log.warn('Received SIGHUP')
})

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
    log.info('Main window shown')
  })

  mainWindow.on('close', () => {
    log.info('Main window close event', {
      reason: getShutdownReason(),
      isQuitting: app.isQuitting?.() ?? 'unknown'
    })
  })

  mainWindow.on('closed', () => {
    log.info('Main window closed (destroyed)')
  })

  mainWindow.webContents.on('render-process-gone', (_event, details) => {
    log.error('Renderer process gone', {
      reason: details.reason,
      exitCode: details.exitCode
    })
    if (details.reason === 'crashed' || details.reason === 'killed') {
      setShutdownReason(`renderer-${details.reason} (exitCode: ${details.exitCode})`)
    }
  })

  mainWindow.webContents.on('unresponsive', () => {
    log.error('Renderer became unresponsive')
  })

  mainWindow.webContents.on('did-fail-load', (_event, errorCode, errorDescription) => {
    log.error('Renderer failed to load', { errorCode, errorDescription })
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

  setInterval(() => {
    const mem = process.memoryUsage()
    log.debug('Heartbeat', {
      rss: Math.round(mem.rss / 1024 / 1024),
      heapUsed: Math.round(mem.heapUsed / 1024 / 1024),
      heapTotal: Math.round(mem.heapTotal / 1024 / 1024)
    })
  }, 30_000)

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
  log.info('All windows closed', { platform: process.platform })
  if (process.platform !== 'darwin') {
    setShutdownReason('window-all-closed (non-macOS auto-quit)')
    app.quit()
  }
})

app.on('before-quit', () => {
  // If no explicit reason was set by a signal or tray action,
  // it's most likely Cmd+Q / menu quit on macOS or app.quit() call
  if (getShutdownReason() === 'unknown') {
    setShutdownReason('user-quit (Cmd+Q, menu, or dock)')
  }
  log.info('AgentHub shutting down', { reason: getShutdownReason(), windowCount: BrowserWindow.getAllWindows().length })

  // Mark DB as shutting down BEFORE killing agents so their
  // async onExit handlers know to skip DB writes.
  markShuttingDown()

  stopServices()
  cleanupAllAgents()
  closeDb()
})

// will-quit fires after all windows are closed but before the process exits
app.on('will-quit', () => {
  log.info('App will-quit', { reason: getShutdownReason() })
})
