import { readdirSync, readFileSync, existsSync, statSync } from 'fs'
import { execFile } from 'child_process'
import { join, basename, dirname, relative, extname } from 'path'
import { homedir } from 'os'
import type { SkillItem, SkillExecutionResult } from '../../shared/types/skills.types'

export const SUPPORTED_SKILL_EXTENSIONS = ['.md', '.sh', '.py', '.js']

export interface SkillsServiceDeps {
  logInfo: (message: string, meta?: Record<string, unknown>) => void
  logWarning: (message: string, meta?: Record<string, unknown>) => void
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

    // Global skills: ~/.claude/skills/
    const globalDir = join(homedir(), '.claude', 'skills')
    skills.push(...this.scanDirectory(globalDir, 'global'))

    // Project skills: {repoPath}/.claude/skills/
    if (repoPath) {
      const projectDir = join(repoPath, '.claude', 'skills')
      skills.push(...this.scanDirectory(projectDir, 'project'))
    }

    this.deps.logInfo('Skills scanned', { count: skills.length, repoPath })
    return skills
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
        results.push(this.parseSkillFile(fullPath, rootDir, source))
      }
    }
  }

  private parseSkillFile(filePath: string, rootDir: string, source: 'global' | 'project'): SkillItem {
    const ext = extname(filePath)
    const id = basename(filePath).replace(/\.[^.]+$/, '')
    const relDir = relative(rootDir, dirname(filePath))
    const category = relDir || 'general'
    const format = ext.slice(1) // strip leading dot

    let name = id
    let description = ''

    try {
      const content = readFileSync(filePath, 'utf-8')
      const lines = content.split('\n')

      if (ext === '.md') {
        // Extract name from first heading
        for (const line of lines) {
          const headingMatch = line.match(/^#\s+(.+)/)
          if (headingMatch) {
            name = headingMatch[1].trim()
            break
          }
        }

        // Extract description from first non-heading, non-empty paragraph
        let foundHeading = false
        for (const line of lines) {
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
