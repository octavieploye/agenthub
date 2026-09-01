import { readdirSync, readFileSync, existsSync, statSync } from 'fs'
import { execFile } from 'child_process'
import { join, basename, dirname, relative, extname } from 'path'
import { homedir } from 'os'
import { parse as yamlParse } from 'yaml'
import type { SkillItem, SkillExecutionResult, SkillManifest } from '../../shared/types/skills.types'

export const SUPPORTED_SKILL_EXTENSIONS = ['.md', '.sh', '.py', '.js']

// Meta-files at the skills root that are not skills themselves
const SKIP_ROOT_FILENAMES = new Set(['index.md', 'README.md', 'MEMORY.md'])

// Category assigned to each workflow folder name (fallback: 'workflows')
const WORKFLOW_CATEGORIES: Record<string, string> = {
  business: 'business-research',
  marketing: 'business-venture',
  data: 'business-analysis',
  brain: 'business-analysis',
  brainstorm: 'business-venture',
  'tech-brainstorm': 'dev-skills',
  stats: 'business-modeling',
  'ux-challenge': 'dev-skills',
}

export interface SkillsServiceDeps {
  logInfo: (message: string, meta?: Record<string, unknown>) => void
  logWarning: (message: string, meta?: Record<string, unknown>) => void
  agenthubPath?: string
  /** Override for the globally installed plugin path (mainly for testing). Defaults to ~/.claude/plugins/agenthub */
  globalPluginPath?: string
}

interface DisplayRegistry {
  categories: Record<string, string>
  items: Record<string, { displayName: string; category: string }>
}

export class SkillsService {
  private deps: SkillsServiceDeps
  private cache: Map<string, SkillItem[]> = new Map()

  constructor(deps: SkillsServiceDeps) {
    this.deps = deps
  }

  listSkills(repoPath?: string): SkillItem[] {
    const cacheKey = repoPath ?? '__global__'
    const cached = this.cache.get(cacheKey)
    if (cached) return cached

    const skills = this.scanSkills(repoPath)
    this.cache.set(cacheKey, skills)
    return skills
  }

  refresh(repoPath?: string): SkillItem[] {
    const cacheKey = repoPath ?? '__global__'
    this.cache.delete(cacheKey)
    return this.listSkills(repoPath)
  }

  async executeSkill(skillId: string, repoPath?: string): Promise<SkillExecutionResult> {
    const skills = this.listSkills(repoPath)
    const skill = skills.find((s) => s.id === skillId)
    if (!skill) {
      return { skillId, output: `Skill not found: ${skillId}`, exitCode: 1, duration: 0 }
    }

    const ext = extname(skill.path)
    const startTime = Date.now()

    return new Promise<SkillExecutionResult>((resolve) => {
      let command: string
      let args: string[]

      if (ext === '.sh') {
        command = 'bash'
        args = [skill.path]
      } else if (ext === '.py') {
        command = 'python3'
        args = [skill.path]
      } else if (ext === '.js') {
        command = 'node'
        args = [skill.path]
      } else {
        // .md — use command override if present, otherwise use file content
        let content: string
        if (skill.command) {
          const commandSkill = skills.find((s) => s.id === skill.command)
          content = commandSkill ? readFileSync(commandSkill.path, 'utf-8') : `/${skill.command}`
        } else {
          content = readFileSync(skill.path, 'utf-8')
        }
        command = 'claude'
        args = ['--print', '-p', content]
      }

      const options: { cwd?: string; timeout: number; encoding: BufferEncoding } = {
        timeout: 60_000,
        encoding: 'utf-8'
      }
      if (repoPath) options.cwd = repoPath

      execFile(command, args, options, (err, stdout, stderr) => {
        const duration = Date.now() - startTime
        if (err) {
          const exitCode = (err as NodeJS.ErrnoException & { code?: number }).code
            ? 1
            : (err as { code?: number }).code ?? 1
          this.deps.logWarning('Skill execution failed', { skillId, error: err.message })
          resolve({
            skillId,
            output: stderr || err.message,
            exitCode: typeof exitCode === 'number' ? exitCode : 1,
            duration
          })
        } else {
          this.deps.logInfo('Skill executed', { skillId, duration })
          resolve({ skillId, output: stdout, exitCode: 0, duration })
        }
      })
    })
  }

