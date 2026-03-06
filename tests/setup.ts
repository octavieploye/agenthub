import '@testing-library/jest-dom/vitest'
import { vi } from 'vitest'

// Mock howler for test environment (no Web Audio API in jsdom)
vi.mock('howler', () => ({
  Howl: vi.fn().mockImplementation(() => ({
    play: vi.fn(),
    volume: vi.fn(),
    stop: vi.fn()
  }))
}))
