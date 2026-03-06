import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { SkillsServiceDeps } from './skills-service'

const { mockExistsSync, mockReaddirSync, mockReadFileSync, mockStatSync, mockExecFile, mockHomedir } =
  vi.hoisted(() => ({
    mockExistsSync: vi.fn(),
    mockReaddirSync: vi.fn(),
    mockReadFileSync: vi.fn(),
    mockStatSync: vi.fn(),
    mockExecFile: vi.fn(),
    mockHomedir: vi.fn()
  }))

vi.mock('fs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('fs')>()
  return {
    ...actual,
    default: {
      ...actual,
      existsSync: mockExistsSync,
      readdirSync: mockReaddirSync,
      readFileSync: mockReadFileSync,
      statSync: mockStatSync
    },
    existsSync: mockExistsSync,
    readdirSync: mockReaddirSync,
    readFileSync: mockReadFileSync,
    statSync: mockStatSync
  }
})

vi.mock('child_process', async (importOriginal) => {
  const actual = await importOriginal<typeof import('child_process')>()
  return {
    ...actual,
    default: { ...actual, execFile: mockExecFile },
    execFile: mockExecFile
  }
})

vi.mock('os', async (importOriginal) => {
  const actual = await importOriginal<typeof import('os')>()
  return {
    ...actual,
    default: { ...actual, homedir: mockHomedir },
    homedir: mockHomedir
  }
})

import { SkillsService } from './skills-service'

function createDeps(): SkillsServiceDeps {
  return {
    logInfo: vi.fn(),
    logWarning: vi.fn()
  }
}

