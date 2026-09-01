import { beforeEach, describe, expect, it, vi } from 'vitest'

const { mockBrainScanner } = vi.hoisted(() => ({
  mockBrainScanner: {
    registerBrainEntry: vi.fn()
  }
}))

vi.mock('electron', () => ({
  ipcMain: { handle: vi.fn() }
}))

vi.mock('electron-log/main', () => ({
  default: { info: vi.fn(), error: vi.fn(), debug: vi.fn(), warn: vi.fn() }
}))

vi.mock('../services/brain-scanner', () => ({
  getBrainScanner: () => mockBrainScanner
}))

import { ipcMain } from 'electron'
import { IPC_CHANNELS } from '../../shared/constants/ipc-channels'
import { registerBrainIpcHandlers } from './brain.ipc'

function getHandler(channel: string): (...args: unknown[]) => unknown {
  const call = vi.mocked(ipcMain.handle).mock.calls.find(([registered]) => registered === channel)
  if (!call) throw new Error(`No handler for ${channel}`)
  return call[1] as (...args: unknown[]) => unknown
}

describe('brain.ipc register contract', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    registerBrainIpcHandlers()
  })

  it('registers a validated brain artifact through the scanner', async () => {
    mockBrainScanner.registerBrainEntry.mockReturnValue('brain-entry-1')
    const input = {
      repoId: 'repo-1',
      subject: 'Reliability sprint',
      type: 'sprint',
      artifactPath: '/workspace/docs/sprint.md',
      project: 'AgentHub',
      note: 'Manual registration'
    }

    const result = await getHandler(IPC_CHANNELS.BRAIN.REGISTER)(undefined, input)

    expect(mockBrainScanner.registerBrainEntry).toHaveBeenCalledWith(input)
    expect(result).toEqual({ entryId: 'brain-entry-1', success: true })
  })

  it.each([
    [{ subject: 'Missing repository', type: 'spec', artifactPath: '/tmp/spec.md' }],
    [{ repoId: 'repo-1', subject: '', type: 'spec', artifactPath: '/tmp/spec.md' }],
    [{ repoId: 'repo-1', subject: 'Invalid type', type: 'unknown', artifactPath: '/tmp/spec.md' }],
    [{ repoId: 'repo-1', subject: 'Missing path', type: 'spec', artifactPath: '' }]
  ])('rejects invalid registration input %#', async (input) => {
    await expect(getHandler(IPC_CHANNELS.BRAIN.REGISTER)(undefined, input)).rejects.toThrow(
      'Invalid brain registration'
    )
    expect(mockBrainScanner.registerBrainEntry).not.toHaveBeenCalled()
  })
})