  private scanSkills(repoPath?: string): SkillItem[] {
    const skills: SkillItem[] = []
    const agenthubPath = this.deps.agenthubPath
    const isAgentHub = agenthubPath && repoPath && this.normalizePath(repoPath) === this.normalizePath(agenthubPath)

    // Scan project repo (if provided and different from agenthub).
    // Wrapped in try/catch so a failing project scan never blocks the agenthub scan.
    if (repoPath) {
      try {
        const projectSkills = this.scanRepo(repoPath)
        const origin = isAgentHub ? 'agenthub' as const : 'project' as const
        for (const s of projectSkills) s.origin = origin
        skills.push(...projectSkills)
      } catch (err) {
        this.deps.logWarning('Failed to scan project repo — agenthub skills will still load', {
          repoPath,
          error: err instanceof Error ? err.message : String(err)
        })
      }
    }

    // Always scan agenthub repo as well (if configured and different from project).
    // This scan is independent — agenthub skills are ALWAYS available.
    if (agenthubPath && !isAgentHub) {
      try {
        const agenthubSkills = this.scanRepo(agenthubPath)
        for (const s of agenthubSkills) s.origin = 'agenthub'
        skills.push(...agenthubSkills)
      } catch (err) {
        this.deps.logWarning('Failed to scan agenthub repo', {
          agenthubPath,
          error: err instanceof Error ? err.message : String(err)
        })
      }
    } else if (!agenthubPath) {
      // Fallback: scan globally installed plugin when agenthubPath is not configured
      const globalPluginPath = this.deps.globalPluginPath ?? join(homedir(), '.claude', 'plugins', 'agenthub')
      if (existsSync(globalPluginPath)) {
        const globalSkills = this.scanGlobalPlugin(globalPluginPath)
        for (const s of globalSkills) s.origin = 'agenthub'
        skills.push(...globalSkills)
      }
    }

    this.deps.logInfo('Skills scanned', { count: skills.length, repoPath })
    return skills
  }

  private normalizePath(p: string): string {
    // Resolve trailing slashes and normalize for comparison
    return p.replace(/\/+$/, '')
  }

  private scanRepo(repoPath: string): SkillItem[] {
    const items: SkillItem[] = []

    const pluginSkillsDir = join(repoPath, 'plugin', 'skills')
    const legacySkillsDir = join(repoPath, '.claude', 'skills')
    const projectDir = existsSync(pluginSkillsDir) ? pluginSkillsDir : legacySkillsDir
    items.push(...this.scanDirectory(projectDir, 'project'))
    items.push(...this.scanTeams(repoPath))
    items.push(...this.scanWorkflows(repoPath))
    items.push(...this.scanCommands(repoPath))

    // Deduplicate within this repo: if a skill and command share the same id, keep the skill
    const seen = new Map<string, number>()
    for (let i = 0; i < items.length; i++) {
      const existing = seen.get(items[i].id)
      if (existing !== undefined) {
        if (items[i].source === 'command') {
          items.splice(i, 1)
          i--
        } else {
          items.splice(existing, 1)
          i--
          seen.clear()
          for (let j = 0; j <= i; j++) seen.set(items[j].id, j)
        }
        continue
      }
      seen.set(items[i].id, i)
    }

    // Apply display registry overrides
    const registry = this.loadDisplayRegistry(repoPath)
    if (registry) {
      this.applyDisplayRegistry(items, registry)
    }

    return items
  }

  private scanTeams(repoPath: string): SkillItem[] {
    const teamsDir = join(repoPath, '.claude', 'teams')
    if (!existsSync(teamsDir)) return []

    let entries: string[]
    try {
      entries = readdirSync(teamsDir)
    } catch {
      return []
    }

    const items: SkillItem[] = []
    for (const entry of entries) {
      const configPath = join(teamsDir, entry, 'config.json')
      if (!existsSync(configPath)) continue

      let name = entry
      let description = ''
      let category = 'teams'
      try {
        const raw = readFileSync(configPath, 'utf-8')
        const config = JSON.parse(raw) as { name?: string; description?: string; category?: string }
        if (config.name) name = config.name
        if (config.description) description = config.description.slice(0, 200)
        if (config.category) category = config.category
      } catch {
        // use defaults
      }

      items.push({ id: entry, name, description, category, path: configPath, source: 'team', format: 'json', origin: 'project' })
    }
    return items
  }

  private scanWorkflows(repoPath: string): SkillItem[] {
    const pluginWorkflowDir = join(repoPath, 'plugin', 'workflows')
    const legacyWorkflowDir = join(repoPath, '.claude', 'workflow-team-library')
    const workflowDir = existsSync(pluginWorkflowDir) ? pluginWorkflowDir : legacyWorkflowDir
    return this.scanWorkflowsFromDir(workflowDir)
  }

  private scanWorkflowsFromDir(workflowDir: string): SkillItem[] {
    if (!existsSync(workflowDir)) return []

    let entries: string[]
    try {
      entries = readdirSync(workflowDir)
    } catch {
      return []
    }

    const items: SkillItem[] = []
    for (const entry of entries) {
      const manifestPath = join(workflowDir, entry, 'manifest.md')
      if (!existsSync(manifestPath)) continue

      let command: string | undefined
      try {
        const content = readFileSync(manifestPath, 'utf-8')
        const fm = this.parseFrontmatter(content)
        if (fm.command) command = fm.command
      } catch { /* ignore */ }

      const parsed = this.parseSkillFile(manifestPath, workflowDir, 'project')
      const category = WORKFLOW_CATEGORIES[entry] ?? 'workflows'
      const item: SkillItem = { ...parsed, id: entry, category, source: 'workflow' }
      if (command) item.command = command
      items.push(item)
    }
    return items
  }

