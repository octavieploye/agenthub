import { describe, it, expect, vi, afterEach } from 'vitest'
import log from 'electron-log/main'
import { resolveAnamnesisAuthHeaders } from './anamnesis-bearer'

afterEach(() => {
  vi.restoreAllMocks()
})

describe('resolveAnamnesisAuthHeaders (S94 / S89)', () => {
  it('returns the bearer header for https', () => {
    expect(resolveAnamnesisAuthHeaders('https://bearer-https.test', 'tok')).toEqual({ Authorization: 'Bearer tok' })
  })

  it.each(['http://localhost:9300', 'http://127.0.0.1:9300', 'http://[::1]:9300'])(
    'returns the bearer header for loopback http %s',
    (url) => {
      expect(resolveAnamnesisAuthHeaders(url, 'tok')).toEqual({ Authorization: 'Bearer tok' })
    }
  )

  it('returns no header for plain http on a non-loopback host and warns', () => {
    const warn = vi.spyOn(log, 'warn').mockImplementation(() => undefined)

    expect(resolveAnamnesisAuthHeaders('http://bearer-remote-http.test:9300', 'tok')).toEqual({})
    expect(warn).toHaveBeenCalledTimes(1)
    expect(JSON.stringify(warn.mock.calls)).not.toContain('tok')
  })

  it('warns only once per URL', () => {
    const warn = vi.spyOn(log, 'warn').mockImplementation(() => undefined)

    resolveAnamnesisAuthHeaders('http://bearer-once.test:9300', 'tok')
    resolveAnamnesisAuthHeaders('http://bearer-once.test:9300', 'tok')

    expect(warn).toHaveBeenCalledTimes(1)
  })

  it('returns no header and warns for an unparseable URL', () => {
    const warn = vi.spyOn(log, 'warn').mockImplementation(() => undefined)

    expect(resolveAnamnesisAuthHeaders('not a url', 'tok')).toEqual({})
    expect(warn).toHaveBeenCalledTimes(1)
  })

  it('returns no header and no warning when there is no secret', () => {
    const warn = vi.spyOn(log, 'warn').mockImplementation(() => undefined)

    expect(resolveAnamnesisAuthHeaders('http://bearer-nosecret.test', '')).toEqual({})
    expect(resolveAnamnesisAuthHeaders('http://bearer-nosecret.test', undefined)).toEqual({})
    expect(warn).not.toHaveBeenCalled()
  })

  it('does not treat loopback in the userinfo as loopback', () => {
    vi.spyOn(log, 'warn').mockImplementation(() => undefined)

    expect(resolveAnamnesisAuthHeaders('http://localhost@bearer-userinfo.test:9300', 'tok')).toEqual({})
  })
})
