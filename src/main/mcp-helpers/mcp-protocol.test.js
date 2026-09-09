import { describe, it, expect, vi } from 'vitest'
import { mcpResponse, mcpError } from './mcp-protocol.js'

describe('mcpResponse', () => {
  it('writes valid JSON-RPC 2.0 response to stdout', () => {
    const write = vi.spyOn(process.stdout, 'write').mockImplementation(() => true)
    mcpResponse(1, { data: 'hello' })
    const written = JSON.parse(write.mock.calls[0][0])
    expect(written).toEqual({ jsonrpc: '2.0', id: 1, result: { data: 'hello' } })
    write.mockRestore()
  })
})

describe('mcpError', () => {
  it('writes error format to stdout', () => {
    const write = vi.spyOn(process.stdout, 'write').mockImplementation(() => true)
    mcpError(2, -32601, 'Method not found')
    const written = JSON.parse(write.mock.calls[0][0])
    expect(written).toEqual({ jsonrpc: '2.0', id: 2, error: { code: -32601, message: 'Method not found' } })
    write.mockRestore()
  })
})
