import { describe, it, expect, beforeEach } from 'vitest'
import Database from 'better-sqlite3'
import { runMigrations } from '../migration-runner'
import {
  getAllTasks,
  getTasksByRepo,
  getTasksBySprint,
  getTasksByStatus,
  getTaskById,
  insertTask,
  updateTask,
  deleteTask,
  getCompletedTasksSince,
  updateTaskPosition,
  linkSBARToTask
} from './tasks.queries'
import { insertRepo } from './repos.queries'
import { insertAgent } from './agents.queries'

let db: Database.Database

beforeEach(() => {
  db = new Database(':memory:')
  db.pragma('foreign_keys = ON')
  runMigrations(db, __dirname + '/../migrations')
})

function seedRepo(): string {
  const repo = insertRepo(db, { name: 'test-repo', path: '/tmp/test-repo' })
  return repo.id
}

describe('tasks.queries', () => {
  describe('insertTask', () => {
    it('creates a task with defaults', () => {
      const repoId = seedRepo()
      const task = insertTask(db, { repoId, title: 'Fix bug' })
      expect(task.id).toBeDefined()
      expect(task.title).toBe('Fix bug')
      expect(task.priority).toBe(3)
      expect(task.status).toBe('backlog')
      expect(task.agentId).toBeNull()
      expect(task.description).toBe('')
    })

    it('creates a task with custom values', () => {
      const repoId = seedRepo()
      const task = insertTask(db, {
        repoId,
        title: 'Urgent fix',
        description: 'Critical bug',
        priority: 1,
        status: 'today'
      })
      expect(task.priority).toBe(1)
      expect(task.status).toBe('today')
      expect(task.description).toBe('Critical bug')
    })
  })

  describe('getAllTasks', () => {
    it('returns tasks sorted by priority then created_at', () => {
      const repoId = seedRepo()
      insertTask(db, { repoId, title: 'P3 task', priority: 3 })
      insertTask(db, { repoId, title: 'P1 task', priority: 1 })
      insertTask(db, { repoId, title: 'P2 task', priority: 2 })

      const tasks = getAllTasks(db)
      expect(tasks).toHaveLength(3)
      expect(tasks[0].title).toBe('P1 task')
      expect(tasks[1].title).toBe('P2 task')
      expect(tasks[2].title).toBe('P3 task')
    })

    it('returns empty array when no tasks', () => {
      expect(getAllTasks(db)).toEqual([])
    })
  })

  describe('getTasksByRepo', () => {
    it('filters by repo', () => {
      const repo1 = seedRepo()
      const repo2 = insertRepo(db, { name: 'other', path: '/tmp/other' }).id
      insertTask(db, { repoId: repo1, title: 'Repo1 task' })
      insertTask(db, { repoId: repo2, title: 'Repo2 task' })

      const tasks = getTasksByRepo(db, repo1)
      expect(tasks).toHaveLength(1)
      expect(tasks[0].title).toBe('Repo1 task')
    })
  })

  describe('getTasksBySprint', () => {
    it('filters by repo and sprint name', () => {
      const repoId = seedRepo()
      insertTask(db, { repoId, title: 'R7-A task 1', sprintName: 'R7-A' })
      insertTask(db, { repoId, title: 'R7-A task 2', sprintName: 'R7-A' })
      insertTask(db, { repoId, title: 'R7-B task', sprintName: 'R7-B' })

      const tasks = getTasksBySprint(db, repoId, 'R7-A')
      expect(tasks).toHaveLength(2)
      expect(tasks.every((t) => t.sprintName === 'R7-A')).toBe(true)
    })

    it('returns empty array when no tasks match the sprint', () => {
      const repoId = seedRepo()
      insertTask(db, { repoId, title: 'R7-B task', sprintName: 'R7-B' })

      expect(getTasksBySprint(db, repoId, 'R7-A')).toEqual([])
    })
  })

  describe('getTasksByStatus', () => {
    it('filters by status', () => {
      const repoId = seedRepo()
      insertTask(db, { repoId, title: 'Backlog', status: 'backlog' })
      insertTask(db, { repoId, title: 'Today', status: 'today' })

      const backlog = getTasksByStatus(db, 'backlog')
      expect(backlog).toHaveLength(1)
      expect(backlog[0].title).toBe('Backlog')
    })
  })

  describe('getTaskById', () => {
    it('returns task by id', () => {
      const repoId = seedRepo()
      const task = insertTask(db, { repoId, title: 'Find me' })
      const found = getTaskById(db, task.id)
      expect(found).not.toBeNull()
      expect(found!.title).toBe('Find me')
    })

    it('returns null for unknown id', () => {
      expect(getTaskById(db, 'nonexistent')).toBeNull()
    })
  })

  describe('updateTask', () => {
    it('updates title', () => {
      const repoId = seedRepo()
      const task = insertTask(db, { repoId, title: 'Old title' })
      updateTask(db, task.id, { title: 'New title' })
      const updated = getTaskById(db, task.id)
      expect(updated!.title).toBe('New title')
    })

    it('updates status', () => {
      const repoId = seedRepo()
      const task = insertTask(db, { repoId, title: 'Task' })
      updateTask(db, task.id, { status: 'today' })
      const updated = getTaskById(db, task.id)
      expect(updated!.status).toBe('today')
    })

    it('updates priority', () => {
      const repoId = seedRepo()
      const task = insertTask(db, { repoId, title: 'Task', priority: 3 })
      updateTask(db, task.id, { priority: 1 })
      const updated = getTaskById(db, task.id)
      expect(updated!.priority).toBe(1)
    })

    it('updates agentId', () => {
      const repoId = seedRepo()
      const agent = insertAgent(db, { repoId, name: 'Agent 1', cwd: '/tmp/test-repo' })
      const task = insertTask(db, { repoId, title: 'Task' })
      updateTask(db, task.id, { agentId: agent.id })
      const updated = getTaskById(db, task.id)
      expect(updated!.agentId).toBe(agent.id)
    })

    it('updates multiple fields at once', () => {
      const repoId = seedRepo()
      const task = insertTask(db, { repoId, title: 'Task', priority: 3 })
      updateTask(db, task.id, { title: 'Updated', priority: 1, status: 'in_progress' })
      const updated = getTaskById(db, task.id)
      expect(updated!.title).toBe('Updated')
      expect(updated!.priority).toBe(1)
      expect(updated!.status).toBe('in_progress')
    })
  })

  describe('deleteTask', () => {
    it('removes a task', () => {
      const repoId = seedRepo()
      const task = insertTask(db, { repoId, title: 'Doomed' })
      deleteTask(db, task.id)
      expect(getTaskById(db, task.id)).toBeNull()
    })
  })

  describe('kanban fields', () => {
    it('mapRow includes position and sbarId defaults', () => {
      const repoId = seedRepo()
      const task = insertTask(db, { repoId, title: 'Test', status: 'backlog' })
      const fetched = getTaskById(db, task.id)
      expect(fetched?.position).toBe(0)
      expect(fetched?.sbarId).toBeNull()
      expect(fetched?.sprintName).toBeNull()
      expect(fetched?.epicName).toBeNull()
    })

    it('updateTaskPosition changes position', () => {
      const repoId = seedRepo()
      const task = insertTask(db, { repoId, title: 'Test', status: 'today' })
      updateTaskPosition(db, task.id, 5)
      const fetched = getTaskById(db, task.id)
      expect(fetched?.position).toBe(5)
    })

    it('linkSBARToTask sets sbarId', () => {
      const repoId = seedRepo()
      const task = insertTask(db, { repoId, title: 'Test', status: 'backlog' })
      linkSBARToTask(db, task.id, 'sbar-uuid-123')
      const fetched = getTaskById(db, task.id)
      expect(fetched?.sbarId).toBe('sbar-uuid-123')
    })

    it('insertTask stores sprintName and epicName', () => {
      const repoId = seedRepo()
      const task = insertTask(db, { repoId, title: 'Sprint task', sprintName: 'Sprint 1', epicName: 'Epic A' })
      const fetched = getTaskById(db, task.id)
      expect(fetched?.sprintName).toBe('Sprint 1')
      expect(fetched?.epicName).toBe('Epic A')
    })

    it('mapRow includes projectId and sectionTargetDate', () => {
      const repoId = seedRepo()
      const task = insertTask(db, { repoId, title: 'Test', status: 'backlog' })
      const fetched = getTaskById(db, task.id)
      expect(fetched?.projectId).toBeNull()
      expect(fetched?.sectionTargetDate).toBeNull()
    })
  })

  describe('provider_override validation', () => {
    it('accepts valid provider_override values on insert', () => {
      const repoId = seedRepo()
      for (const prov of ['anthropic', 'ollama-local', 'ollama-cloud', 'openai-codex']) {
        const task = insertTask(db, { repoId, title: `Task ${prov}`, providerOverride: prov })
        expect(task.providerOverride).toBe(prov)
      }
    })

    it('accepts null/undefined provider_override on insert', () => {
      const repoId = seedRepo()
      const task = insertTask(db, { repoId, title: 'No provider' })
      expect(task.providerOverride).toBeNull()
    })

    it('throws on invalid provider_override during insert', () => {
      const repoId = seedRepo()
      expect(() => {
        insertTask(db, { repoId, title: 'Bad', providerOverride: 'invalid-provider' })
      }).toThrow(/Invalid provider_override/)
    })

    it('accepts valid provider_override on update', () => {
      const repoId = seedRepo()
      const task = insertTask(db, { repoId, title: 'Task' })
      updateTask(db, task.id, { providerOverride: 'openai-codex' })
      const updated = getTaskById(db, task.id)
      expect(updated!.providerOverride).toBe('openai-codex')
    })

    it('throws on invalid provider_override during update', () => {
      const repoId = seedRepo()
      const task = insertTask(db, { repoId, title: 'Task' })
      expect(() => {
        updateTask(db, task.id, { providerOverride: 'bogus' })
      }).toThrow(/Invalid provider_override/)
    })
  })

  describe('getCompletedTasksSince', () => {
    it('returns tasks completed after given date', () => {
      const repoId = seedRepo()
      const task = insertTask(db, { repoId, title: 'Done', status: 'completed' })
      const yesterday = new Date(Date.now() - 86400000).toISOString()
      const results = getCompletedTasksSince(db, yesterday)
      expect(results.length).toBeGreaterThanOrEqual(1)
      expect(results.find((t) => t.id === task.id)).toBeDefined()
    })

    it('excludes tasks before the since date', () => {
      const tomorrow = new Date(Date.now() + 86400000).toISOString()
      const results = getCompletedTasksSince(db, tomorrow)
      expect(results).toEqual([])
    })
  })

  describe('MCP metadata columns (8 new fields)', () => {
    describe('insertTask() accepts all 8 new MCP fields', () => {
      it('accepts targetFilesJson field on insert', () => {
        const repoId = seedRepo()
        const targetFiles = JSON.stringify([{ path: 'src/main.ts', type: 'source' }])
        const task = insertTask(db, {
          repoId,
          title: 'Task with target files',
          targetFilesJson: targetFiles
        })
        expect(task.targetFilesJson).toBe(targetFiles)
      })

      it('accepts skillsJson field on insert', () => {
        const repoId = seedRepo()
        const skills = JSON.stringify(['dev-backend', 'tester-backend'])
        const task = insertTask(db, {
          repoId,
          title: 'Task with skills',
          skillsJson: skills
        })
        expect(task.skillsJson).toBe(skills)
      })

      it('accepts guardrailJson field on insert', () => {
        const repoId = seedRepo()
        const guardrails = JSON.stringify({ maxRetries: 3, timeout: 30000 })
        const task = insertTask(db, {
          repoId,
          title: 'Task with guardrails',
          guardrailJson: guardrails
        })
        expect(task.guardrailJson).toBe(guardrails)
      })

      it('accepts riskFactorsJson field on insert', () => {
        const repoId = seedRepo()
        const riskFactors = JSON.stringify({ complexity: 'high', breaking: true })
        const task = insertTask(db, {
          repoId,
          title: 'Task with risk factors',
          riskFactorsJson: riskFactors
        })
        expect(task.riskFactorsJson).toBe(riskFactors)
      })

      it('accepts estimatedTokens field on insert', () => {
        const repoId = seedRepo()
        const task = insertTask(db, {
          repoId,
          title: 'Task with estimated tokens',
          estimatedTokens: 15000
        })
        expect(task.estimatedTokens).toBe(15000)
      })

      it('accepts recommendedModel field on insert', () => {
        const repoId = seedRepo()
        const task = insertTask(db, {
          repoId,
          title: 'Task with recommended model',
          recommendedModel: 'gpt-4-turbo'
        })
        expect(task.recommendedModel).toBe('gpt-4-turbo')
      })

      it('accepts riskScore field on insert', () => {
        const repoId = seedRepo()
        const task = insertTask(db, {
          repoId,
          title: 'Task with risk score',
          riskScore: 0.75
        })
        expect(task.riskScore).toBe(0.75)
      })

      it('accepts createdBy field on insert', () => {
        const repoId = seedRepo()
        const task = insertTask(db, {
          repoId,
          title: 'Task created by agent',
          createdBy: 'dev-backend'
        })
        expect(task.createdBy).toBe('dev-backend')
      })

      it('accepts all 8 MCP fields together on insert', () => {
        const repoId = seedRepo()
        const targetFiles = JSON.stringify([{ path: 'src/main.ts' }])
        const skills = JSON.stringify(['dev-backend'])
        const guardrails = JSON.stringify({ maxRetries: 3 })
        const riskFactors = JSON.stringify({ complexity: 'high' })

        const task = insertTask(db, {
          repoId,
          title: 'Full MCP task',
          targetFilesJson: targetFiles,
          skillsJson: skills,
          guardrailJson: guardrails,
          riskFactorsJson: riskFactors,
          estimatedTokens: 25000,
          recommendedModel: 'claude-opus-4-6',
          riskScore: 0.85,
          createdBy: 'orchestrator'
        })

        expect(task.targetFilesJson).toBe(targetFiles)
        expect(task.skillsJson).toBe(skills)
        expect(task.guardrailJson).toBe(guardrails)
        expect(task.riskFactorsJson).toBe(riskFactors)
        expect(task.estimatedTokens).toBe(25000)
        expect(task.recommendedModel).toBe('claude-opus-4-6')
        expect(task.riskScore).toBe(0.85)
        expect(task.createdBy).toBe('orchestrator')
      })

      it('defaults all MCP fields to null when not provided', () => {
        const repoId = seedRepo()
        const task = insertTask(db, { repoId, title: 'Task without MCP fields' })

        expect(task.targetFilesJson).toBeNull()
        expect(task.skillsJson).toBeNull()
        expect(task.guardrailJson).toBeNull()
        expect(task.riskFactorsJson).toBeNull()
        expect(task.estimatedTokens).toBeNull()
        expect(task.recommendedModel).toBeNull()
        expect(task.riskScore).toBeNull()
        expect(task.createdBy).toBeNull()
      })
    })

    describe('mapRow() correctly parses MCP metadata from database', () => {
      it('mapRow parses targetFilesJson as string', () => {
        const repoId = seedRepo()
        const targetFiles = JSON.stringify([{ path: 'src/main.ts' }])
        const task = insertTask(db, { repoId, title: 'Test', targetFilesJson: targetFiles })
        const fetched = getTaskById(db, task.id)
        expect(fetched?.targetFilesJson).toBe(targetFiles)
      })

      it('mapRow parses skillsJson as string', () => {
        const repoId = seedRepo()
        const skills = JSON.stringify(['dev-backend', 'tester-backend'])
        const task = insertTask(db, { repoId, title: 'Test', skillsJson: skills })
        const fetched = getTaskById(db, task.id)
        expect(fetched?.skillsJson).toBe(skills)
      })

      it('mapRow parses guardrailJson as string', () => {
        const repoId = seedRepo()
        const guardrails = JSON.stringify({ maxRetries: 3, timeout: 30000 })
        const task = insertTask(db, { repoId, title: 'Test', guardrailJson: guardrails })
        const fetched = getTaskById(db, task.id)
        expect(fetched?.guardrailJson).toBe(guardrails)
      })

      it('mapRow parses riskFactorsJson as string', () => {
        const repoId = seedRepo()
        const riskFactors = JSON.stringify({ complexity: 'high', breaking: true })
        const task = insertTask(db, { repoId, title: 'Test', riskFactorsJson: riskFactors })
        const fetched = getTaskById(db, task.id)
        expect(fetched?.riskFactorsJson).toBe(riskFactors)
      })

      it('mapRow parses estimatedTokens as number', () => {
        const repoId = seedRepo()
        const task = insertTask(db, { repoId, title: 'Test', estimatedTokens: 15000 })
        const fetched = getTaskById(db, task.id)
        expect(fetched?.estimatedTokens).toBe(15000)
        expect(typeof fetched?.estimatedTokens).toBe('number')
      })

      it('mapRow parses recommendedModel as string', () => {
        const repoId = seedRepo()
        const task = insertTask(db, { repoId, title: 'Test', recommendedModel: 'gpt-4-turbo' })
        const fetched = getTaskById(db, task.id)
        expect(fetched?.recommendedModel).toBe('gpt-4-turbo')
      })

      it('mapRow parses riskScore as number', () => {
        const repoId = seedRepo()
        const task = insertTask(db, { repoId, title: 'Test', riskScore: 0.75 })
        const fetched = getTaskById(db, task.id)
        expect(fetched?.riskScore).toBe(0.75)
        expect(typeof fetched?.riskScore).toBe('number')
      })

      it('mapRow parses createdBy as string', () => {
        const repoId = seedRepo()
        const task = insertTask(db, { repoId, title: 'Test', createdBy: 'orchestrator' })
        const fetched = getTaskById(db, task.id)
        expect(fetched?.createdBy).toBe('orchestrator')
      })

      it('mapRow returns null for unpopulated MCP fields', () => {
        const repoId = seedRepo()
        const task = insertTask(db, { repoId, title: 'Test' })
        const fetched = getTaskById(db, task.id)
        expect(fetched?.targetFilesJson).toBeNull()
        expect(fetched?.skillsJson).toBeNull()
        expect(fetched?.guardrailJson).toBeNull()
        expect(fetched?.riskFactorsJson).toBeNull()
        expect(fetched?.estimatedTokens).toBeNull()
        expect(fetched?.recommendedModel).toBeNull()
        expect(fetched?.riskScore).toBeNull()
        expect(fetched?.createdBy).toBeNull()
      })
    })

    describe('updateTask() can update MCP metadata fields', () => {
      it('updateTask can set targetFilesJson', () => {
        const repoId = seedRepo()
        const task = insertTask(db, { repoId, title: 'Test' })
        const targetFiles = JSON.stringify([{ path: 'src/new.ts' }])
        updateTask(db, task.id, { targetFilesJson: targetFiles })
        const fetched = getTaskById(db, task.id)
        expect(fetched?.targetFilesJson).toBe(targetFiles)
      })

      it('updateTask can set skillsJson', () => {
        const repoId = seedRepo()
        const task = insertTask(db, { repoId, title: 'Test' })
        const skills = JSON.stringify(['dev-backend', 'orchestrator'])
        updateTask(db, task.id, { skillsJson: skills })
        const fetched = getTaskById(db, task.id)
        expect(fetched?.skillsJson).toBe(skills)
      })

      it('updateTask can set estimatedTokens', () => {
        const repoId = seedRepo()
        const task = insertTask(db, { repoId, title: 'Test' })
        updateTask(db, task.id, { estimatedTokens: 50000 })
        const fetched = getTaskById(db, task.id)
        expect(fetched?.estimatedTokens).toBe(50000)
      })

      it('updateTask can set riskScore', () => {
        const repoId = seedRepo()
        const task = insertTask(db, { repoId, title: 'Test' })
        updateTask(db, task.id, { riskScore: 0.95 })
        const fetched = getTaskById(db, task.id)
        expect(fetched?.riskScore).toBe(0.95)
      })

      it('updateTask can update multiple MCP fields at once', () => {
        const repoId = seedRepo()
        const task = insertTask(db, { repoId, title: 'Test' })
        const targetFiles = JSON.stringify([{ path: 'src/main.ts' }])
        const guardrails = JSON.stringify({ maxRetries: 5 })

        updateTask(db, task.id, {
          targetFilesJson: targetFiles,
          guardrailJson: guardrails,
          estimatedTokens: 20000,
          recommendedModel: 'claude-sonnet-4-6',
          riskScore: 0.65,
          createdBy: 'agent-manager'
        })

        const fetched = getTaskById(db, task.id)
        expect(fetched?.targetFilesJson).toBe(targetFiles)
        expect(fetched?.guardrailJson).toBe(guardrails)
        expect(fetched?.estimatedTokens).toBe(20000)
        expect(fetched?.recommendedModel).toBe('claude-sonnet-4-6')
        expect(fetched?.riskScore).toBe(0.65)
        expect(fetched?.createdBy).toBe('agent-manager')
      })
    })

    describe('mapRow() deserializes JSON columns into typed fields', () => {
      it('parses target_files_json into targetFiles array', () => {
        const repoId = seedRepo()
        const task = insertTask(db, {
          repoId,
          title: 'Deserialization test',
          targetFilesJson: '["src/foo.ts","src/bar.ts"]',
          skillsJson: '["sec-devops"]'
        })
        const fetched = getTaskById(db, task.id)
        expect(Array.isArray(fetched?.targetFiles)).toBe(true)
        expect(fetched?.targetFiles).toEqual(['src/foo.ts', 'src/bar.ts'])
        expect(typeof fetched?.targetFilesJson).toBe('string')
      })

      it('parses skills_json into skills array', () => {
        const repoId = seedRepo()
        const task = insertTask(db, {
          repoId,
          title: 'Skills deserialization',
          skillsJson: '["sec-devops"]'
        })
        const fetched = getTaskById(db, task.id)
        expect(fetched?.skills).toEqual(['sec-devops'])
        expect(typeof fetched?.skillsJson).toBe('string')
      })

      it('parses guardrail_json into guardrailOverrides record', () => {
        const repoId = seedRepo()
        const task = insertTask(db, {
          repoId,
          title: 'Guardrail deserialization',
          guardrailJson: '{"maxRetries":3,"timeout":30000}'
        })
        const fetched = getTaskById(db, task.id)
        expect(fetched?.guardrailOverrides).toEqual({ maxRetries: 3, timeout: 30000 })
      })

      it('parses risk_factors_json into riskFactors array', () => {
        const repoId = seedRepo()
        const task = insertTask(db, {
          repoId,
          title: 'Risk factors deserialization',
          riskFactorsJson: '["db-migration","breaking-change"]'
        })
        const fetched = getTaskById(db, task.id)
        expect(fetched?.riskFactors).toEqual(['db-migration', 'breaking-change'])
      })

      it('returns null typed fields when JSON columns are null', () => {
        const repoId = seedRepo()
        const task = insertTask(db, { repoId, title: 'No JSON fields' })
        const fetched = getTaskById(db, task.id)
        expect(fetched?.targetFiles).toBeNull()
        expect(fetched?.skills).toBeNull()
        expect(fetched?.guardrailOverrides).toBeNull()
        expect(fetched?.riskFactors).toBeNull()
      })

      it('returns null typed fields when JSON columns contain malformed JSON', () => {
        const repoId = seedRepo()
        const task = insertTask(db, { repoId, title: 'Malformed JSON' })
        // Bypass insertTask validation by directly writing malformed JSON via updateTask
        db.prepare("UPDATE tasks SET target_files_json = ?, skills_json = ? WHERE id = ?")
          .run('not-valid-json', '{broken', task.id)
        const fetched = getTaskById(db, task.id)
        expect(fetched?.targetFiles).toBeNull()
        expect(fetched?.skills).toBeNull()
        // raw strings are preserved
        expect(fetched?.targetFilesJson).toBe('not-valid-json')
        expect(fetched?.skillsJson).toBe('{broken')
      })
    })

    describe('getAllTasks() retrieves MCP metadata fields', () => {
      it('getAllTasks includes MCP metadata for all tasks', () => {
        const repoId = seedRepo()
        const targetFiles = JSON.stringify([{ path: 'src/main.ts' }])
        const skills = JSON.stringify(['dev-backend'])
        insertTask(db, {
          repoId,
          title: 'Task 1',
          targetFilesJson: targetFiles,
          skillsJson: skills,
          estimatedTokens: 10000,
          riskScore: 0.5
        })

        const tasks = getAllTasks(db)
        const found = tasks.find((t) => t.title === 'Task 1')
        expect(found?.targetFilesJson).toBe(targetFiles)
        expect(found?.skillsJson).toBe(skills)
        expect(found?.estimatedTokens).toBe(10000)
        expect(found?.riskScore).toBe(0.5)
      })
    })
  })
})
