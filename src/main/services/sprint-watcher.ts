import { watch, existsSync, mkdirSync, readFileSync, unlinkSync, readdirSync, renameSync } from 'fs'
import type { FSWatcher } from 'fs'
import { join } from 'path'
import { randomUUID } from 'crypto'
import log from 'electron-log/main'
import type Database from 'better-sqlite3'
import { insertTask } from '../db/queries/tasks.queries'
import { insertTaskDependency } from '../db/queries/task-dependencies.queries'
import { IPC_EVENTS } from '../../shared/constants/ipc-channels'
import type { SprintIntakePayload, SprintPendingPayload, SprintDraftReadyPayload } from '../../shared/types/task.types'

type EmitFn = (channel: string, payload: unknown) => void

interface PendingEntry {
  pendingId: string
  filePath: string
  projectId: string
  payload: SprintIntakePayload
}

export class SprintWatcher {
  private watcher: FSWatcher | null = null
  private pending = new Map<string, PendingEntry>()

  start(intakeDir: string, emitFn: EmitFn): void {
    if (!existsSync(intakeDir)) mkdirSync(intakeDir, { recursive: true })
    this.startupScan(intakeDir, emitFn)
    this.watcher = watch(intakeDir, (_eventType, filename) => {
      if (!filename) return
      if (filename.match(/^sprint-.+\.draft\.json$/)) {
        const projectId = filename.replace(/^sprint-/, '').replace(/\.draft\.json$/, '')
        const payload: SprintDraftReadyPayload = { projectId, draftFilename: filename }
        emitFn(IPC_EVENTS.KANBAN.DRAFT_READY, payload)
        return
      }
      if (filename.match(/^sprint-.+\.json$/) && !filename.endsWith('.draft.json')) {
        const filePath = join(intakeDir, filename)
        if (!existsSync(filePath)) return
        this.parseAndStage(filename, intakeDir, emitFn)
      }
    })
    log.info('SprintWatcher started', { intakeDir })
  }

  stop(): void {
    this.watcher?.close()
    this.watcher = null
  }

  startupScan(intakeDir: string, emitFn: EmitFn): void {
    if (!existsSync(intakeDir)) return
    const files = readdirSync(intakeDir)
    for (const filename of files) {
      if (!filename.match(/^sprint-.+\.draft\.json$/)) continue
      const projectId = filename.replace(/^sprint-/, '').replace(/\.draft\.json$/, '')
      const payload: SprintDraftReadyPayload = { projectId, draftFilename: filename }
      emitFn(IPC_EVENTS.KANBAN.DRAFT_READY, payload)
      log.info('SprintWatcher: draft found on startup', { filename, projectId })
    }
  }

  confirmDraft(projectId: string, intakeDir: string): void {
    const draftPath = join(intakeDir, `sprint-${projectId}.draft.json`)
    const finalPath = join(intakeDir, `sprint-${projectId}.json`)
    renameSync(draftPath, finalPath)
    log.info('SprintWatcher.confirmDraft: renamed draft to json', { projectId })
    // fs.watch will detect the new .json file and call parseAndStage automatically
  }

  parseAndStage(filename: string, intakeDir: string, emitFn: EmitFn): PendingEntry | null {
    if (filename.endsWith('.draft.json')) return null

    const projectId = filename.replace(/^sprint-/, '').replace(/\.json$/, '')
    const filePath = join(intakeDir, filename)
    let payload: SprintIntakePayload
    try {
      payload = JSON.parse(readFileSync(filePath, 'utf-8')) as SprintIntakePayload
    } catch (err) {
      log.warn('SprintWatcher: failed to parse sprint JSON', { filePath, err })
      return null
    }
    if (!payload.sprintName || !payload.repoId || !Array.isArray(payload.epics)) {
      log.warn('SprintWatcher: invalid sprint JSON structure', { filePath })
      return null
    }
    const errors = validateSprintPayload(payload)
    if (errors.length > 0) {
      log.warn('SprintWatcher: sprint payload failed validation', { filePath, errors })
      return null
    }

    const pendingId = randomUUID()
    const entry: PendingEntry = { pendingId, filePath, projectId, payload }
    this.pending.set(pendingId, entry)

    const taskCount = payload.epics.reduce((n, e) => n + e.tasks.length, 0)
    const dependencyCount = payload.epics.reduce(
      (n, e) => n + e.tasks.reduce((m, t) => m + (t.dependsOn?.length ?? 0), 0),
      0
    )
    const summary: SprintPendingPayload = {
      pendingId,
      sprintName: payload.sprintName,
      projectName: payload.projectName,
      epicCount: payload.epics.length,
      taskCount,
      dependencyCount,
      repoId: payload.repoId
    }
    emitFn(IPC_EVENTS.KANBAN.SPRINT_PENDING, summary)
    log.info('SprintWatcher: sprint staged', { pendingId, sprintName: payload.sprintName, taskCount })
    return entry
  }

