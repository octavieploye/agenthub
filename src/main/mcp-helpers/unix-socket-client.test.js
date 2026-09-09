import { describe, it, expect } from 'vitest'
import net from 'net'
import { tmpdir } from 'os'
import { join } from 'path'
import { socketRequest } from './unix-socket-client.js'

describe('socketRequest', () => {
  it('successful round-trip', async () => {
    const sockPath = join(tmpdir(), `test-socket-${Date.now()}.sock`)
    const server = net.createServer((conn) => {
      let buf = ''
      conn.on('data', (chunk) => { buf += chunk.toString() })
      conn.on('end', () => {
        const req = JSON.parse(buf)
        conn.write(JSON.stringify({ result: 'ok', echo: req.method }))
        conn.end()
      })
    })
    await new Promise((res) => server.listen(sockPath, res))
    const result = await socketRequest(sockPath, { method: 'ping' })
    expect(result.result).toBe('ok')
    expect(result.echo).toBe('ping')
    server.close()
  })

  it('timeout rejects', async () => {
    const sockPath = join(tmpdir(), `test-socket-${Date.now()}.sock`)
    const server = net.createServer(() => { /* never responds */ })
    await new Promise((res) => server.listen(sockPath, res))
    await expect(socketRequest(sockPath, { method: 'ping' }, 100))
      .rejects.toThrow(/timeout/)
    server.close()
  })

  it('connection refused rejects', async () => {
    const sockPath = join(tmpdir(), `nonexistent-${Date.now()}.sock`)
    await expect(socketRequest(sockPath, { method: 'ping' }, 1000))
      .rejects.toThrow(/socket connection failed/)
  })

  it('malformed response rejects', async () => {
    const sockPath = join(tmpdir(), `test-socket-${Date.now()}.sock`)
    const server = net.createServer((conn) => {
      conn.write('not-json')
      conn.end()
    })
    await new Promise((res) => server.listen(sockPath, res))
    await expect(socketRequest(sockPath, { method: 'ping' }))
      .rejects.toThrow(/invalid JSON response/)
    server.close()
  })
})
