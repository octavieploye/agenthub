/**
 * Manifest loading tests for SkillsService.
 * Uses real temp directories — no fs mocking — per project testing rules.
 *
 * Separated from skills-service.test.ts because that file applies a
 * module-level vi.mock('fs', ...) that intercepts all fs calls, making
 * real-filesystem tests impossible in the same file.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { mkdtempSync, writeFileSync, mkdirSync, rmSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'
import { SkillsService } from './skills-service'
import type { SkillsServiceDeps } from './skills-service'

const VALID_MANIFEST_YAML = `version: 1
domain: code-quality
type: skill
complexity: simple
securitySensitive: false
triggers:
  - pattern: "fix bug"
    weight: 1.0
resources:
  minContextWindow: 8000
  estimatedTokens: 15000
  preferredTier: capable
requires: []
produces: []
composableWith: []
targetRepos: []
targetDomains: []
`

function createDeps(): SkillsServiceDeps {
  return {
    logInfo: vi.fn(),
    logWarning: vi.fn()
  }
}

describe('SkillsService — manifest.yaml loading (real fs)', () => {
  let tmpRoot: string
  let service: SkillsService
  let deps: SkillsServiceDeps

  beforeEach(() => {
    tmpRoot = mkdtempSync(join(tmpdir(), 'skills-manifest-test-'))
    deps = createDeps()
    service = new SkillsService({ ...deps, agenthubPath: tmpRoot })
  })

  afterEach(() => {
    rmSync(tmpRoot, { recursive: true, force: true })
  })

  it('Test 1: skill dir WITH valid manifest.yaml → SkillItem.manifest is populated with correct fields', () => {
    // Set up: plugin/skills/my-skill/SKILL.md + manifest.yaml
    const skillDir = join(tmpRoot, 'plugin', 'skills', 'my-skill')
    mkdirSync(skillDir, { recursive: true })
    writeFileSync(join(skillDir, 'SKILL.md'), '# My Skill\nDoes something useful')
    writeFileSync(join(skillDir, 'manifest.yaml'), VALID_MANIFEST_YAML)

    const skills = service.listSkills(tmpRoot)
    const skill = skills.find((s) => s.id === 'my-skill')

    expect(skill).toBeDefined()
    expect(skill!.manifest).toBeDefined()
    expect(skill!.manifest!.version).toBe(1)
    expect(skill!.manifest!.domain).toBe('code-quality')
    expect(skill!.manifest!.type).toBe('skill')
    expect(skill!.manifest!.complexity).toBe('simple')
    expect(skill!.manifest!.securitySensitive).toBe(false)
    expect(skill!.manifest!.resources.preferredTier).toBe('capable')
    expect(skill!.manifest!.resources.minContextWindow).toBe(8000)
    expect(skill!.manifest!.resources.estimatedTokens).toBe(15000)
  })

  it('Test 2: skill dir WITHOUT manifest.yaml → SkillItem.manifest is undefined (not an error)', () => {
    // Set up: plugin/skills/bare-skill/SKILL.md with no manifest.yaml
    const skillDir = join(tmpRoot, 'plugin', 'skills', 'bare-skill')
    mkdirSync(skillDir, { recursive: true })
    writeFileSync(join(skillDir, 'SKILL.md'), '# Bare Skill\nNo manifest here')

    const skills = service.listSkills(tmpRoot)
    const skill = skills.find((s) => s.id === 'bare-skill')

    expect(skill).toBeDefined()
    expect(skill!.manifest).toBeUndefined()
  })

  it('Test 3: skill dir WITH malformed YAML → SkillItem.manifest is undefined, no crash', () => {
    // Set up: plugin/skills/broken-skill/SKILL.md + a manifest.yaml that is invalid YAML
    const skillDir = join(tmpRoot, 'plugin', 'skills', 'broken-skill')
    mkdirSync(skillDir, { recursive: true })
    writeFileSync(join(skillDir, 'SKILL.md'), '# Broken Skill\nHas broken manifest')
    // Write YAML that js-yaml will throw on (unbalanced bracket)
    writeFileSync(join(skillDir, 'manifest.yaml'), 'version: 1\ntype: [unclosed bracket\n')

    const skills = service.listSkills(tmpRoot)
    const skill = skills.find((s) => s.id === 'broken-skill')

    expect(skill).toBeDefined()
    expect(skill!.manifest).toBeUndefined()
  })
})
