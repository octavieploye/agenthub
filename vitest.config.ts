// Force the React development bundle so `act` is available (React 19.2 removes
// `act` from the production build, which breaks @testing-library/react's
// renderer when NODE_ENV=production is inherited from the shell).
process.env.NODE_ENV = 'test'

import { defineConfig } from 'vitest/config'
import { resolve } from 'path'

export default defineConfig({
  esbuild: {
    jsx: 'automatic'
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./tests/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}', 'tests/**/*.test.{ts,tsx}', '.llm/**/*.test.ts']
  },
  resolve: {
    alias: {
      '@renderer': resolve('src/renderer/src'),
      '@shared': resolve('src/shared')
    }
  }
})
