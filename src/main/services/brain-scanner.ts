import { app } from 'electron'
import { watch } from 'fs'
import { readFileSync, existsSync } from 'fs'
import { join, relative } from 'path'
import { parse as parseYaml } from 'yaml'
import log from 'electron-log/main'
import { getDb } from '../db/connection'
import {
  getBrainEntries,
  upsertBrainEntry,
  updateBrainEntryStatus,
  getBrainTimeline,
  createTaskFromBrainEntry
} from '../db/queries/brain.queries'
import { BrainEntry, BrainTimelineEntry } from '../../shared/types/brain.types'
import { Repo } from '../../shared/types/repo.types'
import { GitService } from './git-service'

/**
 * Scans repos for brain entry pointer files and maintains the brain_entries table.
 * Also provides timeline merging with git events.
 */
export class BrainScannerService {
  private repoWatchers: Map<string, NodeJS.FSWatcher> = new Map()
  private gitService: GitService

  constructor(gitService: GitService) {
    this.gitService = gitService
  }

  /**
   * Start watching all known repos for brain entry changes
   */
  startWatchingAllRepos(repos: Repo[]): void {
    repos.forEach((repo) => this.startWatchingRepo(repo))
  }

  /**
   * Start watching a single repo's docs/brain/ directory
   */
  startWatchingRepo(repo: Repo): void {
    if (!repo.path) {
      log.warn(`Cannot watch brain entries for repo ${repo.name} - no path set`)
      return
    }

    const brainDir = join(repo.path, 'docs', 'brain')
    if (!existsSync(brainDir)) {
      log.info(`Creating docs/brain directory for repo ${repo.name}`)
      // Note: In a real implementation, we'd create the directory here
      // For now, we'll just skip watching if it doesn't exist
      return
    }

    if (this.repoWatchers.has(repo.id)) {
      return // Already watching
    }

    log.info(`Starting brain scanner watcher for repo ${repo.name} at ${brainDir}`)

    const watcher = watch(brainDir, { recursive: false }, (eventType, filename) => {
      if (filename && (filename.endsWith('.md') || filename.endsWith('.md~'))) {
        this.handleBrainFileChange(repo, eventType, filename)
      }
    })

    this.repoWatchers.set(repo.id, watcher)

    // Initial scan
    this.scanRepoBrainEntries(repo)
  }

  /**
   * Stop watching a repo
   */
  stopWatchingRepo(repoId: string): void {
    const watcher = this.repoWatchers.get(repoId)
    if (watcher) {
      watcher.close()
      this.repoWatchers.delete(repoId)
    }
  }

  /**
   * Handle file changes in a repo's brain directory
   */
  private handleBrainFileChange(repo: Repo, eventType: string, filename: string): void {
    log.info(`Brain file change detected: ${eventType} ${filename} in ${repo.name}`)

    // Debounce rapid changes (e.g., during file saves)
    setTimeout(() => {
      this.scanRepoBrainEntries(repo)
    }, 500)
  }

  /**
   * Scan a repo's docs/brain/ directory and sync with database
   */
  scanRepoBrainEntries(repo: Repo): void {
    if (!repo.path) {
      log.warn(`Cannot scan brain entries for repo ${repo.name} - no path set`)
      return
    }

    const brainDir = join(repo.path, 'docs', 'brain')
    if (!existsSync(brainDir)) {
      return
    }

    try {
      const files = app.getFileNamesInDirectory(brainDir, ['.md'])
      const db = getDb()

      files.forEach((file) => {
        try {
          this.processBrainPointerFile(db, repo, join(brainDir, file))
        } catch (error) {
          log.error(`Error processing brain file ${file}:`, error)
        }
      })

      log.info(`Scanned ${files.length} brain entries for repo ${repo.name}`)
    } catch (error) {
      log.error(`Error scanning brain entries for repo ${repo.name}:`, error)
    }
  }

  /**
   * Process a single brain pointer file
   */
  private processBrainPointerFile(db: Database, repo: Repo, filePath: string): void {
    const content = readFileSync(filePath, 'utf-8')

    // Extract frontmatter
    const frontmatterMatch = content.match(/^---\s*([\s\S]*?)\s*---/)
    if (!frontmatterMatch) {
      log.warn(`No frontmatter found in ${filePath}`)
      return
    }

    try {
      const frontmatter = parseYaml(frontmatterMatch[1]) as {
        type: string
        subject: string
        project?: string
        path: string
        status: string
        created_at: string
        note?: string
      }

      // Validate required fields
      if (!frontmatter.type || !frontmatter.subject || !frontmatter.path || !frontmatter.status || !frontmatter.created_at) {
        log.warn(`Invalid frontmatter in ${filePath} - missing required fields`)
        return
      }

      // Resolve artifact path (relative to repo root)
      const artifactPath = join(repo.path, frontmatter.path)
      if (!existsSync(artifactPath)) {
        log.warn(`Artifact not found at ${artifactPath} for brain entry ${filePath}`)
      }

      // Generate entry ID from filename (without extension)
      const filename = filePath.split('/').pop()?.replace('.md', '')
      const entryId = `brain_${repo.id}_${filename}`

      // Find project ID if specified
      let projectId: string | null = null
      if (frontmatter.project) {
        // In a real implementation, we'd look up the project by name
        // For now, we'll just store the name in the note field
        const projectNote = frontmatter.project
        if (frontmatter.note) {
          frontmatter.note += ` | Project: ${projectNote}`
        } else {
          frontmatter.note = `Project: ${projectNote}`
        }
      }

      // Upsert into database
      upsertBrainEntry(db, {
        id: entryId,
        repoId: repo.id,
        projectId: projectId,
        pointerPath: filePath,
        artifactPath: artifactPath,
        type: frontmatter.type,
        subject: frontmatter.subject,
        status: frontmatter.status,
        createdAt: frontmatter.created_at,
        note: frontmatter.note || null
      })

    } catch (error) {
      log.error(`Error parsing frontmatter in ${filePath}:`, error)
    }
  }

