import { existsSync } from 'fs'
import { join } from 'path'
import type Database from 'better-sqlite3'
import { runValidation, type ValidationCheck } from './helpers/validation-pipeline'
import { validateModelOverride } from './helpers/model-validator'
import type { SlidingWindowLimiter } from './helpers/rate-limiter'
import { getTaskById } from '../db/queries/tasks.queries'
import { getRepoById } from '../db/queries/repos.queries'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface BrainDecision {
  taskId: string
  skill: string
  model: string
  reason: string
}

export interface ValidatorContext {
  db: Database.Database
  rateLimiter: SlidingWindowLimiter
  maxAgents: number
  currentAgentCount: number
  runId: string
  /** Resolved agenthub root path (handles packaged vs dev builds). Use app.isPackaged ? join(app.getAppPath(), '..') : process.cwd() */
  agenthubPath: string
  /** Provider for model validation (e.g. 'ollama-cloud', 'anthropic'). Null skips provider-specific model check. */
  provider: string | null
}

export type ValidationOutcome = { valid: boolean; failures: string[] }

// ---------------------------------------------------------------------------
// Validator
// ---------------------------------------------------------------------------

export class OrchestratorValidator {
  validate(decision: BrainDecision, context: ValidatorContext): ValidationOutcome {
    const checks: ValidationCheck[] = [
      {
        name: 'task-exists',
        check: () => this.checkTaskExists(decision.taskId, context.db)
      },
      {
        name: 'model-allowed',
        check: () => this.checkModelAllowed(decision.model, context.provider)
      },
      {
        name: 'budget-ok',
        check: () => this.checkBudgetOk(context.currentAgentCount, context.maxAgents)
      },
      {
        name: 'rate-limit-ok',
        check: () => this.checkRateLimitOk(context.rateLimiter)
      },
      {
        name: 'repo-exists',
        check: () => this.checkRepoExists(decision.taskId, context.db)
      },
      {
        name: 'skill-exists',
        check: () => {
          const task = getTaskById(context.db, decision.taskId)
          const repo = task ? getRepoById(context.db, task.repoId) : null
          return this.checkSkillExists(decision.skill, context.agenthubPath, repo?.path)
        }
      }
    ]

    const result = runValidation(checks)

    if (!result.passed) {
      return { valid: false, failures: result.failures }
    }

    return { valid: true, failures: [] }
  }

  private checkTaskExists(taskId: string, db: Database.Database): boolean | string {
    const task = getTaskById(db, taskId)
    if (!task) {
      return `task not found: ${taskId}`
    }
    const dispatchable = new Set(['backlog', 'today', 'ready'])
    if (!dispatchable.has(task.status)) {
      return `task not in dispatchable status: ${task.status}`
    }
    return true
  }

  private checkModelAllowed(model: string, provider: string | null): boolean | string {
    const error = validateModelOverride(model, provider)
    if (error) {
      return `model not allowed: ${error}`
    }
    return true
  }

  private checkBudgetOk(currentAgentCount: number, maxAgents: number): boolean | string {
    if (currentAgentCount >= maxAgents) {
      return `agent budget exhausted: ${currentAgentCount}/${maxAgents}`
    }
    return true
  }

  private checkRateLimitOk(limiter: SlidingWindowLimiter): boolean | string {
    if (!limiter.tryAcquire()) {
      return 'rate limit hit'
    }
    return true
  }

  private checkRepoExists(taskId: string, db: Database.Database): boolean | string {
    const task = getTaskById(db, taskId)
    if (!task) {
      return 'task not found'
    }
    const repo = getRepoById(db, task.repoId)
    if (!repo) {
      return `repo not found: ${task.repoId}`
    }
    if (!existsSync(repo.path)) {
      return `repo path not found: ${repo.path}`
    }
    return true
  }

  private checkSkillExists(skill: string | null | undefined, agenthubPath: string, targetRepoPath?: string): boolean | string {
    // Null or empty skill is allowed (no skill requirement)
    if (!skill) {
      return true
    }

    // Check agenthub .claude/skills/{skill}/SKILL.md
    const claudeSkillPath = join(agenthubPath, '.claude', 'skills', skill, 'SKILL.md')
    if (existsSync(claudeSkillPath)) {
      return true
    }

    // Check agenthub plugin/skills/{skill}/SKILL.md
    const pluginSkillPath = join(agenthubPath, 'plugin', 'skills', skill, 'SKILL.md')
    if (existsSync(pluginSkillPath)) {
      return true
    }

    // Check target repo skill dirs (cross-repo dispatch)
    if (targetRepoPath && existsSync(targetRepoPath)) {
      const targetClaudeSkillPath = join(targetRepoPath, '.claude', 'skills', skill, 'SKILL.md')
      if (existsSync(targetClaudeSkillPath)) {
        return true
      }

      const targetPluginSkillPath = join(targetRepoPath, 'plugin', 'skills', skill, 'SKILL.md')
      if (existsSync(targetPluginSkillPath)) {
        return true
      }
    }

    return `skill not found: ${skill}`
  }
}
