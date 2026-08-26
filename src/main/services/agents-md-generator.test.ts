import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtempSync, writeFileSync, rmSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'
import { generateAgentsMd } from './agents-md-generator'

let tempDir: string

beforeEach(() => {
  tempDir = mkdtempSync(join(tmpdir(), 'agents-md-test-'))
})

afterEach(() => {
  rmSync(tempDir, { recursive: true, force: true })
})

describe('generateAgentsMd', () => {
  it('includes guard policy content', () => {
    const guardPath = join(tempDir, 'guard.md')
    writeFileSync(guardPath, '# Guard Policy\n\nI cannot assist with that request.\n')
    const skillsPath = join(tempDir, 'skills-index.md')
    writeFileSync(skillsPath, '# Skills\n- skill-a\n')

    const result = generateAgentsMd({ guardPath, skillsIndexPath: skillsPath })

    expect(result).toContain('I cannot assist with that request')
    expect(result).toContain('Guard Policy')
  })

  it('includes skills index content', () => {
    const guardPath = join(tempDir, 'guard.md')
    writeFileSync(guardPath, 'Guard. I cannot assist with that request.\n')
    const skillsPath = join(tempDir, 'skills-index.md')
    writeFileSync(skillsPath, '# Skills Index\n- brainstorm\n- dev-loop\n')

    const result = generateAgentsMd({ guardPath, skillsIndexPath: skillsPath })

    expect(result).toContain('Skills Index')
    expect(result).toContain('brainstorm')
    expect(result).toContain('dev-loop')
  })

  it('includes CLAUDE.md content when provided', () => {
    const guardPath = join(tempDir, 'guard.md')
    writeFileSync(guardPath, 'Guard. I cannot assist with that request.\n')
    const skillsPath = join(tempDir, 'skills-index.md')
    writeFileSync(skillsPath, '# Skills\n')
    const claudeMdPath = join(tempDir, 'CLAUDE.md')
    writeFileSync(claudeMdPath, '# Project Rules\n\nNever assume.\n')

    const result = generateAgentsMd({ guardPath, skillsIndexPath: skillsPath, claudeMdPath })

    expect(result).toContain('Project Rules')
    expect(result).toContain('Never assume')
  })

  it('includes task description when provided', () => {
    const guardPath = join(tempDir, 'guard.md')
    writeFileSync(guardPath, 'Guard. I cannot assist with that request.\n')
    const skillsPath = join(tempDir, 'skills-index.md')
    writeFileSync(skillsPath, '# Skills\n')

    const result = generateAgentsMd({
      guardPath,
      skillsIndexPath: skillsPath,
      taskDescription: 'Fix the login bug in auth-service.ts',
    })

    expect(result).toContain('Fix the login bug in auth-service.ts')
  })

  it('degrades gracefully when skills index is missing', () => {
    const guardPath = join(tempDir, 'guard.md')
    writeFileSync(guardPath, 'Guard. I cannot assist with that request.\n')
    const missingSkills = join(tempDir, 'nonexistent-skills.md')

    const result = generateAgentsMd({ guardPath, skillsIndexPath: missingSkills })

    expect(result).toContain('Guard')
    expect(result).not.toContain('nonexistent')
  })

  it('throws when guard file is missing', () => {
    const missingGuard = join(tempDir, 'nonexistent-guard.md')
    const skillsPath = join(tempDir, 'skills-index.md')
    writeFileSync(skillsPath, '# Skills\n')

    expect(() => generateAgentsMd({ guardPath: missingGuard, skillsIndexPath: skillsPath }))
      .toThrow()
  })

  it('throws when guard file is empty', () => {
    const guardPath = join(tempDir, 'guard.md')
    writeFileSync(guardPath, '')
    const skillsPath = join(tempDir, 'skills-index.md')
    writeFileSync(skillsPath, '# Skills\n')

    expect(() => generateAgentsMd({ guardPath, skillsIndexPath: skillsPath }))
      .toThrow()
  })

  it('throws when guard file does not contain refusal phrase', () => {
    const guardPath = join(tempDir, 'guard.md')
    writeFileSync(guardPath, '# Some random content without the expected phrase\n')
    const skillsPath = join(tempDir, 'skills-index.md')
    writeFileSync(skillsPath, '# Skills\n')

    expect(() => generateAgentsMd({ guardPath, skillsIndexPath: skillsPath }))
      .toThrow(/integrity/)
  })

  it('outputs sections in order: header, guard, skills, claude.md, task', () => {
    const guardPath = join(tempDir, 'guard.md')
    writeFileSync(guardPath, 'GUARD_SECTION. I cannot assist with that request.\n')
    const skillsPath = join(tempDir, 'skills-index.md')
    writeFileSync(skillsPath, 'SKILLS_SECTION\n')
    const claudeMdPath = join(tempDir, 'CLAUDE.md')
    writeFileSync(claudeMdPath, 'CLAUDE_SECTION\n')

    const result = generateAgentsMd({
      guardPath,
      skillsIndexPath: skillsPath,
      claudeMdPath,
      taskDescription: 'TASK_SECTION',
    })

    const guardIdx = result.indexOf('GUARD_SECTION')
    const skillsIdx = result.indexOf('SKILLS_SECTION')
    const claudeIdx = result.indexOf('CLAUDE_SECTION')
    const taskIdx = result.indexOf('TASK_SECTION')

    expect(guardIdx).toBeGreaterThan(-1)
    expect(skillsIdx).toBeGreaterThan(guardIdx)
    expect(claudeIdx).toBeGreaterThan(skillsIdx)
    expect(taskIdx).toBeGreaterThan(claudeIdx)
  })

  it('includes Codex-specific behavioral header', () => {
    const guardPath = join(tempDir, 'guard.md')
    writeFileSync(guardPath, 'Guard. I cannot assist with that request.\n')
    const skillsPath = join(tempDir, 'skills-index.md')
    writeFileSync(skillsPath, '# Skills\n')

    const result = generateAgentsMd({ guardPath, skillsIndexPath: skillsPath })

    expect(result).toContain('Codex CLI')
    expect(result).toContain('AgentHub')
  })
})
