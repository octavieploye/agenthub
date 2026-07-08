import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { SkillsServiceDeps } from './skills-service'

const { mockExistsSync, mockReaddirSync, mockReadFileSync, mockStatSync, mockExecFile } =
  vi.hoisted(() => ({
    mockExistsSync: vi.fn(),
    mockReaddirSync: vi.fn(),
    mockReadFileSync: vi.fn(),
    mockStatSync: vi.fn(),
    mockExecFile: vi.fn()
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
  })

  describe('listSkills', () => {
    it('returns empty array when no repoPath provided', () => {
      const skills = service.listSkills()
      expect(skills).toEqual([])
    })

    it('returns empty array when no skills directories exist', () => {
      mockExistsSync.mockReturnValue(false)
      const skills = service.listSkills('/project')
      expect(skills).toEqual([])
    })

    it('finds .md files in project skills dir', () => {
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
        path === '/project/.claude/skills'
      )
      mockReaddirSync.mockReturnValue(['test.md'])
      mockStatSync.mockReturnValue({ isDirectory: () => false })
      mockReadFileSync.mockReturnValue('# Custom Name\nSome description here')

      const skills = service.listSkills('/project')
      expect(skills[0].name).toBe('Custom Name')
    })

    it('uses filename when no heading exists', () => {
      mockExistsSync.mockImplementation((path: string) =>
        path === '/project/.claude/skills'
      )
      mockReaddirSync.mockReturnValue(['my-script.md'])
      mockStatSync.mockReturnValue({ isDirectory: () => false })
      mockReadFileSync.mockReturnValue('Just some plain text with no heading')

      const skills = service.listSkills('/project')
      expect(skills[0].name).toBe('my-script')
    })

    it('extracts description from first paragraph', () => {
      mockExistsSync.mockImplementation((path: string) =>
        path === '/project/.claude/skills'
      )
      mockReaddirSync.mockReturnValue(['desc.md'])
      mockStatSync.mockReturnValue({ isDirectory: () => false })
      mockReadFileSync.mockReturnValue('# Title\nThis is the description paragraph')

      const skills = service.listSkills('/project')
      expect(skills[0].description).toBe('This is the description paragraph')
    })

    it('detects category from subdirectory name for SKILL.md files', () => {
      mockExistsSync.mockImplementation((path: string) =>
        path === '/project/.claude/skills'
      )
      mockReaddirSync.mockImplementation((dir: string) => {
        if (dir === '/project/.claude/skills') return ['testing']
        if (dir === '/project/.claude/skills/testing') return ['SKILL.md']
        return []
      })
      mockStatSync.mockImplementation((path: string) => ({
        isDirectory: () => path === '/project/.claude/skills/testing'
      }))
      mockReadFileSync.mockReturnValue('# Unit Testing\nRun unit tests')

      const skills = service.listSkills('/project')
      expect(skills).toHaveLength(1)
      expect(skills[0].category).toBe('testing')
    })

    it('ignores support files that are not SKILL.* inside a skill folder', () => {
      mockExistsSync.mockImplementation((path: string) =>
        path === '/project/.claude/skills'
      )
      mockReaddirSync.mockImplementation((dir: string) => {
        if (dir === '/project/.claude/skills') return ['token-optimizer']
        if (dir === '/project/.claude/skills/token-optimizer')
          return ['SKILL.md', 'criteria.md', 'test-scenarios.md', 'token-audit.sh']
        return []
      })
      mockStatSync.mockImplementation((path: string) => ({
        isDirectory: () => path === '/project/.claude/skills/token-optimizer'
      }))
      mockReadFileSync.mockReturnValue('# Token Optimizer\nOptimize tokens')

      const skills = service.listSkills('/project')
      expect(skills).toHaveLength(1) // only SKILL.md picked up
      expect(skills[0].id).toBe('token-optimizer')
    })

    it('ignores index.md at skills root', () => {
      mockExistsSync.mockImplementation((path: string) =>
        path === '/project/.claude/skills'
      )
      mockReaddirSync.mockReturnValue(['index.md', 'my-skill.md'])
      mockStatSync.mockReturnValue({ isDirectory: () => false })
      mockReadFileSync.mockReturnValue('# My Skill\nDoes something')

      const skills = service.listSkills('/project')
      expect(skills).toHaveLength(1)
      expect(skills[0].id).toBe('my-skill')
    })

    it('derives id from parent directory for SKILL.md files in subdirectories', () => {
      mockExistsSync.mockImplementation((path: string) =>
        path === '/project/.claude/skills'
      )
      mockReaddirSync.mockImplementation((dir: string) => {
        if (dir === '/project/.claude/skills') return ['team-business']
        if (dir === '/project/.claude/skills/team-business') return ['SKILL.md']
        return []
      })
      mockStatSync.mockImplementation((path: string) => ({
        isDirectory: () => path === '/project/.claude/skills/team-business'
      }))
      mockReadFileSync.mockReturnValue('# Team Business\nBusiness research and strategy')

      const skills = service.listSkills('/project')
      expect(skills).toHaveLength(1)
      expect(skills[0].id).toBe('team-business')
      expect(skills[0].category).toBe('team-business')
    })

    it('does not scan global ~/.claude/skills/ directory', () => {
      // Mock targets plugin/skills (new primary path) — validates no global ~/.claude/skills scanned
      mockExistsSync.mockImplementation((path: string) => path === '/project/plugin/skills')
      mockReaddirSync.mockImplementation((dir: string) => {
        if (dir === '/project/plugin/skills') return ['project-skill.md']
        return []
      })
      mockStatSync.mockReturnValue({ isDirectory: () => false })
      mockReadFileSync.mockReturnValue('# Skill\nDescription')

      const skills = service.listSkills('/project')
      expect(skills).toHaveLength(1)
      expect(skills[0].source).toBe('project')
    })

    it('caches results and returns cached on second call', () => {
      mockExistsSync.mockReturnValue(false)
      service.listSkills('/project')
      const callsAfterFirst = mockExistsSync.mock.calls.length
      service.listSkills('/project')
      // Cache hit: no additional existsSync calls on second invocation
      expect(mockExistsSync.mock.calls.length).toBe(callsAfterFirst)
    })
  })

  describe('executeSkill', () => {
    it('runs claude CLI and returns result', async () => {
      mockExistsSync.mockImplementation((path: string) =>
        path === '/project/.claude/skills'
      )
      mockReaddirSync.mockReturnValue(['test.md'])
      mockStatSync.mockReturnValue({ isDirectory: () => false })
      mockReadFileSync.mockReturnValue('# Test\nTest skill content')

      mockExecFile.mockImplementation(
        (_cmd: string, _args: string[], _opts: unknown, cb: Function) => {
          cb(null, 'skill output here', '')
        }
      )

      const result = await service.executeSkill('test', '/project')
      expect(result.skillId).toBe('test')
      expect(result.output).toBe('skill output here')
      expect(result.exitCode).toBe(0)
      expect(result.duration).toBeGreaterThanOrEqual(0)
    })

    it('returns error result when skill not found', async () => {
      mockExistsSync.mockReturnValue(false)

      const result = await service.executeSkill('nonexistent', '/project')
      expect(result.exitCode).toBe(1)
      expect(result.output).toContain('Skill not found')
    })

    it('returns error exitCode on failure', async () => {
      mockExistsSync.mockImplementation((path: string) =>
        path === '/project/.claude/skills'
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

      const result = await service.executeSkill('fail', '/project')
      expect(result.exitCode).toBe(1)
      expect(result.output).toBe('stderr output')
      expect(deps.logWarning).toHaveBeenCalled()
    })
  })

  describe('listSkills — multi-format discovery', () => {
    it('finds .sh files in project skills dir', () => {
      mockExistsSync.mockImplementation((path: string) =>
        path === '/project/.claude/skills'
      )
      mockReaddirSync.mockReturnValue(['deploy.sh'])
      mockStatSync.mockReturnValue({ isDirectory: () => false })
      mockReadFileSync.mockReturnValue('# Deploy Script\n# Deploys to production\nset -e\n')

      const skills = service.listSkills('/project')
      expect(skills).toHaveLength(1)
      expect(skills[0].id).toBe('deploy')
      expect(skills[0].source).toBe('project')
      expect(skills[0].format).toBe('sh')
    })

    it('finds .py files in project skills dir', () => {
      mockExistsSync.mockImplementation((path: string) =>
        path === '/project/.claude/skills'
      )
      mockReaddirSync.mockReturnValue(['lint.py'])
      mockStatSync.mockReturnValue({ isDirectory: () => false })
      mockReadFileSync.mockReturnValue('# Lint Code\n# Runs linting checks\nimport sys\n')

      const skills = service.listSkills('/project')
      expect(skills).toHaveLength(1)
      expect(skills[0].id).toBe('lint')
      expect(skills[0].source).toBe('project')
      expect(skills[0].format).toBe('py')
    })

    it('finds .js files in project skills dir', () => {
      mockExistsSync.mockImplementation((path: string) =>
        path === '/project/.claude/skills'
      )
      mockReaddirSync.mockReturnValue(['build.js'])
      mockStatSync.mockReturnValue({ isDirectory: () => false })
      mockReadFileSync.mockReturnValue('// Build Project\n// Compiles the project\nconst fs = require("fs");\n')

      const skills = service.listSkills('/project')
      expect(skills).toHaveLength(1)
      expect(skills[0].id).toBe('build')
      expect(skills[0].source).toBe('project')
      expect(skills[0].format).toBe('js')
    })

    it('discovers mixed file types together', () => {
      mockExistsSync.mockImplementation((path: string) =>
        path === '/project/.claude/skills'
      )
      mockReaddirSync.mockReturnValue(['a.md', 'b.sh', 'c.py', 'd.js', 'e.txt'])
      mockStatSync.mockReturnValue({ isDirectory: () => false })
      mockReadFileSync.mockReturnValue('content')

      const skills = service.listSkills('/project')
      expect(skills).toHaveLength(4) // .txt is excluded
      expect(skills.map((s) => s.id)).toEqual(['a', 'b', 'c', 'd'])
    })
  })

  describe('parseSkillFile — multi-format metadata', () => {
    it('parses .sh file metadata from hash comments', () => {
      mockExistsSync.mockImplementation((path: string) =>
        path === '/project/.claude/skills'
      )
      mockReaddirSync.mockReturnValue(['setup.sh'])
      mockStatSync.mockReturnValue({ isDirectory: () => false })
      mockReadFileSync.mockReturnValue('#!/bin/bash\n# Setup Environment\n# Installs dependencies and configures env\necho "done"')

      const skills = service.listSkills('/project')
      expect(skills[0].name).toBe('Setup Environment')
      expect(skills[0].description).toBe('Installs dependencies and configures env')
    })

    it('parses .py file metadata from hash comments', () => {
      mockExistsSync.mockImplementation((path: string) =>
        path === '/project/.claude/skills'
      )
      mockReaddirSync.mockReturnValue(['analyze.py'])
      mockStatSync.mockReturnValue({ isDirectory: () => false })
      mockReadFileSync.mockReturnValue('# Analyze Data\n# Runs data analysis pipeline\nimport pandas as pd\n')

      const skills = service.listSkills('/project')
      expect(skills[0].name).toBe('Analyze Data')
      expect(skills[0].description).toBe('Runs data analysis pipeline')
    })

    it('parses .js file metadata from // comments', () => {
      mockExistsSync.mockImplementation((path: string) =>
        path === '/project/.claude/skills'
      )
      mockReaddirSync.mockReturnValue(['bundle.js'])
      mockStatSync.mockReturnValue({ isDirectory: () => false })
      mockReadFileSync.mockReturnValue('// Bundle Assets\n// Bundles all static assets for production\nconst path = require("path");\n')

      const skills = service.listSkills('/project')
      expect(skills[0].name).toBe('Bundle Assets')
      expect(skills[0].description).toBe('Bundles all static assets for production')
    })

    it('falls back to filename as name when no comment metadata in .sh', () => {
      mockExistsSync.mockImplementation((path: string) =>
        path === '/project/.claude/skills'
      )
      mockReaddirSync.mockReturnValue(['no-comments.sh'])
      mockStatSync.mockReturnValue({ isDirectory: () => false })
      mockReadFileSync.mockReturnValue('#!/bin/bash\necho "hello"')

      const skills = service.listSkills('/project')
      expect(skills[0].name).toBe('no-comments')
      expect(skills[0].description).toBe('')
    })

    it('falls back to filename as name when no comment metadata in .js', () => {
      mockExistsSync.mockImplementation((path: string) =>
        path === '/project/.claude/skills'
      )
      mockReaddirSync.mockReturnValue(['bare.js'])
      mockStatSync.mockReturnValue({ isDirectory: () => false })
      mockReadFileSync.mockReturnValue('const x = 1;\nconsole.log(x);\n')

      const skills = service.listSkills('/project')
      expect(skills[0].name).toBe('bare')
      expect(skills[0].description).toBe('')
    })
  })

  describe('format field', () => {
    it('sets format to md for .md files', () => {
      mockExistsSync.mockImplementation((path: string) =>
        path === '/project/.claude/skills'
      )
      mockReaddirSync.mockReturnValue(['test.md'])
      mockStatSync.mockReturnValue({ isDirectory: () => false })
      mockReadFileSync.mockReturnValue('# Test\nContent')

      const skills = service.listSkills('/project')
      expect(skills[0].format).toBe('md')
    })

    it('sets format to sh for .sh files', () => {
      mockExistsSync.mockImplementation((path: string) =>
        path === '/project/.claude/skills'
      )
      mockReaddirSync.mockReturnValue(['test.sh'])
      mockStatSync.mockReturnValue({ isDirectory: () => false })
      mockReadFileSync.mockReturnValue('# Name\n# Desc\necho 1')

      const skills = service.listSkills('/project')
      expect(skills[0].format).toBe('sh')
    })

    it('sets format to py for .py files', () => {
      mockExistsSync.mockImplementation((path: string) =>
        path === '/project/.claude/skills'
      )
      mockReaddirSync.mockReturnValue(['test.py'])
      mockStatSync.mockReturnValue({ isDirectory: () => false })
      mockReadFileSync.mockReturnValue('# Name\n# Desc\nprint(1)')

      const skills = service.listSkills('/project')
      expect(skills[0].format).toBe('py')
    })

    it('sets format to js for .js files', () => {
      mockExistsSync.mockImplementation((path: string) =>
        path === '/project/.claude/skills'
      )
      mockReaddirSync.mockReturnValue(['test.js'])
      mockStatSync.mockReturnValue({ isDirectory: () => false })
      mockReadFileSync.mockReturnValue('// Name\n// Desc\nconsole.log(1)')

      const skills = service.listSkills('/project')
      expect(skills[0].format).toBe('js')
    })
  })

  describe('executeSkill — multi-format execution', () => {
    it('executes .sh skill with bash', async () => {
      mockExistsSync.mockImplementation((path: string) =>
        path === '/project/.claude/skills'
      )
      mockReaddirSync.mockReturnValue(['deploy.sh'])
      mockStatSync.mockReturnValue({ isDirectory: () => false })
      mockReadFileSync.mockReturnValue('# Deploy\n# Deploys app\necho "deployed"')

      mockExecFile.mockImplementation(
        (_cmd: string, _args: string[], _opts: unknown, cb: Function) => {
          cb(null, 'deployed', '')
        }
      )

      const result = await service.executeSkill('deploy', '/project')
      expect(result.exitCode).toBe(0)
      expect(result.output).toBe('deployed')
      expect(mockExecFile).toHaveBeenCalledWith(
        'bash',
        ['/project/.claude/skills/deploy.sh'],
        expect.any(Object),
        expect.any(Function)
      )
    })

    it('executes .py skill with python3', async () => {
      mockExistsSync.mockImplementation((path: string) =>
        path === '/project/.claude/skills'
      )
      mockReaddirSync.mockReturnValue(['analyze.py'])
      mockStatSync.mockReturnValue({ isDirectory: () => false })
      mockReadFileSync.mockReturnValue('# Analyze\n# Analyzes data\nprint("done")')

      mockExecFile.mockImplementation(
        (_cmd: string, _args: string[], _opts: unknown, cb: Function) => {
          cb(null, 'done', '')
        }
      )

      const result = await service.executeSkill('analyze', '/project')
      expect(result.exitCode).toBe(0)
      expect(result.output).toBe('done')
      expect(mockExecFile).toHaveBeenCalledWith(
        'python3',
        ['/project/.claude/skills/analyze.py'],
        expect.any(Object),
        expect.any(Function)
      )
    })

    it('executes .js skill with node', async () => {
      mockExistsSync.mockImplementation((path: string) =>
        path === '/project/.claude/skills'
      )
      mockReaddirSync.mockReturnValue(['build.js'])
      mockStatSync.mockReturnValue({ isDirectory: () => false })
      mockReadFileSync.mockReturnValue('// Build\n// Builds project\nconsole.log("built")')

      mockExecFile.mockImplementation(
        (_cmd: string, _args: string[], _opts: unknown, cb: Function) => {
          cb(null, 'built', '')
        }
      )

      const result = await service.executeSkill('build', '/project')
      expect(result.exitCode).toBe(0)
      expect(result.output).toBe('built')
      expect(mockExecFile).toHaveBeenCalledWith(
        'node',
        ['/project/.claude/skills/build.js'],
        expect.any(Object),
        expect.any(Function)
      )
    })

    it('executes .md skill with claude CLI (unchanged behavior)', async () => {
      mockExistsSync.mockImplementation((path: string) =>
        path === '/project/.claude/skills'
      )
      mockReaddirSync.mockReturnValue(['prompt.md'])
      mockStatSync.mockReturnValue({ isDirectory: () => false })
      mockReadFileSync.mockReturnValue('# Prompt\nSome prompt content')

      mockExecFile.mockImplementation(
        (_cmd: string, _args: string[], _opts: unknown, cb: Function) => {
          cb(null, 'claude output', '')
        }
      )

      const result = await service.executeSkill('prompt', '/project')
      expect(result.exitCode).toBe(0)
      expect(mockExecFile).toHaveBeenCalledWith(
        'claude',
        ['--print', '-p', '# Prompt\nSome prompt content'],
        expect.any(Object),
        expect.any(Function)
      )
    })
  })

  describe('listSkills — teams', () => {
    it('returns team entries from .claude/teams/*/config.json', () => {
      mockExistsSync.mockImplementation((path: string) =>
        path === '/project/.claude/teams' ||
        path === '/project/.claude/teams/business/config.json'
      )
      mockReaddirSync.mockImplementation((dir: string) => {
        if (dir === '/project/.claude/teams') return ['business']
        return []
      })
      mockReadFileSync.mockImplementation((path: string) => {
        if ((path as string).endsWith('config.json'))
          return JSON.stringify({ name: 'business', description: 'Business intelligence team' })
        return ''
      })

      const skills = service.listSkills('/project')
      const team = skills.find((s) => s.source === 'team')
      expect(team).toBeTruthy()
      expect(team!.id).toBe('business')
      expect(team!.name).toBe('business')
      expect(team!.description).toBe('Business intelligence team')
      expect(team!.category).toBe('teams')
      expect(team!.format).toBe('json')
    })

    it('skips team directories without config.json', () => {
      mockExistsSync.mockImplementation((path: string) =>
        path === '/project/.claude/teams'
        // config.json does NOT exist
      )
      mockReaddirSync.mockImplementation((dir: string) => {
        if (dir === '/project/.claude/teams') return ['broken-team']
        return []
      })

      const skills = service.listSkills('/project')
      expect(skills.filter((s) => s.source === 'team')).toHaveLength(0)
    })

    it('returns no teams when teams directory does not exist', () => {
      mockExistsSync.mockReturnValue(false)
      const skills = service.listSkills('/project')
      expect(skills.filter((s) => s.source === 'team')).toHaveLength(0)
    })
  })

  describe('listSkills — workflows', () => {
    it('returns workflow entries from .claude/workflow-team-library/*/manifest.md', () => {
      mockExistsSync.mockImplementation((path: string) =>
        path === '/project/.claude/workflow-team-library' ||
        path === '/project/.claude/workflow-team-library/market-modeling/manifest.md'
      )
      mockReaddirSync.mockImplementation((dir: string) => {
        if (dir === '/project/.claude/workflow-team-library') return ['market-modeling']
        return []
      })
      mockReadFileSync.mockReturnValue('# Market Modeling\nFour phases of market analysis')

      const skills = service.listSkills('/project')
      const workflow = skills.find((s) => s.source === 'workflow')
      expect(workflow).toBeTruthy()
      expect(workflow!.id).toBe('market-modeling')
      expect(workflow!.name).toBe('Market Modeling')
      expect(workflow!.description).toBe('Four phases of market analysis')
      expect(workflow!.category).toBe('workflows')
    })

    it('skips entries without manifest.md', () => {
      mockExistsSync.mockImplementation((path: string) =>
        path === '/project/.claude/workflow-team-library'
        // manifest.md does NOT exist
      )
      mockReaddirSync.mockImplementation((dir: string) => {
        if (dir === '/project/.claude/workflow-team-library') return ['no-manifest']
        return []
      })

      const skills = service.listSkills('/project')
      expect(skills.filter((s) => s.source === 'workflow')).toHaveLength(0)
    })

    it('returns no workflows when workflow-team-library does not exist', () => {
      mockExistsSync.mockReturnValue(false)
      const skills = service.listSkills('/project')
      expect(skills.filter((s) => s.source === 'workflow')).toHaveLength(0)
    })
  })

  describe('refresh', () => {
    it('clears cache and re-scans', () => {
      mockExistsSync.mockReturnValue(false)

      service.listSkills('/project') // populate cache
      const callsAfterFirst = mockExistsSync.mock.calls.length

      service.refresh('/project') // should clear cache and re-scan
      expect(mockExistsSync.mock.calls.length).toBeGreaterThan(callsAfterFirst)
    })
  })

  describe('scanCommands — filtering', () => {
    it('skips commands that have allowed-tools in frontmatter', () => {
      mockExistsSync.mockImplementation((path: string) =>
        path === '/project/.claude/commands'
      )
      mockReaddirSync.mockImplementation((dir: string) => {
        if (dir === '/project/.claude/commands') return ['scout-backend.md', 'destructuring-full.md']
        return []
      })
      mockStatSync.mockReturnValue({ isDirectory: () => false })
      mockReadFileSync.mockImplementation((path: string) => {
        if ((path as string).includes('scout-backend'))
          return '---\ndescription: "Backend scout"\nallowed-tools: ["Read", "Glob"]\n---\n\n# scout-backend\nContent'
        return '---\nname: destructuring-full\ndescription: "Full teardown"\n---\n\n# destructuring-full\nContent'
      })

      const skills = service.listSkills('/project')
      const commands = skills.filter((s) => s.source === 'command')
      expect(commands).toHaveLength(1)
      expect(commands[0].id).toBe('destructuring-full')
    })

    it('skips team-*.md commands to avoid team duplication', () => {
      mockExistsSync.mockImplementation((path: string) =>
        path === '/project/.claude/commands'
      )
      mockReaddirSync.mockImplementation((dir: string) => {
        if (dir === '/project/.claude/commands') return ['team-business.md', 'telegram-notify.md']
        return []
      })
      mockStatSync.mockReturnValue({ isDirectory: () => false })
      mockReadFileSync.mockImplementation((path: string) => {
        if ((path as string).includes('team-business'))
          return '---\ndescription: "Business Team"\nallowed-tools: ["Task"]\n---\n\n# team-business'
        return '# Telegram Notifications\nSend messages'
      })

      const skills = service.listSkills('/project')
      const commands = skills.filter((s) => s.source === 'command')
      expect(commands).toHaveLength(1)
      expect(commands[0].id).toBe('telegram-notify')
    })
  })

  describe('display registry', () => {
    it('applies displayName and category from registry', () => {
      mockExistsSync.mockImplementation((path: string) =>
        path === '/project/.claude/skills' ||
        path === '/project/.claude/skills/display-registry.json'
      )
      mockReaddirSync.mockImplementation((dir: string) => {
        if (dir === '/project/.claude/skills') return ['token-optimizer']
        if (dir === '/project/.claude/skills/token-optimizer') return ['SKILL.md']
        return []
      })
      mockStatSync.mockImplementation((path: string) => ({
        isDirectory: () => path === '/project/.claude/skills/token-optimizer'
      }))
      mockReadFileSync.mockImplementation((path: string) => {
        if ((path as string).endsWith('display-registry.json'))
          return JSON.stringify({
            categories: { 'code-quality': 'Code Quality' },
            items: { 'token-optimizer': { displayName: 'Optimize AI Instructions', category: 'code-quality' } }
          })
        return '# Token Optimizer\nOptimize tokens'
      })

      const skills = service.listSkills('/project')
      expect(skills).toHaveLength(1)
      expect(skills[0].displayName).toBe('Optimize AI Instructions')
      expect(skills[0].category).toBe('Code Quality')
    })

    it('keeps original name and category when not in registry', () => {
      mockExistsSync.mockImplementation((path: string) =>
        path === '/project/.claude/skills'
        // display-registry.json does NOT exist
      )
      mockReaddirSync.mockReturnValue(['my-skill.md'])
      mockStatSync.mockReturnValue({ isDirectory: () => false })
      mockReadFileSync.mockReturnValue('# My Skill\nDoes something')

      const skills = service.listSkills('/project')
      expect(skills[0].displayName).toBeUndefined()
      expect(skills[0].name).toBe('My Skill')
    })
  })

  describe('dual-source scanning', () => {
    it('sets origin to project when repoPath differs from agenthubPath', () => {
      const dualDeps: SkillsServiceDeps = {
        logInfo: vi.fn(),
        logWarning: vi.fn(),
        agenthubPath: '/agenthub'
      }
      const dualService = new SkillsService(dualDeps)

      mockExistsSync.mockImplementation((path: string) =>
        path === '/project/.claude/skills' || path === '/agenthub/.claude/skills'
      )
      mockReaddirSync.mockImplementation((dir: string) => {
        if (dir === '/project/.claude/skills') return ['proj-skill.md']
        if (dir === '/agenthub/.claude/skills') return ['ah-skill.md']
        return []
      })
      mockStatSync.mockReturnValue({ isDirectory: () => false })
      mockReadFileSync.mockReturnValue('# Skill\nDesc')

      const skills = dualService.listSkills('/project')
      const proj = skills.find((s) => s.id === 'proj-skill')
      const ah = skills.find((s) => s.id === 'ah-skill')
      expect(proj).toBeTruthy()
      expect(proj!.origin).toBe('project')
      expect(ah).toBeTruthy()
      expect(ah!.origin).toBe('agenthub')
    })

    it('scans only once when repoPath equals agenthubPath', () => {
      const dualDeps: SkillsServiceDeps = {
        logInfo: vi.fn(),
        logWarning: vi.fn(),
        agenthubPath: '/agenthub'
      }
      const dualService = new SkillsService(dualDeps)

      mockExistsSync.mockImplementation((path: string) =>
        path === '/agenthub/.claude/skills'
      )
      mockReaddirSync.mockImplementation((dir: string) => {
        if (dir === '/agenthub/.claude/skills') return ['skill.md']
        return []
      })
      mockStatSync.mockReturnValue({ isDirectory: () => false })
      mockReadFileSync.mockReturnValue('# Skill\nDesc')

      const skills = dualService.listSkills('/agenthub')
      expect(skills).toHaveLength(1)
      expect(skills[0].origin).toBe('agenthub')
    })

    it('scans agenthub even when no repoPath provided', () => {
      const dualDeps: SkillsServiceDeps = {
        logInfo: vi.fn(),
        logWarning: vi.fn(),
        agenthubPath: '/agenthub'
      }
      const dualService = new SkillsService(dualDeps)

      mockExistsSync.mockImplementation((path: string) =>
        path === '/agenthub/.claude/skills'
      )
      mockReaddirSync.mockImplementation((dir: string) => {
        if (dir === '/agenthub/.claude/skills') return ['ah-skill.md']
        return []
      })
      mockStatSync.mockReturnValue({ isDirectory: () => false })
      mockReadFileSync.mockReturnValue('# AH Skill\nDesc')

      const skills = dualService.listSkills()
      expect(skills).toHaveLength(1)
      expect(skills[0].origin).toBe('agenthub')
    })
  })

  describe('parseSkillFile — YAML frontmatter', () => {
    it('extracts name, description, and category from frontmatter', () => {
      mockExistsSync.mockImplementation((path: string) =>
        path === '/project/.claude/skills'
      )
      mockReaddirSync.mockImplementation((dir: string) => {
        if (dir === '/project/.claude/skills') return ['my-skill']
        if (dir === '/project/.claude/skills/my-skill') return ['SKILL.md']
        return []
      })
      mockStatSync.mockImplementation((path: string) => ({
        isDirectory: () => path === '/project/.claude/skills/my-skill'
      }))
      mockReadFileSync.mockReturnValue(
        '---\nname: My Custom Skill\ndescription: Does something cool\ncategory: dev-skills\n---\n\n# My Custom Skill\nBody content here'
      )

      const skills = service.listSkills('/project')
      expect(skills).toHaveLength(1)
      expect(skills[0].name).toBe('My Custom Skill')
      expect(skills[0].description).toBe('Does something cool')
      expect(skills[0].category).toBe('dev-skills')
    })

    it('falls back to heading for name when frontmatter has no name field', () => {
      mockExistsSync.mockImplementation((path: string) =>
        path === '/project/.claude/skills'
      )
      mockReaddirSync.mockReturnValue(['tool.md'])
      mockStatSync.mockReturnValue({ isDirectory: () => false })
      mockReadFileSync.mockReturnValue('---\ndescription: A tool\n---\n\n# The Tool\nContent')

      const skills = service.listSkills('/project')
      expect(skills[0].name).toBe('The Tool')
      expect(skills[0].description).toBe('A tool')
    })

    it('does not extract --- as description for frontmatter files without description field', () => {
      mockExistsSync.mockImplementation((path: string) =>
        path === '/project/.claude/skills'
      )
      mockReaddirSync.mockReturnValue(['x.md'])
      mockStatSync.mockReturnValue({ isDirectory: () => false })
      mockReadFileSync.mockReturnValue('---\nname: X\n---\n\n# X\nReal description here')

      const skills = service.listSkills('/project')
      expect(skills[0].description).toBe('Real description here')
      expect(skills[0].description).not.toBe('---')
    })
  })

  describe('global plugin fallback', () => {
    it('scans globalPluginPath/skills when agenthubPath is not configured', () => {
      const svc = new SkillsService({ logInfo: vi.fn(), logWarning: vi.fn(), globalPluginPath: '/global/plugin' })

      mockExistsSync.mockImplementation((path: string) =>
        path === '/global/plugin' || path === '/global/plugin/skills'
      )
      mockReaddirSync.mockImplementation((dir: string) => {
        if (dir === '/global/plugin/skills') return ['global-skill.md']
        return []
      })
      mockStatSync.mockReturnValue({ isDirectory: () => false })
      mockReadFileSync.mockReturnValue('# Global Skill\nFrom global plugin')

      const skills = svc.listSkills()
      expect(skills.some((s) => s.id === 'global-skill')).toBe(true)
      expect(skills.find((s) => s.id === 'global-skill')?.origin).toBe('agenthub')
    })

    it('skips global plugin scan when agenthubPath is configured', () => {
      const svc = new SkillsService({
        logInfo: vi.fn(),
        logWarning: vi.fn(),
        agenthubPath: '/agenthub',
        globalPluginPath: '/global/plugin'
      })

      mockExistsSync.mockImplementation((path: string) => path === '/agenthub/.claude/skills')
      mockReaddirSync.mockImplementation((dir: string) => {
        if (dir === '/agenthub/.claude/skills') return ['ah-skill.md']
        return []
      })
      mockStatSync.mockReturnValue({ isDirectory: () => false })
      mockReadFileSync.mockReturnValue('# AH Skill\nDesc')

      const skills = svc.listSkills()
      expect(skills.some((s) => s.id === 'ah-skill')).toBe(true)
      expect(skills.some((s) => s.id === 'global-skill')).toBe(false)
    })

    it('includes global plugin workflows when agenthubPath is not configured', () => {
      const svc = new SkillsService({ logInfo: vi.fn(), logWarning: vi.fn(), globalPluginPath: '/global/plugin' })

      mockExistsSync.mockImplementation((path: string) =>
        path === '/global/plugin' ||
        path === '/global/plugin/workflows' ||
        path === '/global/plugin/workflows/market-modeling/manifest.md'
      )
      mockReaddirSync.mockImplementation((dir: string) => {
        if (dir === '/global/plugin/workflows') return ['market-modeling']
        return []
      })
      mockReadFileSync.mockReturnValue('# Market Modeling\nFour phases')

      const skills = svc.listSkills()
      const wf = skills.find((s) => s.source === 'workflow')
      expect(wf).toBeTruthy()
      expect(wf!.id).toBe('market-modeling')
      expect(wf!.origin).toBe('agenthub')
    })

    it('returns empty when globalPluginPath does not exist and agenthubPath not set', () => {
      const svc = new SkillsService({ logInfo: vi.fn(), logWarning: vi.fn(), globalPluginPath: '/nonexistent' })
      mockExistsSync.mockReturnValue(false)

      const skills = svc.listSkills()
      expect(skills).toEqual([])
    })
  })

  describe('plugin/ path priority', () => {
    it('prefers plugin/skills over .claude/skills when both exist', () => {
      mockExistsSync.mockImplementation((path: string) =>
        path === '/project/plugin/skills' || path === '/project/.claude/skills'
      )
      mockReaddirSync.mockImplementation((dir: string) => {
        if (dir === '/project/plugin/skills') return ['plugin-skill.md']
        if (dir === '/project/.claude/skills') return ['legacy-skill.md']
        return []
      })
      mockStatSync.mockReturnValue({ isDirectory: () => false })
      mockReadFileSync.mockReturnValue('# Skill\nDesc')

      const skills = service.listSkills('/project')
      const ids = skills.map((s) => s.id)
      expect(ids).toContain('plugin-skill')
      expect(ids).not.toContain('legacy-skill')
    })

    it('prefers plugin/commands over .claude/commands when both exist', () => {
      mockExistsSync.mockImplementation((path: string) =>
        path === '/project/plugin/commands' || path === '/project/.claude/commands'
      )
      mockReaddirSync.mockImplementation((dir: string) => {
        if (dir === '/project/plugin/commands') return ['plugin-cmd.md']
        if (dir === '/project/.claude/commands') return ['legacy-cmd.md']
        return []
      })
      mockStatSync.mockReturnValue({ isDirectory: () => false })
      mockReadFileSync.mockReturnValue('# Cmd\nDoes stuff')

      const skills = service.listSkills('/project')
      const ids = skills.map((s) => s.id)
      expect(ids).toContain('plugin-cmd')
      expect(ids).not.toContain('legacy-cmd')
    })

    it('prefers plugin/workflows over .claude/workflow-team-library when both exist', () => {
      mockExistsSync.mockImplementation((path: string) =>
        path === '/project/plugin/workflows' ||
        path === '/project/plugin/workflows/plugin-wf/manifest.md' ||
        path === '/project/.claude/workflow-team-library' ||
        path === '/project/.claude/workflow-team-library/legacy-wf/manifest.md'
      )
      mockReaddirSync.mockImplementation((dir: string) => {
        if (dir === '/project/plugin/workflows') return ['plugin-wf']
        if (dir === '/project/.claude/workflow-team-library') return ['legacy-wf']
        return []
      })
      mockReadFileSync.mockReturnValue('# Workflow\nDesc')

      const skills = service.listSkills('/project')
      const workflows = skills.filter((s) => s.source === 'workflow')
      const ids = workflows.map((s) => s.id)
      expect(ids).toContain('plugin-wf')
      expect(ids).not.toContain('legacy-wf')
    })

    it('prefers plugin/skills/display-registry.json over .claude/skills/display-registry.json', () => {
      mockExistsSync.mockImplementation((path: string) =>
        path === '/project/plugin/skills' ||
        path === '/project/plugin/skills/display-registry.json'
      )
      mockReaddirSync.mockImplementation((dir: string) => {
        if (dir === '/project/plugin/skills') return ['token-optimizer']
        if (dir === '/project/plugin/skills/token-optimizer') return ['SKILL.md']
        return []
      })
      mockStatSync.mockImplementation((path: string) => ({
        isDirectory: () => path === '/project/plugin/skills/token-optimizer'
      }))
      mockReadFileSync.mockImplementation((path: string) => {
        if ((path as string).endsWith('display-registry.json'))
          return JSON.stringify({
            categories: { 'ai-config': 'AI Config' },
            items: { 'token-optimizer': { displayName: 'Token Optimizer (plugin)', category: 'ai-config' } }
          })
        return '# Token Optimizer\nOptimize tokens'
      })

      const skills = service.listSkills('/project')
      expect(skills).toHaveLength(1)
      expect(skills[0].displayName).toBe('Token Optimizer (plugin)')
    })
  })
})