  confirm(db: Database.Database, pendingId: string, emitFn: EmitFn): void {
    const entry = this.pending.get(pendingId)
    if (!entry) {
      log.warn('SprintWatcher.confirm: unknown pendingId', { pendingId })
      return
    }
    const { filePath, projectId, payload } = entry

    const repo = db.prepare('SELECT id FROM repos WHERE id = ?').get(payload.repoId)
    if (!repo) {
      throw new Error(
        `Sprint import failed: repoId "${payload.repoId}" does not exist. Re-run the decomposition agent with a valid repo selected.`
      )
    }

    const existing = db
      .prepare('SELECT COUNT(*) as c FROM tasks WHERE sprint_name = ? AND repo_id = ?')
      .get(payload.sprintName, payload.repoId) as { c: number }
    if (existing.c > 0) {
      throw new Error(
        `Sprint "${payload.sprintName}" already has tasks in this repo. Discard this import or rename the sprint before re-importing.`
      )
    }

    // Resolve projectId to null if the project does not exist in the DB (avoids FK violation)
    const projectRow = db.prepare('SELECT id FROM projects WHERE id = ?').get(projectId)
    const resolvedProjectId = projectRow ? projectId : null

    const localIdToRealId = new Map<string, string>()
    for (const epic of payload.epics) {
      for (const story of epic.tasks) {
        const task = insertTask(db, {
          repoId: payload.repoId,
          title: story.title,
          description: story.description,
          priority: story.priority,
          status: 'backlog',
          sprintName: payload.sprintName,
          epicName: epic.name,
          projectId: resolvedProjectId,
          sectionTargetDate: epic.targetDate ?? null
        })
        if (story.localId) localIdToRealId.set(story.localId, task.id)
      }
    }

    for (const epic of payload.epics) {
      for (const story of epic.tasks) {
        if (!story.dependsOn?.length || !story.localId) continue
        const taskId = localIdToRealId.get(story.localId)
        if (!taskId) continue
        for (const depLocalId of story.dependsOn) {
          const dependsOnId = localIdToRealId.get(depLocalId)
          if (dependsOnId) insertTaskDependency(db, taskId, dependsOnId)
        }
      }
    }

    try { unlinkSync(filePath) } catch { /* file already gone */ }
    this.pending.delete(pendingId)
    emitFn(IPC_EVENTS.TASKS.UPDATED, null)
    log.info('SprintWatcher.confirm: sprint inserted', { pendingId, sprintName: payload.sprintName })
  }

  reject(pendingId: string): void {
    const entry = this.pending.get(pendingId)
    if (!entry) return
    try { unlinkSync(entry.filePath) } catch { /* already gone */ }
    this.pending.delete(pendingId)
    log.info('SprintWatcher.reject: sprint rejected', { pendingId })
  }
}

function validateSprintPayload(payload: SprintIntakePayload): string[] {
  const errors: string[] = []
  const localIds = new Set<string>()
  for (const epic of payload.epics) {
    for (const task of epic.tasks) {
      if (![1, 2, 3].includes(task.priority)) {
        errors.push(`Task "${task.title}" has invalid priority ${task.priority} (must be 1, 2, or 3)`)
      }
      if (localIds.has(task.localId)) {
        errors.push(`Duplicate localId "${task.localId}"`)
      }
      localIds.add(task.localId)
    }
  }
  for (const epic of payload.epics) {
    for (const task of epic.tasks) {
      for (const dep of task.dependsOn ?? []) {
        if (!localIds.has(dep)) {
          errors.push(`Task "${task.title}" dependsOn unknown localId "${dep}"`)
        }
      }
    }
  }
  return errors
}
