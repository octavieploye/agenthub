import { ipcMain, app } from 'electron'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import log from 'electron-log/main'
import { IPC_CHANNELS } from '../../shared/constants/ipc-channels'
import { success, error } from './ipc-helpers'
import type { IpcResponse } from '../../shared/types/ipc.types'
import { extractProjectDetails, buildReplacements, fillPlaceholders } from '../helpers/project-placeholder-fill'

interface ProjectInitResult {
  claudeMdCreated: boolean
  agentsMdCreated: boolean
}

export function registerProjectInitHandlers(): void {
  ipcMain.handle(
    IPC_CHANNELS.PROJECT.INIT,
    async (_event, cwd: unknown): Promise<IpcResponse<ProjectInitResult>> => {
      try {
        if (typeof cwd !== 'string' || !cwd.trim()) {
          return error('INVALID_CWD', 'cwd must be a non-empty string')
        }

        const templateDir  = join(app.getAppPath(), 'templates', 'new-project', '.claude')
        const targetDir    = join(cwd, '.claude')
        const result: ProjectInitResult = { claudeMdCreated: false, agentsMdCreated: false }

        const details      = extractProjectDetails(cwd)
        const replacements = buildReplacements(details)
        log.info('[project:init] extracted details', { name: details.name, description: details.description })

        for (const filename of ['CLAUDE.md', 'agents.md'] as const) {
          const dst = join(targetDir, filename)
          const src = join(templateDir, filename)

          if (!existsSync(src)) {
            log.warn(`[project:init] template not found: ${src}`)
            continue
          }

          mkdirSync(targetDir, { recursive: true })

          if (existsSync(dst)) {
            const current = readFileSync(dst, 'utf8')
            const hasUnfilled = ['[PROJECT_NAME]', '[STACK_BACKEND]', '[KEY_FILES_BLOCK]',
                                  '[PROJECT_RULES_BLOCK]', '[SECURITY_RULES_BLOCK]', '[NEVER_RULES_BLOCK]']
                                  .some(p => current.includes(p))
            if (!hasUnfilled) {
              log.info(`[project:init] ${filename} already complete — skipped`)
              continue
            }
            writeFileSync(dst, fillPlaceholders(current, replacements), 'utf8')
            log.info(`[project:init] filled placeholders in existing ${filename}`)
          } else {
            const template = readFileSync(src, 'utf8')
            writeFileSync(dst, fillPlaceholders(template, replacements), 'utf8')
            log.info(`[project:init] created ${dst}`)
          }

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