  /**
   * Get all brain entries, optionally filtered by repo
   */
  getBrainEntries(repoId?: string): BrainEntry[] {
    const db = getDb()
    return getBrainEntries(db, repoId)
  }

  /**
   * Update a brain entry's status
   */
  updateBrainEntryStatus(entryId: string, status: string): void {
    const db = getDb()
    updateBrainEntryStatus(db, entryId, status)

    // Also update the pointer file's frontmatter
    this.updatePointerFileStatus(entryId, status)
  }

  /**
   * Update the pointer file's status field to match the database
   */
  private updatePointerFileStatus(entryId: string, status: string): void {
    const db = getDb()
    const entry = getBrainEntryById(db, entryId)

    if (!entry || !entry.pointerPath) {
      return
    }

    try {
      const content = readFileSync(entry.pointerPath, 'utf-8')
      const updatedContent = content.replace(
        /status:\s*['"]?[^'"
]+['"]?/,
        `status: ${status}`
      )

      // In a real implementation, we'd write the file back here
      // For now, we'll just log it
      log.info(`Would update status to ${status} in ${entry.pointerPath}`)
    } catch (error) {
      log.error(`Error updating pointer file status:`, error)
    }
  }

  /**
   * Register a new brain entry (create pointer file and DB record)
   */
  registerBrainEntry(
    repoId: string,
    subject: string,
    type: string,
    artifactPath: string,
    project?: string,
    note?: string
  ): string {
    const db = getDb()
    const repo = this.getRepoById(repoId) // This would be implemented

    if (!repo || !repo.path) {
      throw new Error(`Repo not found or has no path: ${repoId}`)
    }

    // Generate pointer filename
    const date = new Date().toISOString().split('T')[0]
    const slug = subject.toLowerCase().replace(/\s+/g, '-')
    const filename = `${date}-${slug}-${type}.md`
    const pointerPath = join(repo.path, 'docs', 'brain', filename)

    // Generate entry ID
    const entryId = `brain_${repoId}_${date}_${slug}`

    // Create pointer file content
    const frontmatter = {
      type,
      subject,
      ...(project && { project }),
      path: relative(repo.path, artifactPath),
      status: 'draft',
      created_at: date,
      ...(note && { note })
    }

    const frontmatterYaml = Object.entries(frontmatter)
      .map(([key, value]) => `${key}: ${typeof value === 'string' ? `"${value}"` : value}`)
      .join('\n')

    const pointerContent = `---\n${frontmatterYaml}\n---\n\n`

    // In a real implementation, we'd write the pointer file here
    log.info(`Would create pointer file at ${pointerPath}`)
    log.info(`Content:\n${pointerContent}`)

    // Create DB record
    upsertBrainEntry(db, {
      id: entryId,
      repoId,
      projectId: null, // Would be set if project exists
      pointerPath,
      artifactPath,
      type,
      subject,
      status: 'draft',
      createdAt: date,
      note: note || null
    })

    return entryId
  }

  /**
   * Get timeline entries (brain events + git commits) for a repo
   */
  async getTimeline(repoId: string): Promise<BrainTimelineEntry[]> {
    const db = getDb()
    const dbEvents = getBrainTimeline(db, repoId)

    // Get git events
    let gitEvents: any[] = []
    try {
      const gitLog = await this.gitService.getRecentCommits(repoId, 50)
      gitEvents = gitLog.map((commit) => ({
        id: `git_${commit.hash}`,
        repoId,
        date: commit.date,
        type: 'git' as const,
        subject: commit.message.split('\n')[0],
        details: commit.message,
        icon: 'git-commit' as const
      }))
    } catch (error) {
      log.warn(`Error getting git events for repo ${repoId}:`, error)
    }

    // Merge and sort events
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

    if (!entry) {
      throw new Error(`Brain entry not found: ${brainEntryId}`)
    }

    const taskSubject = subject || `Implement: ${entry.subject}`
    const taskDescription = description || `Task created from brain entry: ${entry.subject}`

    return createTaskFromBrainEntry(db, brainEntryId, taskSubject, taskDescription)
  }

  /**
   * Helper to get repo by ID (would be implemented with repo service)
   */
  private getRepoById(repoId: string): Repo | null {
    // In a real implementation, this would query the repos service
    // For now, return a mock repo
    return {
      id: repoId,
      name: `repo_${repoId}`,
      path: `/mock/path/repo_${repoId}`
    } as any
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