  private scanCommands(repoPath: string): SkillItem[] {
    const pluginCommandsDir = join(repoPath, 'plugin', 'commands')
    const legacyCommandsDir = join(repoPath, '.claude', 'commands')
    const commandsDir = existsSync(pluginCommandsDir) ? pluginCommandsDir : legacyCommandsDir
    return this.scanCommandsFromDir(commandsDir)
  }

  private scanCommandsFromDir(commandsDir: string): SkillItem[] {
    if (!existsSync(commandsDir)) return []

    let entries: string[]
    try {
      entries = readdirSync(commandsDir)
    } catch {
      return []
    }

    const items: SkillItem[] = []
    for (const entry of entries) {
      const ext = extname(entry)
      if (!SUPPORTED_SKILL_EXTENSIONS.includes(ext)) continue

      const fullPath = join(commandsDir, entry)
      let stat
      try {
        stat = statSync(fullPath)
      } catch {
        continue
      }
      if (stat.isDirectory()) continue

      // Skip team-*.md — teams are discovered by scanTeams()
      const baseName = basename(entry, ext)
      if (baseName.startsWith('team-') || baseName === 'team') continue

      // Skip agent role definitions that have allowed-tools in frontmatter
      let content: string
      try {
        content = readFileSync(fullPath, 'utf-8')
      } catch {
        continue
      }
      const fm = this.parseFrontmatter(content)
      if (fm['allowed-tools']) continue

      const parsed = this.parseSkillFile(fullPath, commandsDir, 'project')
      items.push({ ...parsed, source: 'command', category: parsed.category === 'general' ? 'commands' : parsed.category })
    }
    return items
  }

  private scanGlobalPlugin(pluginPath: string): SkillItem[] {
    const items: SkillItem[] = []
    items.push(...this.scanDirectory(join(pluginPath, 'skills'), 'project'))
    items.push(...this.scanWorkflowsFromDir(join(pluginPath, 'workflows')))
    items.push(...this.scanCommandsFromDir(join(pluginPath, 'commands')))

    const registryPath = join(pluginPath, 'skills', 'display-registry.json')
    if (existsSync(registryPath)) {
      try {
        const registry = JSON.parse(readFileSync(registryPath, 'utf-8')) as DisplayRegistry
        this.applyDisplayRegistry(items, registry)
      } catch {
        this.deps.logWarning('Failed to load global plugin display registry', { registryPath })
      }
    }

    return items
  }

  private loadDisplayRegistry(repoPath: string): DisplayRegistry | null {
    const pluginRegistryPath = join(repoPath, 'plugin', 'skills', 'display-registry.json')
    const legacyRegistryPath = join(repoPath, '.claude', 'skills', 'display-registry.json')
    const registryPath = existsSync(pluginRegistryPath) ? pluginRegistryPath : legacyRegistryPath
    if (!existsSync(registryPath)) return null

    try {
      const raw = readFileSync(registryPath, 'utf-8')
      return JSON.parse(raw) as DisplayRegistry
    } catch {
      this.deps.logWarning('Failed to load display registry', { registryPath })
      return null
    }
  }

  private applyDisplayRegistry(skills: SkillItem[], registry: DisplayRegistry): void {
    for (const skill of skills) {
      const entry = registry.items[skill.id]
      if (!entry) continue
      skill.displayName = entry.displayName
      const categoryLabel = registry.categories[entry.category]
      if (categoryLabel) skill.category = categoryLabel
    }
  }

  private scanDirectory(dir: string, source: 'project'): SkillItem[] {
    if (!existsSync(dir)) return []

    const skills: SkillItem[] = []
    this.walkDir(dir, dir, source, skills)
    return skills
  }

  private walkDir(
    currentDir: string,
    rootDir: string,
    source: 'project',
    results: SkillItem[]
  ): void {
    const isRoot = currentDir === rootDir

    let entries: string[]
    try {
      entries = readdirSync(currentDir)
    } catch {
      return
    }

    for (const entry of entries) {
      const fullPath = join(currentDir, entry)
      let stat
      try {
        stat = statSync(fullPath)
      } catch {
        continue
      }

      if (stat.isDirectory()) {
        this.walkDir(fullPath, rootDir, source, results)
      } else if (SUPPORTED_SKILL_EXTENSIONS.includes(extname(entry))) {
        const baseName = basename(entry, extname(entry))
        const isSkillEntryPoint = baseName.toUpperCase() === 'SKILL'

        if (isRoot) {
          // Root level: accept all supported files except known meta-files
          if (!SKIP_ROOT_FILENAMES.has(entry)) {
            results.push(this.parseSkillFile(fullPath, rootDir, source))
          }
        } else {
          // Inside a named skill folder: only accept SKILL.* entry points
          if (isSkillEntryPoint) {
            results.push(this.parseSkillFile(fullPath, rootDir, source))
          }
        }
      }
    }
  }

