import { spawn, type ChildProcess } from 'child_process'
import { BrowserWindow } from 'electron'
import { IPC_EVENTS } from '../../shared/constants/ipc-channels'

export interface ResponseCollectorDeps {
  agentId: string
  task: string
  claudeArgs: string[]
  env: Record<string, string>
  logInfo: (message: string, meta?: Record<string, unknown>) => void
}

/** Exported for unit testing — parses one NDJSON line from stream-json output. */
export function parseStreamJsonLine(line: string): string | null {
  if (!line.trim()) return null
  try {
    const event = JSON.parse(line)
    if (
      event.type === 'content_block_delta' &&
      event.delta?.type === 'text_delta' &&
      typeof event.delta.text === 'string'
    ) {
      return event.delta.text
    }
    return null
  } catch {
    return null
  }
}

function emitToAllRenderers(channel: string, ...args: unknown[]): void {
  for (const win of BrowserWindow.getAllWindows()) {
    if (!win.isDestroyed()) {
      win.webContents.send(channel, ...args)
    }
  }
}

export function startResponseCollector(deps: ResponseCollectorDeps): ChildProcess {
  const { agentId, task, claudeArgs, env, logInfo } = deps

  const proc = spawn(
    'claude',
    [...claudeArgs, '--print', '--output-format', 'stream-json', '--verbose', task],
    { env, stdio: ['ignore', 'pipe', 'pipe'] }
  )

  let accumulated = ''
  let lineBuffer = ''

  proc.stdout!.on('data', (chunk: Buffer) => {
    lineBuffer += chunk.toString('utf-8')
    const lines = lineBuffer.split('\n')
    lineBuffer = lines.pop() ?? ''
    for (const line of lines) {
      const text = parseStreamJsonLine(line)
      if (text) accumulated += text
    }
  })

  proc.stderr!.on('data', (data: Buffer) => {
    logInfo('ResponseCollector stderr', { agentId, msg: data.toString().trim().slice(0, 200) })
  })

  proc.on('close', (code) => {
    logInfo('ResponseCollector finished', { agentId, code, textLength: accumulated.length })
    if (accumulated.trim()) {
      emitToAllRenderers(IPC_EVENTS.TTS.RESPONSE_READY, agentId, accumulated.trim())
    }
  })

  proc.on('error', (err) => {
    logInfo('ResponseCollector error', { agentId, error: err.message })
  })

  return proc
}
