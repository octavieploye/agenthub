import { it, expect } from 'vitest'
import { NullAnamnesisAdapter } from './anamnesis-adapter'

it('NullAnamnesisAdapter.flush resolves without throwing', async () => {
  const adapter = new NullAnamnesisAdapter()
  await expect(adapter.flush()).resolves.toBeUndefined()
})

it('NullAnamnesisAdapter.onEventInserted does not throw', () => {
  const adapter = new NullAnamnesisAdapter()
  expect(() => adapter.onEventInserted()).not.toThrow()
})
