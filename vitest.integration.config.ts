import { defineConfig } from 'vitest/config'
import path from 'path'

export default defineConfig({
  test: {
    include: ['src/**/__integration__/**/*.test.ts'],
    testTimeout: 120_000,
    hookTimeout: 60_000,
    reporters: ['verbose'],
    environment: 'node',
    // Run sequentially — Docker resources are shared
    pool: 'forks',
    fileParallelism: false
  },
  resolve: {
    alias: {
      '@shared': path.resolve(__dirname, 'src/shared'),
      '@main': path.resolve(__dirname, 'src/main')
    }
  }
})
