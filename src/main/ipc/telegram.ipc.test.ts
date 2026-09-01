import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ipcMain } from 'electron'
import { IPC_CHANNELS } from '../../shared/constants/ipc-channels'
import { registerTelegramIpc } from './telegram.ipc'

const mocks = vi.hoisted(() => ({
  getTelegramSidecarService: vi.fn(),
  getTelegramQueueProcessor: vi.fn(),
  getTelegramSocketStatus: vi.fn(),
}))

vi.mock('electron', () => ({
  ipcMain: { handle: vi.fn() },
}))

vi.mock('../services/service-orchestrator', () => mocks)

vi.mock('../db/connection', () => ({ getDb: vi.fn() }))

vi.mock('../db/queries/telegram.queries', () => ({
  getTelegramPrefs: vi.fn(),
  setTelegramPref: vi.fn(),
}))

function getHandler(channel: string): (...args: unknown[]) => unknown {
  const call = vi.mocked(ipcMain.handle).mock.calls.find(([registered]) => registered === channel)
  if (!call) throw new Error(`No handler registered for ${channel}`)
  return call[1] as (...args: unknown[]) => unknown
}

describe('Telegram IPC diagnostics', () => {
  beforeEach(() => {
    vi.mocked(ipcMain.handle).mockClear()
    mocks.getTelegramSidecarService.mockReturnValue({
      getStatus: () => ({ connected: true, botUsername: 'agenthub_bot' }),
    })
    mocks.getTelegramSocketStatus.mockReturnValue({
      socketPath: '/tmp/telegram.sock',
      state: 'error',
      errorCode: 'EADDRINUSE',
    })
    registerTelegramIpc()
  })

  it('includes the socket path and lifecycle health in Telegram status', () => {
    const result = getHandler(IPC_CHANNELS.TELEGRAM.GET_STATUS)()

    expect(result).toEqual({
      connected: true,
      botUsername: 'agenthub_bot',
      socket: {
        socketPath: '/tmp/telegram.sock',
        state: 'error',
        errorCode: 'EADDRINUSE',
      },
    })
  })
})
