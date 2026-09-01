import { watch, existsSync, mkdirSync, readFileSync, statSync, unlinkSync, readdirSync, renameSync } from 'fs'
import type { FSWatcher } from 'fs'
import { join, dirname, basename } from 'path'
import { randomUUID } from 'crypto'
import log from 'electron-log/main'
import type Database from 'better-sqlite3'
import { insertTask } from '../db/queries/tasks.queries'
import { insertTaskDependency } from '../db/queries/task-dependencies.queries'
import { getRepoExistsById, getSprintTaskCount, getRepoByPath } from '../db/queries/sprint-watcher.queries'
import { IPC_EVENTS } from '../../shared/constants/ipc-channels'
import type { SprintIntakePayload, SprintPendingPayload, SprintDraftReadyPayload } from '../../shared/types/task.types'
import { SprintCardEnricher } from './sprint-card-enricher'
import type { SkillsService } from './skills-service'
import type { TokenBudgetTracker } from './token-budget'

type EmitFn = (channel: string, payload: unknown) => void

interface PendingEntry {
  pendingId: string
  filePath: string
  projectId: string
  payload: SprintIntakePayload
  stagedAt: number
  fromRepo: boolean
}

export class SprintWatcher {
  private watchers: FSWatcher[] = []
  private pending = new Map<string, PendingEntry>()
  private processing = new Set<string>()
  private db: Database.Database | null = null
  private enricher: SprintCardEnricher | null = null

  setEnricher(enricher: SprintCardEnricher): void {
    this.enricher = enricher
  }

  static createEnricher(skillsService: SkillsService, budgetTracker: TokenBudgetTracker): SprintCardEnricher {
    return new SprintCardEnricher(skillsService, budgetTracker)
  }

  start(dirs: string | string[], emitFn: EmitFn, db?: Database.Database): void {
    this.db = db ?? null
    const dirList = Array.isArray(dirs) ? dirs : [dirs]
    for (const dir of dirList) {
      if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
      const isRepoDir = dirList.length > 1 && dir !== dirList[0]
      this.startupScan(dir, emitFn, db, isRepoDir)
      const w = watch(dir, (_eventType, filename) => {
        if (!filename) return
        if (filename.match(/^sprint-.+\.draft\.json$/)) {
          const projectId = filename.replace(/^sprint-/, '').replace(/\.draft\.json$/, '')
          const payload: SprintDraftReadyPayload = { projectId, draftFilename: filename }
          emitFn(IPC_EVENTS.KANBAN.DRAFT_READY, payload)
          return
        }
        if (isIntakeFilename(filename)) {
          const filePath = join(dir, filename)
          if (!existsSync(filePath)) return
          this.parseAndStage(filename, dir, emitFn, isRepoDir)
        }
      })
      this.watchers.push(w)
    }
    log.info('SprintWatcher started', { dirs: dirList })
  }

  stop(): void {
    for (const w of this.watchers) w.close()
    this.watchers = []
  }

  startupScan(intakeDir: string, emitFn: EmitFn, db?: Database.Database, fromRepo = false): void {
    if (!existsSync(intakeDir)) return
    const files = readdirSync(intakeDir)
    for (const filename of files) {
      if (!filename.match(/^sprint-.+\.draft\.json$/)) continue
      const projectId = filename.replace(/^sprint-/, '').replace(/\.draft\.json$/, '')
      const payload: SprintDraftReadyPayload = { projectId, draftFilename: filename }
      emitFn(IPC_EVENTS.KANBAN.DRAFT_READY, payload)
      log.info('SprintWatcher: draft found on startup', { filename, projectId })
    }
    // Also stage any .json files left over from a previous session (crash recovery)
    for (const f of files) {
      if (isIntakeFilename(f)) {
        const filePath = join(intakeDir, f)
        if (!existsSync(filePath)) continue

        // T3: Skip already-imported sprints when db is available
        if (db) {
          try {
            const raw = JSON.parse(readFileSync(filePath, 'utf-8')) as SprintIntakePayload
            if (raw.sprintName && raw.repoId && getSprintTaskCount(db, raw.sprintName, raw.repoId) > 0) {
              log.debug('SprintWatcher: skipping already-imported sprint on startup', { filename: f, sprintName: raw.sprintName })
              continue
            }
          } catch {
            // Parse error — let parseAndStage handle the validation
          }
        }

        this.parseAndStage(f, intakeDir, emitFn, fromRepo)
      }
    }
  }

