import { describe, it, expect, vi, afterEach } from 'vitest'
import { AnamnesisReader } from './anamnesis-reader'

afterEach(() => {
  vi.unstubAllGlobals()
})

function stubFetch(): ReturnType<typeof vi.fn> {
  const fetchMock = vi.fn(async () => ({ ok: true, status: 200, json: async () => ({}) }) as Response)
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

function sentHeaders(fetchMock: ReturnType<typeof vi.fn>): Record<string, string> {
  const init = fetchMock.mock.calls[0][1] as RequestInit
  return init.headers as Record<string, string>
}

describe('AnamnesisReader bearer handling (S94 / S89)', () => {
  it('sends the bearer to loopback http', async () => {
    const fetchMock = stubFetch()
    await new AnamnesisReader({ baseUrl: 'http://localhost:9300', authSecret: 'tok' }).checkHealth()
    expect(sentHeaders(fetchMock)['Authorization']).toBe('Bearer tok')
  })

  it('sends the bearer to https', async () => {
    const fetchMock = stubFetch()
    await new AnamnesisReader({ baseUrl: 'https://reader-https.test/', authSecret: 'tok' }).checkHealth()
    expect(sentHeaders(fetchMock)['Authorization']).toBe('Bearer tok')
  })

  it('sends no bearer to plain http on a non-loopback host', async () => {
    const fetchMock = stubFetch()
    await new AnamnesisReader({ baseUrl: 'http://reader-remote.test:9300', authSecret: 'tok' }).checkHealth()
    expect(sentHeaders(fetchMock)['Authorization']).toBeUndefined()
    expect(sentHeaders(fetchMock)['X-Optimaeus-Caller']).toBe('hephaestus')
  })
})
