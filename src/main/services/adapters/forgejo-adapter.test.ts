import { it, expect, vi } from 'vitest'
import { NullForgejoAdapter, ForgejoAdapter } from './forgejo-adapter'
import type { ForgejoBuildOutcome } from './forgejo-adapter'

const sampleOutcome: ForgejoBuildOutcome = {
  repoName: 'test-repo',
  sprintId: 'sprint-001',
  status: 'done',
  summary: 'All tasks completed',
  completedAt: '2026-06-26T10:00:00.000Z'
}

it('NullForgejoAdapter.isAvailable returns false', async () => {
  const adapter = new NullForgejoAdapter()
  expect(await adapter.isAvailable()).toBe(false)
})

it('NullForgejoAdapter.pushBuildOutcome resolves without throwing', async () => {
  const adapter = new NullForgejoAdapter()
  await expect(adapter.pushBuildOutcome(sampleOutcome)).resolves.toBeUndefined()
})

it('ForgejoAdapter.isAvailable returns true when server responds ok', async () => {
  const fetchMock = vi.fn().mockResolvedValue({ ok: true } as Response)
  const adapter = new ForgejoAdapter('http://forgejo.local:3000', 'test-token', { fetch: fetchMock })
  expect(await adapter.isAvailable()).toBe(true)
  expect(fetchMock).toHaveBeenCalledWith(
    'http://forgejo.local:3000/api/v1/version',
    expect.objectContaining({ headers: { Authorization: 'token test-token' } })
  )
})

it('ForgejoAdapter.isAvailable returns false when server is unreachable', async () => {
  const fetchMock = vi.fn().mockRejectedValue(new Error('ECONNREFUSED'))
  const adapter = new ForgejoAdapter('http://forgejo.local:3000', 'test-token', { fetch: fetchMock })
  expect(await adapter.isAvailable()).toBe(false)
})

it('ForgejoAdapter.pushBuildOutcome resolves without throwing (stub behavior)', async () => {
  const fetchMock = vi.fn()
  const adapter = new ForgejoAdapter('http://forgejo.local:3000', 'test-token', { fetch: fetchMock })
  await expect(adapter.pushBuildOutcome(sampleOutcome)).resolves.toBeUndefined()
})
