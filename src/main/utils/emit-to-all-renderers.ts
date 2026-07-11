import { app, BrowserWindow } from 'electron'

let _windowCache: BrowserWindow[] = []

export function initWindowCache(): void {
  _windowCache = BrowserWindow.getAllWindows()
  app.on('browser-window-created', (_, win) => {
    _windowCache.push(win)
    win.on('closed', () => {
      _windowCache = _windowCache.filter(w => w !== win)
    })
  })
}

export function emitToAllRenderers(channel: string, ...args: unknown[]): void {
  for (const win of _windowCache.filter(w => !w.isDestroyed())) {
    win.webContents.send(channel, ...args)
  }
}