  confirmDraft(projectId: string, intakeDir: string): void {
    const SAFE_ID_RE = /^[a-zA-Z0-9_-]+$/
    if (!SAFE_ID_RE.test(projectId)) {
      log.warn('SprintWatcher.confirmDraft: invalid projectId rejected', { projectId })
      return
    }
    const draftPath = join(intakeDir, `sprint-${projectId}.draft.json`)
    const finalPath = join(intakeDir, `sprint-${projectId}.json`)
    try {
      renameSync(draftPath, finalPath)
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
        log.info('SprintWatcher.confirmDraft: draft already gone, treating as confirmed', { projectId })
        return
      }
      throw err
    }
    log.info('SprintWatcher.confirmDraft: renamed draft to json', { projectId })
    // fs.watch will detect the new .json file and call parseAndStage automatically
  }

  parseAndStage(filename: string, intakeDir: string, emitFn: EmitFn, fromRepo = false): PendingEntry | null {
    if (filename.endsWith('.draft.json')) return null

    const filePath = join(intakeDir, filename)

    // Fix A — file size guard
    const MAX_FILE_BYTES = 5 * 1024 * 1024 // 5 MB
    try {
      const stat = statSync(filePath)
      if (stat.size > MAX_FILE_BYTES) {
        log.warn('SprintWatcher: intake file too large, skipping', { filePath, bytes: stat.size })
        return null
      }
    } catch {
      return null
    }

    // Fix D — double-fire dedup
    if (this.processing.has(filePath)) return null
    this.processing.add(filePath)
    try {
      this.evictStalePending()

      // T2: Extract projectId from both patterns
      const projectId = extractProjectId(filename)
      let payload: SprintIntakePayload
      try {
        payload = JSON.parse(readFileSync(filePath, 'utf-8')) as SprintIntakePayload
      } catch (err) {
        log.warn('SprintWatcher: failed to parse sprint JSON', { filePath, err })
        return null
      }
      // Resolve repoPath → repoId when repoId is absent
      if (!payload.repoId && payload.repoPath) {
        if (!this.db) {
          log.warn('SprintWatcher: repoPath provided but db not available', { filePath })
          return null
        }
        const resolved = getRepoByPath(this.db, payload.repoPath)
        if (!resolved) {
          log.warn('SprintWatcher: repoPath not found in repos', { repoPath: payload.repoPath, filePath })
          return null
        }
        payload = { ...payload, repoId: resolved }
      }

      if (!payload.sprintName || !payload.repoId || !Array.isArray(payload.epics)) {
        log.warn('SprintWatcher: invalid sprint JSON structure', { filePath })
        return null
      }
      const validationError = validateSprintPayload(payload)
      if (validationError !== null) {
        log.warn('SprintWatcher: sprint payload failed validation', { filePath, error: validationError })
        return null
      }

      const pendingId = randomUUID()
      const entry: PendingEntry = { pendingId, filePath, projectId, payload, stagedAt: Date.now(), fromRepo }
      this.pending.set(pendingId, entry)

      // Auto-confirm: skip the import modal and insert tasks immediately
      if (payload.autoConfirm && this.db) {
        try {
          this.confirm(this.db, pendingId, emitFn)
          if (payload.autoStart) {
            emitFn(IPC_EVENTS.KANBAN.SPRINT_AUTO_START, { sprintName: payload.sprintName, repoId: payload.repoId })
          }
        } catch (err) {
          log.warn('SprintWatcher: auto-confirm failed', { filePath, err: String(err) })
          this.pending.delete(pendingId)
        }
        return entry
      }

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
    } finally {
      this.processing.delete(filePath)
    }
  }

  private evictStalePending(): void {
    const TTL_MS = 30 * 60 * 1000 // 30 minutes
    const now = Date.now()
    for (const [id, entry] of this.pending) {
      if (now - entry.stagedAt > TTL_MS) {
        log.info('SprintWatcher: evicting stale pending entry', { id })
        this.pending.delete(id)
      }
    }
  }

  confirm(db: Database.Database, pendingId: string, emitFn: EmitFn): void {
    const entry = this.pending.get(pendingId)
    if (!entry) {
      log.warn('SprintWatcher.confirm: unknown pendingId', { pendingId })
      return
    }
    const { filePath, projectId, payload } = entry

    if (!payload.repoId) {
      throw new Error('Sprint import failed: repoId could not be resolved')
    }

    if (!getRepoExistsById(db, payload.repoId)) {
      throw new Error(
        `Sprint import failed: repoId "${payload.repoId}" does not exist. Re-run the decomposition agent with a valid repo selected.`
      )
    }

    if (getSprintTaskCount(db, payload.sprintName, payload.repoId) > 0) {
      throw new Error(
        `Sprint "${payload.sprintName}" already has tasks in this repo. Discard this import or rename the sprint before re-importing.`
      )
    }

    // Resolve projectId to null if the project does not exist in the DB (avoids FK violation)
    const projectRow = db.prepare('SELECT id FROM projects WHERE id = ?').get(projectId)
    const resolvedProjectId = projectRow ? projectId : null

    const localIdToRealId = new Map<string, string>()
    db.transaction(() => {
      for (const epic of payload.epics) {
        for (const story of epic.tasks) {
          // Enrich only when the story lacks explicit skills/estimatedTokens (don't overwrite user values)
          const needsEnrichment =
            this.enricher !== null &&
            (!story.skills || story.skills.length === 0) &&
            story.estimatedTokens == null

          let enrichedSkillsJson: string | undefined = story.skills ? JSON.stringify(story.skills) : undefined
          let enrichedEstimatedTokens: number | undefined = story.estimatedTokens
          let enrichedRecommendedModel: string | undefined = story.recommendedModel
          let enrichedRiskScore: number | undefined = story.riskScore

          if (needsEnrichment) {
            try {
              const enriched = this.enricher!.enrich(
                story.title,
                story.description ?? '',
                story.targetFiles ?? [],
                payload.repoId!
              )
              if (enriched.skills.length > 0) {
                enrichedSkillsJson = JSON.stringify(enriched.skills)
              }
              enrichedEstimatedTokens = enriched.estimatedTokens
              if (enriched.recommendedModel) {
                enrichedRecommendedModel = enriched.recommendedModel
              }
              enrichedRiskScore = enriched.riskScore
            } catch (err) {
              log.warn('SprintWatcher.confirm: enrichment failed, inserting without enrichment', {
                title: story.title,
                err: String(err),
              })
            }
          }

          const task = insertTask(db, {
            repoId: payload.repoId,
            title: story.title,
            description: story.description,
            priority: story.priority,
            status: 'backlog',
            category: story.category ?? null,
            sprintName: payload.sprintName,
            epicName: epic.name,
            projectId: resolvedProjectId,
            sectionTargetDate: epic.targetDate ?? null,
            requiresApproval: payload.preApproveAll ? false : (story.requiresApproval ?? false),
            modelOverride: story.modelOverride,
            providerOverride: story.providerOverride,
            skillsJson: enrichedSkillsJson,
            targetFilesJson: story.targetFiles ? JSON.stringify(story.targetFiles) : undefined,
            estimatedTokens: enrichedEstimatedTokens,
            recommendedModel: enrichedRecommendedModel,
            riskScore: enrichedRiskScore,
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
    })()

    if (entry.fromRepo) {
      // Archive repo sprint files to json-archive/ — prevents re-detection on next app start
      const archiveDir = join(dirname(filePath), '..', 'json-archive')
      try {
        if (!existsSync(archiveDir)) mkdirSync(archiveDir, { recursive: true })
        renameSync(filePath, join(archiveDir, basename(filePath)))
      } catch (err) {
        log.warn('SprintWatcher: failed to archive sprint file', { filePath, err: String(err) })
      }
    } else {
      try { unlinkSync(filePath) } catch { /* file already gone */ }
    }
    this.pending.delete(pendingId)
    emitFn(IPC_EVENTS.TASKS.UPDATED, null)
    log.info('SprintWatcher.confirm: sprint inserted', { pendingId, sprintName: payload.sprintName })
  }

  reject(pendingId: string): void {
    const entry = this.pending.get(pendingId)
    if (!entry) return
    // T4: Do not delete repo files on reject
    if (!entry.fromRepo) {
      try { unlinkSync(entry.filePath) } catch { /* already gone */ }
    }
    this.pending.delete(pendingId)
    log.info('SprintWatcher.reject: sprint rejected', { pendingId })
  }
}

/** Match both sprint-*.json (userData) and *-sprint-intake.json (repo) patterns */
function isIntakeFilename(filename: string): boolean {
  if (filename.endsWith('.draft.json')) return false
  if (/^sprint-.+\.json$/.test(filename)) return true
  if (/-sprint-intake\.json$/.test(filename)) return true
  return false
}

/** Extract projectId from both filename patterns */
function extractProjectId(filename: string): string {
  if (/-sprint-intake\.json$/.test(filename)) {
    return filename.replace(/-sprint-intake\.json$/, '')
  }
  return filename.replace(/^sprint-/, '').replace(/\.json$/, '')
}

function validateSprintPayload(payload: SprintIntakePayload): string | null {
  // Fix B — length caps
  if (payload.sprintName.length > 200) return 'sprintName exceeds 200 characters'
  if ((payload.projectName?.length ?? 0) > 200) return 'projectName exceeds 200 characters'
  if (payload.epics.length > 50) return 'too many epics (max 50)'

  let totalTasks = 0
  for (const epic of payload.epics) {
    if (epic.name.length > 200) return `epic name exceeds 200 characters: "${epic.name.slice(0, 50)}"`
    totalTasks += epic.tasks.length
    if (totalTasks > 200) return 'too many tasks (max 200 across all epics)'
    for (const task of epic.tasks) {
      if (task.title.length > 500) return `task title exceeds 500 characters: "${task.title.slice(0, 50)}"`
      if ((task.description?.length ?? 0) > 10_000) return `task description exceeds 10000 characters for task "${task.title.slice(0, 50)}"`
    }
  }

  // Validate epic targetDate format
  const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/
  for (const epic of payload.epics) {
    if (epic.targetDate && !ISO_DATE_RE.test(epic.targetDate)) {
      return `Epic "${epic.name}" has invalid targetDate "${epic.targetDate}" (expected YYYY-MM-DD)`
    }
  }

  // Existing structural checks
  const localIds = new Set<string>()
  for (const epic of payload.epics) {
    for (const task of epic.tasks) {
      if (![1, 2, 3].includes(task.priority)) {
        return `Task "${task.title}" has invalid priority ${task.priority} (must be 1, 2, or 3)`
      }
      if (localIds.has(task.localId)) {
        return `Duplicate localId "${task.localId}"`
      }
      localIds.add(task.localId)
    }
  }
  for (const epic of payload.epics) {
    for (const task of epic.tasks) {
      for (const dep of task.dependsOn ?? []) {
        if (!localIds.has(dep)) {
          return `Task "${task.title}" dependsOn unknown localId "${dep}"`
        }
      }
    }
  }
  return null
}
