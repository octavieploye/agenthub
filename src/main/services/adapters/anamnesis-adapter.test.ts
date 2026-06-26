import { it, expect, vi } from 'vitest'
import { NullAnamnesisAdapter } from './anamnesis-adapter'

it('NullAnamnesisAdapter.flush resolves without throwing', async () => {
  const adapter = new NullAnamnesisAdapter()
  await expect(adapter.flush()).resolves.toBeUndefined()
})

it('NullAnamnesisAdapter.onEventInserted does not throw', () => {
  const adapter = new NullAnamnesisAdapter()
  expect(() => adapter.onEventInserted()).not.toThrow()
})

it('NullAnamnesisAdapter.flush resolves cleanly — catch handler is never called', async () => {
  const adapter = new NullAnamnesisAdapter()
  const catchHandler = vi.fn()
  await adapter.flush().catch(catchHandler)
  expect(catchHandler).not.toHaveBeenCalled()
})
