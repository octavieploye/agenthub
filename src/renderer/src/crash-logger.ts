import type { RendererErrorPayload } from '../../shared/types/log.types'

function send(payload: RendererErrorPayload): void {
  window.agentHub.log.rendererError(payload)
}

// ── IPC flood detection ───────────────────────────────────────────────────────
// Counts agentOutput events per second. Warns if > 100/s for 3 consecutive seconds.

let ipcFloodCount = 0
let ipcFloodConsecutive = 0
const IPC_FLOOD_THRESHOLD = 100

function startIpcFloodDetector(): void {
  setInterval(() => {
    if (ipcFloodCount > IPC_FLOOD_THRESHOLD) {
      ipcFloodConsecutive++
      if (ipcFloodConsecutive >= 3) {
        send({
          type: 'ipcFlood',
          message: `agentOutput IPC rate: ${ipcFloodCount}/s for ${ipcFloodConsecutive} consecutive seconds`,
          rate: ipcFloodCount,
          timestamp: Date.now()
        })
        ipcFloodConsecutive = 0
      }
    } else {
      ipcFloodConsecutive = 0
    }
    ipcFloodCount = 0
  }, 1000)

  window.agentHub.on.agentOutput(() => {
    ipcFloodCount++
  })
}

// ── Window-level error hooks ──────────────────────────────────────────────────

function hookWindowErrors(): void {
  window.onerror = (message, source, lineno, colno, error) => {
    send({
      type: 'uncaught',
      message: String(message),
      stack: error?.stack ?? `${source}:${lineno}:${colno}`,
      timestamp: Date.now()
    })
    return false
  }

  window.addEventListener('unhandledrejection', (event) => {
    const reason = event.reason
    send({
      type: 'unhandledRejection',
      message: reason instanceof Error ? reason.message : String(reason),
      stack: reason instanceof Error ? reason.stack : undefined,
      timestamp: Date.now()
    })
  })
}

// ── WebGL context loss ────────────────────────────────────────────────────────
// Called after an xterm terminal is opened. Attaches a webglcontextlost listener
// to the canvas element inside xterm's container.

export function watchWebGlContext(container: HTMLElement, agentId: string): void {
  const canvas = container.querySelector('canvas')
  if (!canvas) return

  canvas.addEventListener('webglcontextlost', () => {
    send({
      type: 'webglContextLoss',
      message: 'WebGL context lost',
      agentId,
      timestamp: Date.now()
    })
  })
}

// ── Entry point ───────────────────────────────────────────────────────────────

export function initCrashLogger(): void {
  hookWindowErrors()
  startIpcFloodDetector()
}
