import { resolve } from 'path'
import { defineConfig } from 'electron-vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { cpSync, mkdirSync } from 'fs'

function copyMainRuntimeAssets() {
  return {
    name: 'copy-main-runtime-assets',
    closeBundle() {
      const assets = [
        ['src/main/db/migrations', 'out/main/migrations'],
        ['src/main/mcp-bridge-server', 'out/main/mcp-bridge-server'],
        ['src/main/mcp-helpers', 'out/main/mcp-helpers'],
        ['src/main/telegram-sidecar', 'out/main/telegram-sidecar'],
      ]

      for (const [source, destination] of assets) {
        const dest = resolve(destination)
        mkdirSync(dest, { recursive: true })
        cpSync(resolve(source), dest, { recursive: true })
      }
    }
  }
}

export default defineConfig({
  main: {
    resolve: {
      alias: {
        '@shared': resolve('src/shared')
      }
    },
    build: {
      rollupOptions: {
        external: ['node-pty', 'better-sqlite3']
      }
    },
    plugins: [copyMainRuntimeAssets()]
  },
  preload: {
    resolve: {
      alias: {
        '@shared': resolve('src/shared')
      }
    },
    build: {
      rollupOptions: {
        external: ['node-pty', 'better-sqlite3']
      }
    }
  },
  renderer: {
    publicDir: resolve('resources'),
    resolve: {
      alias: {
        '@renderer': resolve('src/renderer/src'),
        '@shared': resolve('src/shared')
      }
    },
    plugins: [tailwindcss(), react()]
  }
})