describe('SkillsService', () => {
  let deps: SkillsServiceDeps
  let service: SkillsService

  beforeEach(() => {
    vi.clearAllMocks()
    deps = createDeps()
    service = new SkillsService(deps)
    mockHomedir.mockReturnValue('/home/testuser')
  })

  describe('listSkills', () => {
    it('returns empty array when no skills directories exist', () => {
      mockExistsSync.mockReturnValue(false)
      const skills = service.listSkills()
      expect(skills).toEqual([])
    })

    it('finds .md files in global skills dir', () => {
      mockExistsSync.mockImplementation((path: string) =>
        path === '/home/testuser/.claude/skills'
      )
      mockReaddirSync.mockReturnValue(['my-skill.md'])
      mockStatSync.mockReturnValue({ isDirectory: () => false })
      mockReadFileSync.mockReturnValue('# My Skill\nDoes something cool')

      const skills = service.listSkills()
      expect(skills).toHaveLength(1)
      expect(skills[0].id).toBe('my-skill')
      expect(skills[0].name).toBe('My Skill')
      expect(skills[0].source).toBe('global')
    })

    it('finds .md files in project skills dir', () => {
      // Global dir doesn't exist
      mockExistsSync.mockImplementation((path: string) =>
        path === '/project/.claude/skills'
      )
      mockReaddirSync.mockReturnValue(['deploy.md'])
      mockStatSync.mockReturnValue({ isDirectory: () => false })
      mockReadFileSync.mockReturnValue('# Deploy\nDeploys the app')

      const skills = service.listSkills('/project')
      expect(skills).toHaveLength(1)
      expect(skills[0].id).toBe('deploy')
      expect(skills[0].source).toBe('project')
    })

    it('parses name from first heading', () => {
      mockExistsSync.mockImplementation((path: string) =>
        path === '/home/testuser/.claude/skills'
      )
      mockReaddirSync.mockReturnValue(['test.md'])
      mockStatSync.mockReturnValue({ isDirectory: () => false })
      mockReadFileSync.mockReturnValue('# Custom Name\nSome description here')

      const skills = service.listSkills()
      expect(skills[0].name).toBe('Custom Name')
    })

    it('uses filename when no heading exists', () => {
      mockExistsSync.mockImplementation((path: string) =>
        path === '/home/testuser/.claude/skills'
      )
      mockReaddirSync.mockReturnValue(['my-script.md'])
      mockStatSync.mockReturnValue({ isDirectory: () => false })
      mockReadFileSync.mockReturnValue('Just some plain text with no heading')

      const skills = service.listSkills()
      expect(skills[0].name).toBe('my-script')
    })

    it('extracts description from first paragraph', () => {
      mockExistsSync.mockImplementation((path: string) =>
        path === '/home/testuser/.claude/skills'
      )
      mockReaddirSync.mockReturnValue(['desc.md'])
      mockStatSync.mockReturnValue({ isDirectory: () => false })
      mockReadFileSync.mockReturnValue('# Title\nThis is the description paragraph')

      const skills = service.listSkills()
      expect(skills[0].description).toBe('This is the description paragraph')
    })

    it('detects category from subdirectory', () => {
      mockExistsSync.mockImplementation((path: string) =>
        path === '/home/testuser/.claude/skills'
      )
      // Root dir lists a subdirectory
      mockReaddirSync.mockImplementation((dir: string) => {
        if (dir === '/home/testuser/.claude/skills') return ['testing']
        if (dir === '/home/testuser/.claude/skills/testing') return ['unit.md']
        return []
      })
      mockStatSync.mockImplementation((path: string) => ({
        isDirectory: () => path === '/home/testuser/.claude/skills/testing'
      }))
      mockReadFileSync.mockReturnValue('# Unit Testing\nRun unit tests')

      const skills = service.listSkills()
      expect(skills).toHaveLength(1)
      expect(skills[0].category).toBe('testing')
    })

    it('merges global and project skills', () => {
      mockExistsSync.mockReturnValue(true)
      mockReaddirSync.mockImplementation((dir: string) => {
        if (dir === '/home/testuser/.claude/skills') return ['global-skill.md']
        if (dir === '/project/.claude/skills') return ['project-skill.md']
        return []
      })
      mockStatSync.mockReturnValue({ isDirectory: () => false })
      mockReadFileSync.mockReturnValue('# Skill\nDescription')

      const skills = service.listSkills('/project')
      expect(skills).toHaveLength(2)
      expect(skills.find((s) => s.source === 'global')).toBeTruthy()
      expect(skills.find((s) => s.source === 'project')).toBeTruthy()
    })

    it('caches results and returns cached on second call', () => {
      mockExistsSync.mockReturnValue(false)
      service.listSkills()
      service.listSkills()
      // existsSync should only be called once for the same cache key
      expect(mockExistsSync).toHaveBeenCalledTimes(1)
    })
  })

  describe('executeSkill', () => {
    it('runs claude CLI and returns result', async () => {
      // Setup skills list first
      mockExistsSync.mockImplementation((path: string) =>
        path === '/home/testuser/.claude/skills'
      )
      mockReaddirSync.mockReturnValue(['test.md'])
      mockStatSync.mockReturnValue({ isDirectory: () => false })
      mockReadFileSync.mockReturnValue('# Test\nTest skill content')

      mockExecFile.mockImplementation(
        (_cmd: string, _args: string[], _opts: unknown, cb: Function) => {
          cb(null, 'skill output here', '')
        }
      )

      const result = await service.executeSkill('test')
      expect(result.skillId).toBe('test')
      expect(result.output).toBe('skill output here')
      expect(result.exitCode).toBe(0)
      expect(result.duration).toBeGreaterThanOrEqual(0)
    })

    it('returns error result when skill not found', async () => {
      mockExistsSync.mockReturnValue(false)

      const result = await service.executeSkill('nonexistent')
      expect(result.exitCode).toBe(1)
      expect(result.output).toContain('Skill not found')
    })

    it('returns error exitCode on failure', async () => {
      mockExistsSync.mockImplementation((path: string) =>
        path === '/home/testuser/.claude/skills'
      )
      mockReaddirSync.mockReturnValue(['fail.md'])
      mockStatSync.mockReturnValue({ isDirectory: () => false })
      mockReadFileSync.mockReturnValue('# Fail\nWill fail')

      const execError = new Error('command failed')
      mockExecFile.mockImplementation(
        (_cmd: string, _args: string[], _opts: unknown, cb: Function) => {
          cb(execError, '', 'stderr output')
        }
      )

      const result = await service.executeSkill('fail')
      expect(result.exitCode).toBe(1)
      expect(result.output).toBe('stderr output')
      expect(deps.logWarning).toHaveBeenCalled()
    })
  })

  describe('refresh', () => {
    it('clears cache and re-scans', () => {
      mockExistsSync.mockReturnValue(false)

      service.listSkills() // populate cache
      expect(mockExistsSync).toHaveBeenCalledTimes(1)

      service.refresh() // should clear cache and re-scan
      expect(mockExistsSync).toHaveBeenCalledTimes(2)
    })
  })
})
