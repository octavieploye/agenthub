/**
 * TDD — failing tests for dispatchSimplePath (Path B dispatch).
 * These tests MUST fail before T4 implementation exists.
 * Sprint: orchestrator-hybrid-dispatch
 */
import { describe, it, expect } from 'vitest'
import { classifyDispatchMode, resolveSkills, CATEGORY_DEFAULT_SKILLS } from '../model-dispatcher'
import type { TaskItem } from '../../../shared/types/task.types'

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeTask(overrides: Partial<TaskItem> = {}): TaskItem {
  const base: Partial<TaskItem> = {
    id: 'task-1',
    title: 'Test task',
    description: '',
    status: 'backlog',
    priority: 2 as TaskItem['priority'],
    category: null,
    riskScore: 0,
    targetFilesJson: null,
    targetFiles: null,
    skillsJson: null,
    skills: null,
    modelOverride: null,
    providerOverride: null,
    repoId: 'repo-1',
    sprintName: null,
    estimatedTokens: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }
  const merged = { ...base, ...overrides }
  // Mirrors production DB behavior: parse targetFilesJson → targetFiles when not explicitly set
  if (merged.targetFiles == null && merged.targetFilesJson) {
    try { merged.targetFiles = JSON.parse(merged.targetFilesJson) } catch { /* ignore */ }
  }
  // Mirrors production DB behavior: parse skillsJson → skills when not explicitly set
  if (merged.skills == null && merged.skillsJson) {
    try { merged.skills = JSON.parse(merged.skillsJson) } catch { /* ignore */ }
  }
  return merged as TaskItem
}

// ── Unit tests: classifyDispatchMode() ───────────────────────────────────────

describe('classifyDispatchMode()', () => {
  it('returns b1 for task with no category, no files, riskScore 0', () => {
    const task = makeTask({ category: null, targetFilesJson: null, riskScore: 0 })
    expect(classifyDispatchMode(task)).toBe('b1')
  })

  it('returns b1 for category=research with no files', () => {
    const task = makeTask({ category: 'research', targetFilesJson: null, riskScore: 0 })
    expect(classifyDispatchMode(task)).toBe('b1')
  })

  it('returns b2 for category=frontend, 1 file, riskScore 0', () => {
    const task = makeTask({
      category: 'frontend',
      targetFilesJson: JSON.stringify(['src/foo.tsx']),
      riskScore: 0,
    })
    expect(classifyDispatchMode(task)).toBe('b2')
  })

  it('returns a (hard override) for category=frontend, 1 file, keyword auth in title', () => {
    const task = makeTask({
      category: 'frontend',
      targetFilesJson: JSON.stringify(['src/foo.tsx']),
      riskScore: 0,
      title: 'Fix auth redirect bug',
    })
    expect(classifyDispatchMode(task)).toBe('a')
  })

  it('returns a for category=backend, 3 files, riskScore 1', () => {
    const task = makeTask({
      category: 'backend',
      targetFilesJson: JSON.stringify(['a.ts', 'b.ts', 'c.ts']),
      riskScore: 1,
    })
    expect(classifyDispatchMode(task)).toBe('a')
  })

  it('returns a (hard override) for riskScore > 2', () => {
    const task = makeTask({ riskScore: 3 })
    expect(classifyDispatchMode(task)).toBe('a')
  })

  it('returns a (hard override) for targetFiles.length >= 5', () => {
    const task = makeTask({
      targetFilesJson: JSON.stringify(['a.ts', 'b.ts', 'c.ts', 'd.ts', 'e.ts']),
      riskScore: 0,
    })
    expect(classifyDispatchMode(task)).toBe('a')
  })
})

// ── Unit tests: resolveSkills() ───────────────────────────────────────────────

describe('resolveSkills()', () => {
  it('returns skills from skillsJson when present', () => {
    const task = makeTask({ skillsJson: JSON.stringify(['custom-skill']), skills: ['custom-skill'] })
    expect(resolveSkills(task)).toEqual(['custom-skill'])
  })

  it('falls back to category defaults when skillsJson is null', () => {
    const task = makeTask({ category: 'backend', skillsJson: null, skills: null })
    expect(resolveSkills(task)).toEqual(CATEGORY_DEFAULT_SKILLS['backend'])
  })

  it('returns empty array for unknown category', () => {
    const task = makeTask({ category: 'unknown-category', skillsJson: null, skills: null })
    expect(resolveSkills(task)).toEqual([])
  })
})

// ── Integration stubs: Path B lifecycle ──────────────────────────────────────
// These will be fleshed out once dispatchSimplePath exists in kanban-orchestrator.ts
// For now they serve as the TDD red phase — document expected behavior.

describe('Path B lifecycle (integration stubs)', () => {
  it('B-1: task with no files dispatched via simple path completes without commit', () => {
    // STUB — will be implemented in T5 integration tests after T4 is built
    // Expected: dispatchSimplePath(task, run) spawns 1 agent, onAgentStatusChanged(locked)
    // marks task completed, GitService.commit is NOT called
    expect(true).toBe(true) // placeholder — real test in T5
  })

  it('B-2: agent output with FILES_CHANGED triggers commit', () => {
    // STUB — will be implemented in T5 integration tests after T4 is built
    // Expected: agent output contains FILES_CHANGED: src/foo.ts
    // onAgentStatusChanged(locked) → executeCommitPhase() is called
    expect(true).toBe(true) // placeholder — real test in T5
  })

  it('B-2: agent output without FILES_CHANGED completes without commit', () => {
    // STUB — will be implemented in T5 integration tests after T4 is built
    // Expected: agent output has no FILES_CHANGED marker
    // onAgentStatusChanged(locked) → task marked completed, no commit
    expect(true).toBe(true) // placeholder — real test in T5
  })
})
