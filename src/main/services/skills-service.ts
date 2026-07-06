import { readdirSync, readFileSync, existsSync, statSync } from 'fs'
import { execFile } from 'child_process'
import { join, basename, dirname, relative, extname } from 'path'
import type { SkillItem, SkillExecutionResult } from '../../shared/types/skills.types'

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
}

export interface SkillsServiceDeps {
  logInfo: (message: string, meta?: Record<string, unknown>) => void
  logWarning: (message: string, meta?: Record<string, unknown>) => void
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
        // .md — original behavior
        const content = readFileSync(skill.path, 'utf-8')
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

    // Project-scoped only — AgentHub shows skills from the agent's repo, not from
    // the user's global ~/.claude/skills/ or Claude Code plugins (those are consumed
    // internally by Claude and can't be sent via the PTY).
    if (repoPath) {
      const projectDir = join(repoPath, '.claude', 'skills')
      skills.push(...this.scanDirectory(projectDir, 'project'))
      skills.push(...this.scanTeams(repoPath))
      skills.push(...this.scanWorkflows(repoPath))
      skills.push(...this.scanCommands(repoPath))

      // Deduplicate: if a skill and command share the same id, keep the skill
      const seen = new Map<string, number>()
      for (let i = 0; i < skills.length; i++) {
        const existing = seen.get(skills[i].id)
        if (existing !== undefined) {
          // Keep whichever is NOT a command (skills have richer metadata)
          if (skills[i].source === 'command') {
            skills.splice(i, 1)
            i--
          } else {
            skills.splice(existing, 1)
            i--
            // Re-index after splice
            seen.clear()
            for (let j = 0; j <= i; j++) seen.set(skills[j].id, j)
          }
          continue
        }
        seen.set(skills[i].id, i)
      }

      // Apply display registry overrides
      const registry = this.loadDisplayRegistry(repoPath)
      if (registry) {
        this.applyDisplayRegistry(skills, registry)
      }
    }

    this.deps.logInfo('Skills scanned', { count: skills.length, repoPath })
    return skills
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

      items.push({ id: entry, name, description, category, path: configPath, source: 'team', format: 'json' })
    }
    return items
  }

  private scanWorkflows(repoPath: string): SkillItem[] {
    const workflowDir = join(repoPath, '.claude', 'workflow-team-library')
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

      const parsed = this.parseSkillFile(manifestPath, workflowDir, 'project')
      const category = WORKFLOW_CATEGORIES[entry] ?? 'workflows'
      items.push({ ...parsed, id: entry, category, source: 'workflow' })
    }
    return items
  }

  private scanCommands(repoPath: string): SkillItem[] {
    const commandsDir = join(repoPath, '.claude', 'commands')
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

  private loadDisplayRegistry(repoPath: string): DisplayRegistry | null {
    const registryPath = join(repoPath, '.claude', 'skills', 'display-registry.json')
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

  private scanDirectory(dir: string, source: 'global' | 'project'): SkillItem[] {
    if (!existsSync(dir)) return []

    const skills: SkillItem[] = []
    this.walkDir(dir, dir, source, skills)
    return skills
  }

  private walkDir(
    currentDir: string,
    rootDir: string,
    source: 'global' | 'project',
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

  private parseSkillFile(filePath: string, rootDir: string, source: 'global' | 'project'): SkillItem {
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

    return { id, name, description, category, path: filePath, source, format }
  }
}
