import { readFileSync, readdirSync, existsSync, statSync, mkdirSync, writeFileSync } from 'fs'
import { join, relative, basename, extname } from 'path'
import log from 'electron-log/main'
import { getDb } from '../db/connection'
import {
  getBrainEntries,
  getBrainEntryById,
  upsertBrainEntry,
  updateBrainEntryStatus,
  getBrainTimeline,
  createTaskFromBrainEntry
} from '../db/queries/brain.queries'
import {
  BrainEntry,
  BrainEntryType,
  BrainTimelineEntry,
  RegisterBrainEntryInput
} from '../../shared/types/brain.types'
import { RepoConfig } from '../../shared/types/config.types'
import { getRepoById, getAllRepos } from '../db/queries/repos.queries'
import { GitService } from './git-service'

/** Parse markdown checklist items from file content. */
export function parseChecklist(content: string): { total: number; done: number } {
  const done = (content.match(/- \[[xX]\]/g) || []).length
  const remaining = (content.match(/- \[ \]/g) || []).length
  return { total: done + remaining, done }
}

/**
 * Returns true if any commit after docDate has a [Refs] footer line
 * that explicitly references this artifact's slug (filename without extension).
 *
 * Format git-ops must use: [Refs]        <slug>[#section], <slug2>[#task-N]
 * Example: [Refs]        2026-07-06-brain-status-filter, 2026-07-03-llm-mirror#section-2
 *
 * gitLog must be pre-fetched (not fetched here — keeps this function pure).
 */
export function detectGitSignal(
  gitLog: { message: string; date: string }[],
  docDate: string,
  slug: string
): boolean {
  const laterCommits = gitLog.filter(c => c.date > docDate)
  const slugLower = slug.toLowerCase()

  return laterCommits.some(commit => {
    const refsMatch = commit.message.match(/^\[Refs\]\s+(.+)$/mi)
    if (!refsMatch) return false
    const refs = refsMatch[1].split(',').map(r => r.trim().split('#')[0].trim().toLowerCase())
    return refs.includes(slugLower)
  })
}