  private parseFrontmatter(content: string): Record<string, string> {
    const result: Record<string, string> = {}
    if (!content.startsWith('---')) return result

    const end = content.indexOf('\n---', 3)
    if (end === -1) return result

    const block = content.slice(3, end)
    for (const line of block.split('\n')) {
      const colonIdx = line.indexOf(':')
      if (colonIdx === -1) continue
      const key = line.slice(0, colonIdx).trim()
      const value = line.slice(colonIdx + 1).trim()
      if (key) result[key] = value
    }
    return result
  }

  private parseSkillFile(filePath: string, rootDir: string, source: 'project'): SkillItem {
    const ext = extname(filePath)
    const baseName = basename(filePath).replace(/\.[^.]+$/, '')
    const id = baseName.toUpperCase() === 'SKILL' ? basename(dirname(filePath)) : baseName
    const relDir = relative(rootDir, dirname(filePath))
    let category = relDir || 'general'
    const format = ext.slice(1) // strip leading dot

    let name = id
    let description = ''

    try {
      const content = readFileSync(filePath, 'utf-8')
      const lines = content.split('\n')

      if (ext === '.md') {
        // Extract values from YAML frontmatter if present
        const fm = this.parseFrontmatter(content)
        if (fm.name) name = fm.name
        if (fm.description) description = fm.description.slice(0, 200)
        if (fm.category) category = fm.category

        // Fall through to heading extraction if name not in frontmatter
        if (!fm.name) {
          for (const line of lines) {
            const headingMatch = line.match(/^#\s+(.+)/)
            if (headingMatch) {
              name = headingMatch[1].trim()
              break
            }
          }
        }

        // Fall through to paragraph extraction if description not in frontmatter.
        // Use only the body content (after closing ---) to avoid extracting '---'.
        if (!fm.description) {
          let bodyContent = content
          if (content.startsWith('---')) {
            const fmEnd = content.indexOf('\n---', 3)
            if (fmEnd !== -1) {
              const nextNewline = content.indexOf('\n', fmEnd + 4)
              bodyContent = nextNewline !== -1 ? content.slice(nextNewline + 1) : ''
            }
          }

          let foundHeading = false
          for (const line of bodyContent.split('\n')) {
            if (line.match(/^#/)) {
              foundHeading = true
              continue
            }
            const trimmed = line.trim()
            if (foundHeading && trimmed && !trimmed.startsWith('#')) {
              description = trimmed.slice(0, 200)
              break
            }
            if (!foundHeading && trimmed && !trimmed.startsWith('#')) {
              description = trimmed.slice(0, 200)
              break
            }
          }
        }
      } else if (ext === '.sh' || ext === '.py') {
        const commentLines = lines
          .filter((line) => line.match(/^#\s+/))
          .map((line) => line.replace(/^#\s+/, '').trim())
        if (commentLines.length >= 1) name = commentLines[0]
        if (commentLines.length >= 2) description = commentLines[1].slice(0, 200)
      } else if (ext === '.js') {
        const commentLines = lines
          .filter((line) => line.match(/^\/\/\s+/))
          .map((line) => line.replace(/^\/\/\s+/, '').trim())
        if (commentLines.length >= 1) name = commentLines[0]
        if (commentLines.length >= 2) description = commentLines[1].slice(0, 200)
      }
    } catch {
      // File read error — use defaults
    }

    const manifest = this.loadManifest(dirname(filePath))
    const item: SkillItem = { id, name, description, category, path: filePath, source, format, origin: 'project' }
    if (manifest !== undefined) item.manifest = manifest
    return item
  }

  private loadManifest(skillDir: string): SkillManifest | undefined {
    const manifestPath = join(skillDir, 'manifest.yaml')
    try {
      if (!existsSync(manifestPath)) return undefined
      const raw = readFileSync(manifestPath, 'utf-8')
      const parsed = yamlParse(raw) as Record<string, unknown>
      if (!parsed || typeof parsed !== 'object') return undefined
      // Basic validation: required fields with type checks
      if (!parsed.version || !parsed.type) return undefined
      if (!Array.isArray(parsed.triggers)) return undefined
      if (typeof parsed.resources !== 'object' || parsed.resources === null) return undefined
      if (typeof parsed.securitySensitive !== 'boolean') return undefined
      return parsed as unknown as SkillManifest
    } catch {
      return undefined
    }
  }
}
