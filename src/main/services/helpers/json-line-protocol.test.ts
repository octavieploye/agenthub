import { describe, it, expect, vi } from 'vitest'
import { createJsonLineParser } from './json-line-protocol'

describe('createJsonLineParser', () => {
  it('parses a single complete message', () => {
    const onMessage = vi.fn()
    const parser = createJsonLineParser(onMessage)
    parser(Buffer.from('{"id":"1","method":"ping"}\n'))
    expect(onMessage).toHaveBeenCalledWith({ id: '1', method: 'ping' })
  })

  it('buffers partial chunks until newline', () => {
    const onMessage = vi.fn()
    const parser = createJsonLineParser(onMessage)
    parser(Buffer.from('{"id":"1"'))
    expect(onMessage).not.toHaveBeenCalled()
    parser(Buffer.from(',"method":"ping"}\n'))
    expect(onMessage).toHaveBeenCalledWith({ id: '1', method: 'ping' })
  })

  it('handles multiple messages in one chunk', () => {
    const onMessage = vi.fn()
    const parser = createJsonLineParser(onMessage)
    parser(Buffer.from('{"id":"1"}\n{"id":"2"}\n'))
    expect(onMessage).toHaveBeenCalledTimes(2)
    expect(onMessage).toHaveBeenNthCalledWith(1, { id: '1' })
    expect(onMessage).toHaveBeenNthCalledWith(2, { id: '2' })
  })

  it('calls onError for malformed JSON', () => {
    const onMessage = vi.fn()
    const onError = vi.fn()
    const parser = createJsonLineParser(onMessage, onError)
    parser(Buffer.from('not-valid-json\n'))
    expect(onMessage).not.toHaveBeenCalled()
    expect(onError).toHaveBeenCalledWith('not-valid-json', expect.any(SyntaxError))
  })

  it('skips empty lines', () => {
    const onMessage = vi.fn()
    const parser = createJsonLineParser(onMessage)
    parser(Buffer.from('\n\n{"id":"1"}\n\n'))
    expect(onMessage).toHaveBeenCalledTimes(1)
  })
})
