import { resolve } from 'path'
import { defineConfig } from 'electron-vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { cpSync, mkdirSync } from 'fs'
import { build as esbuild } from 'esbuild'

function copyMigrations() {
  return {
    name: 'copy-migrations',
    closeBundle() {
      const src = resolve('src/main/db/migrations')
      const dest = resolve('out/main/migrations')
      mkdirSync(dest, { recursive: true })
      cpSync(src, dest, { recursive: true })
    }
  }
}

function buildMcpServer() {
  return {
    name: 'build-mcp-server',
    async closeBundle() {
      await esbuild({
        entryPoints: [resolve('src/main/mcp-server/server.ts')],
        bundle: true,
        platform: 'node',
        target: 'node20',
        format: 'cjs',
        outfile: resolve('out/main/mcp-server/server.js'),
        external: ['better-sqlite3'],
        alias: { '@shared': resolve('src/shared') },
        sourcemap: false,
        minify: false,
        logLevel: 'warning',
      })
    },
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
    plugins: [copyMigrations(), buildMcpServer()]
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