/** Derive computed status from checklist counts, git signal, and file content. */
export function deriveComputedStatus(
  total: number,
  done: number,
  gitSignal: boolean,
  fileContent: string
): 'remaining' | 'in_progress' | 'done' {
  if (total > 0 && done === total) return 'done'
  if (/^#+\s*status:\s*(implemented|done)|\*\*status:\*\*\s*(implemented|done)/im.test(fileContent)) return 'done'
  if (done > 0) return 'in_progress'
  if (gitSignal) return 'in_progress'  // structured [Refs] commit link (see git-commit.md)
  return 'remaining'
}

/**
 * Directory patterns to scan for artifacts.
 * Each maps a relative directory path to a brain entry type.
 * Directories are scanned recursively for .md files.
 */
const ARTIFACT_SCAN_RULES: { dir: string; type: BrainEntryType; recursive: boolean }[] = [
  { dir: 'docs/superpowers/specs',    type: 'spec',       recursive: false },
  { dir: 'docs/superpowers/plans',    type: 'plan',       recursive: false },
  { dir: 'docs/superpowers/strategy', type: 'strategy',   recursive: false },
  { dir: 'docs/brainstorm',           type: 'brainstorm',  recursive: true  },
  { dir: 'docs/how-to',              type: 'how-to',      recursive: false },
  { dir: 'docs/marketing',           type: 'marketing',    recursive: true  },
  { dir: 'docs/business-strategy',   type: 'strategy',    recursive: false },
  { dir: 'docs/ai-engineering',      type: 'reference',   recursive: false },
  { dir: 'docs/learnings',           type: 'learning',    recursive: false },
  // Architecture repo patterns
  { dir: 'brainstorm',                type: 'brainstorm',  recursive: true  },
  { dir: 'development-stack',         type: 'reference',   recursive: true  },
  { dir: 'monetize',                  type: 'strategy',    recursive: true  },
  { dir: 'marketing-launch-strategy', type: 'marketing',   recursive: false },
  { dir: 'ai-team-expert/learnings',  type: 'learning',    recursive: false },
  { dir: 'ai-team-expert/audits',     type: 'reference',   recursive: false },
  { dir: 'TODOS',                     type: 'plan',        recursive: true  },
  { dir: 'TODO',                      type: 'plan',        recursive: true  },
]

/**
 * Extract a human-readable subject from a markdown filename.
 * "2026-07-03-deep-reasoning-package-design.md" → "Deep Reasoning Package Design"
 */
function subjectFromFilename(filename: string): string {
  const name = basename(filename, extname(filename))
  // Strip leading date prefix (YYYY-MM-DD-)
  const stripped = name.replace(/^\d{4}-\d{2}-\d{2}-/, '')
  // Strip leading numbered prefix (01-, 02-, etc.)
  const cleaned = stripped.replace(/^\d{1,3}-/, '')
  return cleaned
    .split('-')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')
}

/**
 * Recursively collect .md files from a directory.
 */
function collectMdFiles(dir: string, recursive: boolean): string[] {
  if (!existsSync(dir)) return []
  const results: string[] = []
  try {
    const entries = readdirSync(dir, { withFileTypes: true })
    for (const entry of entries) {
      const fullPath = join(dir, entry.name)
      if (entry.isFile() && entry.name.endsWith('.md')) {
        results.push(fullPath)
      } else if (entry.isDirectory() && recursive) {
        results.push(...collectMdFiles(fullPath, true))
      }
    }
  } catch {
    // Permission errors etc — skip silently
  }
  return results
}

/**
 * Scans repos for artifact .md files in known directories and maintains the brain_entries table.
 * Also provides timeline merging with git events.
 */
export class BrainScannerService {
  private gitService: GitService

  constructor(gitService: GitService) {
    this.gitService = gitService
  }

  /**
   * Auto-discover and register all artifacts across all known repos.
   * Called on brain panel refresh.
   */
  discoverAllArtifacts(): { discovered: number; repos: number } {
    const db = getDb()
    const repos = getAllRepos(db)
    let totalDiscovered = 0

    for (const repo of repos) {
      if (!repo.path) continue
      totalDiscovered += this.discoverRepoArtifacts(repo)
    }

    // Promote any existing entries that are computed-done but still showing as active.
    // Only promotes 'active' → 'implemented'; leaves 'parked' and other manual statuses alone.
    const promoted = db.prepare(`
      UPDATE brain_entries
      SET status = 'implemented', updated_at = datetime('now')
      WHERE computed_status = 'done' AND status = 'active'
    `).run()

    if (promoted.changes > 0) {
      log.info(`Brain auto-discovery: promoted ${promoted.changes} entries to implemented`)
    }

    log.info(`Brain auto-discovery: found ${totalDiscovered} artifacts across ${repos.length} repos`)
    return { discovered: totalDiscovered, repos: repos.length }
  }

  /**
   * Auto-discover artifacts in a single repo by scanning known directories.
   */
  discoverRepoArtifacts(repo: RepoConfig): number {
    if (!repo.path || !existsSync(repo.path)) return 0

    const db = getDb()

    // Fetch git log once per repo — passed to detectGitSignal for each file
    let repoGitLog: { message: string; date: string }[] = []
    try {
      repoGitLog = this.gitService.getLog(repo.path, 200).map(c => ({
        message: c.message,
        date: c.date
      }))
    } catch {
      // git unavailable — git_signal stays 0
    }

    let count = 0

    for (const rule of ARTIFACT_SCAN_RULES) {
      const scanDir = join(repo.path, rule.dir)
      if (!existsSync(scanDir)) continue

      const mdFiles = collectMdFiles(scanDir, rule.recursive)
      for (const filePath of mdFiles) {
        try {
          // Skip very small files (likely empty or just frontmatter)
          const stat = statSync(filePath)
          if (stat.size < 20) continue

          const relPath = relative(repo.path, filePath)
          const entryId = `auto_${repo.id}_${relPath.replace(/[^a-zA-Z0-9]/g, '_')}`

          // Extract date from filename if present
          const dateMatch = basename(filePath).match(/^(\d{4}-\d{2}-\d{2})/)
          const createdAt = dateMatch ? dateMatch[1] : stat.birthtime.toISOString().split('T')[0]
          const subject = subjectFromFilename(filePath)
          const slug = basename(filePath, extname(filePath))

          // Read content once — used for both checklist parsing and computed status
          let fileContent = ''
          try { fileContent = readFileSync(filePath, 'utf-8') } catch { /* skip */ }

          const checklist = parseChecklist(fileContent)
          const gitSignalBool = detectGitSignal(repoGitLog, createdAt, slug)
          const computedStatus = deriveComputedStatus(checklist.total, checklist.done, gitSignalBool, fileContent)

          upsertBrainEntry(db, {
            id: entryId,
            repoId: repo.id,
            projectId: null,
            pointerPath: filePath,
            artifactPath: filePath,
            type: rule.type,
            subject,
            // Auto-promote to implemented on first insert if already done.
            // ON CONFLICT(id) excludes status, so existing manual overrides are never touched.
            status: computedStatus === 'done' ? 'implemented' : 'active',
            createdAt,
            note: `Auto-discovered from ${rule.dir}/`,
            computedStatus,
            checklistTotal: checklist.total,
            checklistDone: checklist.done,
            gitSignal: gitSignalBool ? 1 : 0,
          })
          count++
        } catch (error) {
          log.warn(`Brain discovery: skipping ${filePath}: ${error}`)
        }
      }
    }

    if (count > 0) {
      log.info(`Brain discovery: registered ${count} artifacts in ${repo.name}`)
    }
    return count
  }

  /**
   * Get all brain entries, optionally filtered by repo and/or type.
   */
  getBrainEntries(repoId?: string): BrainEntry[] {
    const db = getDb()
    return getBrainEntries(db, repoId)
  }

  /**
   * Register an artifact manually by creating its pointer file and database row.
   */
  registerBrainEntry(input: RegisterBrainEntryInput): string {
    const db = getDb()
    const repo = getRepoById(db, input.repoId)
    if (!repo?.path) {
      throw new Error(`Repo not found or has no path: ${input.repoId}`)
    }

    const date = new Date().toISOString().split('T')[0]
    const slug =
      input.subject
        .normalize('NFKD')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '') || 'artifact'
    const brainDir = join(repo.path, 'docs', 'brain')
    const pointerPath = join(brainDir, `${date}-${slug}-${input.type}.md`)
    const entryId = `brain_${input.repoId}_${date}_${slug}`

    const frontmatter: Record<string, string> = {
      type: input.type,
      subject: input.subject,
      ...(input.project ? { project: input.project } : {}),
      path: relative(repo.path, input.artifactPath),
      status: 'draft',
      created_at: date,
      ...(input.note ? { note: input.note } : {})
    }
    const pointerContent = `---\n${Object.entries(frontmatter)
      .map(([key, value]) => `${key}: ${JSON.stringify(value)}`)
      .join('\n')}\n---\n`

    mkdirSync(brainDir, { recursive: true })
    writeFileSync(pointerPath, pointerContent, 'utf-8')

    upsertBrainEntry(db, {
      id: entryId,
      repoId: input.repoId,
      projectId: null,
      pointerPath,
      artifactPath: input.artifactPath,
      type: input.type,
      subject: input.subject,
      status: 'draft',
      createdAt: date,
      note: input.note ?? null
    })

    log.info('Brain artifact registered', { entryId, repoId: input.repoId, pointerPath })
    return entryId
  }

  /**
   * Update a brain entry's status
   */
  updateBrainEntryStatus(entryId: string, status: string): void {
    const db = getDb()
    updateBrainEntryStatus(db, entryId, status)
  }

  /**
   * Get timeline entries (brain events + git commits) for a repo
   */
  async getTimeline(repoId: string): Promise<BrainTimelineEntry[]> {
    const db = getDb()
    const dbEvents = getBrainTimeline(db, repoId)

    // Get git events
    let gitEvents: BrainTimelineEntry[] = []
    try {
      const repo = getRepoById(db, repoId)
      if (repo?.path) {
        const gitLog = this.gitService.getLog(repo.path, 50)
        gitEvents = gitLog.map((commit) => ({
          id: `git_${commit.hash}`,
          repoId,
          date: commit.date,
          type: 'git' as const,
          subject: commit.message.split('\n')[0],
          details: commit.message,
          icon: 'git-commit' as const
        }))
      }
    } catch (error) {
      log.warn(`Error getting git events for repo ${repoId}:`, error)
    }

    const allEvents = [...dbEvents, ...gitEvents]
    allEvents.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    return allEvents
  }

  /**
   * Create a task linked to a brain entry
   */
  createTaskFromBrainEntry(brainEntryId: string, subject?: string, description?: string): string {
    const db = getDb()
    const entry = getBrainEntryById(db, brainEntryId)
    if (!entry) throw new Error(`Brain entry not found: ${brainEntryId}`)

    const taskTitle = subject || `Implement: ${entry.subject}`
    const taskDescription = description || `Task created from brain entry: ${entry.subject}`
    return createTaskFromBrainEntry(db, brainEntryId, entry.repoId, taskTitle, taskDescription)
  }
}

// Singleton instance
let brainScannerInstance: BrainScannerService | null = null

export function getBrainScanner(): BrainScannerService {
  if (!brainScannerInstance) {
    throw new Error('BrainScannerService not initialized')
  }
  return brainScannerInstance
}

export function initBrainScanner(gitService: GitService): BrainScannerService {
  brainScannerInstance = new BrainScannerService(gitService)
  return brainScannerInstance
}
