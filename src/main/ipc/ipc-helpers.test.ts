import { describe, it, expect, vi } from 'vitest'

vi.mock('electron-log/main', () => ({
  default: { info: vi.fn(), error: vi.fn(), debug: vi.fn(), warn: vi.fn() }
}))

import { z } from 'zod/v4'
import { success, error, validateInput, wrapHandler } from './ipc-helpers'

describe('IPC Helpers', () => {
  describe('success()', () => {
    it('returns success response with data', () => {
      const resp = success({ id: '123' })
      expect(resp).toEqual({ success: true, data: { id: '123' } })
    })

    it('returns success with undefined for void', () => {
      const resp = success(undefined)
      expect(resp).toEqual({ success: true, data: undefined })
    })
  })

  describe('error()', () => {
    it('returns error response with code and message', () => {
      const resp = error('NOT_FOUND', 'Agent not found')
      expect(resp).toEqual({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Agent not found' }
      })
    })
  })

  describe('validateInput()', () => {
    it('validates valid input', () => {
      const schema = z.object({ name: z.string() })
      const result = validateInput(schema, { name: 'test' })
      expect(result.valid).toBe(true)
      if (result.valid) {
        expect(result.data).toEqual({ name: 'test' })
      }
    })

    it('rejects invalid input', () => {
      const schema = z.object({ name: z.string() })
      const result = validateInput(schema, { name: 123 })
      expect(result.valid).toBe(false)
      if (!result.valid) {
        expect(result.response.success).toBe(false)
        expect(result.response.error.code).toBe('VALIDATION_ERROR')
      }
    })

    it('rejects null input', () => {
      const schema = z.string()
      const result = validateInput(schema, null)
      expect(result.valid).toBe(false)
    })
  })

  describe('wrapHandler()', () => {
    it('wraps successful handler', async () => {
      const handler = wrapHandler('test:channel', () => 42)
      const result = await handler(null)
      expect(result).toEqual({ success: true, data: 42 })
    })

    it('wraps async handler', async () => {
      const handler = wrapHandler('test:async', async () => 'hello')
      const result = await handler(null)
      expect(result).toEqual({ success: true, data: 'hello' })
    })

    it('catches errors and returns error response', async () => {
      const handler = wrapHandler('test:error', () => {
        throw new Error('Something broke')
      })
      const result = await handler(null)
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.code).toBe('HANDLER_ERROR')
        expect(result.error.message).toBe('Something broke')
      }
    })
  })
})
