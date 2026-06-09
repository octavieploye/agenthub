import { ipcMain, app } from 'electron'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import log from 'electron-log/main'
import { IPC_CHANNELS } from '../../shared/constants/ipc-channels'
import { success, error } from './ipc-helpers'
import type { IpcResponse } from '../../shared/types/ipc.types'

interface ProjectInitResult {
  claudeMdCreated: boolean
  agentsMdCreated: boolean
}

export function registerProjectHandlers(): void {
  ipcMain.handle(
    IPC_CHANNELS.PROJECT.INIT,
    async (_event, cwd: unknown): Promise<IpcResponse<ProjectInitResult>> => {
      try {
        if (typeof cwd !== 'string' || !cwd.trim()) {
          return error('INVALID_CWD', 'cwd must be a non-empty string')
        }

        const templateDir = join(app.getAppPath(), 'templates', 'new-project', '.claude')
        const targetDir   = join(cwd, '.claude')
        const result: ProjectInitResult = { claudeMdCreated: false, agentsMdCreated: false }

        for (const filename of ['CLAUDE.md', 'agents.md'] as const) {
          const dst = join(targetDir, filename)
          const src = join(templateDir, filename)

          if (existsSync(dst)) {
            log.info(`[project:init] ${filename} already exists — skipped`)
            continue
          }
          if (!existsSync(src)) {
            log.warn(`[project:init] template not found: ${src}`)
            continue
          }

          mkdirSync(targetDir, { recursive: true })
          writeFileSync(dst, readFileSync(src))
          log.info(`[project:init] created ${dst}`)

          if (filename === 'CLAUDE.md') result.claudeMdCreated = true
          else result.agentsMdCreated = true
        }

        return success(result)
      } catch (err) {
        log.error('[project:init] failed', err)
        return error('PROJECT_INIT_ERROR', err instanceof Error ? err.message : String(err))
      }
    }
  )

  log.info('Project IPC handlers registered')
}
