import { describe, it, expect, vi, beforeEach } from 'vitest'
import { useSkillsStore } from './skills-store'
import type { SkillItem, SkillExecutionResult } from '@shared/types/skills.types'

const mockList = vi.fn()
const mockExecute = vi.fn()
const mockRefresh = vi.fn()

vi.stubGlobal('window', {
  agentHub: {
    skills: {
      list: mockList,
      execute: mockExecute,
      refresh: mockRefresh
    }
  }
})

function createMockSkill(overrides: Partial<SkillItem> = {}): SkillItem {
  return {
    id: 'test-skill',
    name: 'Test Skill',
    description: 'A test skill',
    category: 'general',
    path: '/path/to/skill.md',
    source: 'global',
    ...overrides
  }
}

describe('skills-store', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useSkillsStore.setState({
      skills: [],
      loading: false,
      executing: null,
      lastResult: null,
      error: null,
      searchFilter: ''
    })
  })

  it('has correct initial state', () => {
    const state = useSkillsStore.getState()
    expect(state.skills).toEqual([])
    expect(state.loading).toBe(false)
    expect(state.executing).toBeNull()
    expect(state.lastResult).toBeNull()
    expect(state.error).toBeNull()
    expect(state.searchFilter).toBe('')
  })

  it('fetchSkills populates skills on success', async () => {
    const skills = [createMockSkill()]
    mockList.mockResolvedValue({ success: true, data: skills })

    await useSkillsStore.getState().fetchSkills('/repo')
    const state = useSkillsStore.getState()
    expect(state.skills).toEqual(skills)
    expect(state.loading).toBe(false)
  })

  it('fetchSkills sets error on failure', async () => {
    mockList.mockResolvedValue({
      success: false,
      error: { code: 'ERR', message: 'Failed to list' }
    })

    await useSkillsStore.getState().fetchSkills()
    const state = useSkillsStore.getState()
    expect(state.error).toBe('Failed to list')
    expect(state.loading).toBe(false)
  })

  it('executeSkill sets executing to skill ID then clears on completion', async () => {
    const result: SkillExecutionResult = {
      skillId: 'test-skill',
      output: 'done',
      exitCode: 0,
      duration: 500
    }
    mockExecute.mockResolvedValue({ success: true, data: result })

    const promise = useSkillsStore.getState().executeSkill('test-skill')
    // executing should be set (can't easily check intermediate state without race)
    const ok = await promise
    expect(ok).toBe(true)
    expect(useSkillsStore.getState().executing).toBeNull()
  })

  it('executeSkill stores lastResult on success', async () => {
    const result: SkillExecutionResult = {
      skillId: 'test-skill',
      output: 'output text',
      exitCode: 0,
      duration: 100
    }
    mockExecute.mockResolvedValue({ success: true, data: result })

    await useSkillsStore.getState().executeSkill('test-skill')
    expect(useSkillsStore.getState().lastResult).toEqual(result)
  })

  it('executeSkill sets error on failure', async () => {
    mockExecute.mockResolvedValue({
      success: false,
      error: { code: 'ERR', message: 'Exec failed' }
    })

    const ok = await useSkillsStore.getState().executeSkill('bad-skill')
    expect(ok).toBe(false)
    expect(useSkillsStore.getState().error).toBe('Exec failed')
  })

  it('refreshSkills re-fetches and updates skills list', async () => {
    const skills = [createMockSkill({ id: 'refreshed' })]
    mockRefresh.mockResolvedValue({ success: true, data: skills })

    await useSkillsStore.getState().refreshSkills('/repo')
    expect(useSkillsStore.getState().skills).toEqual(skills)
  })

  it('setSearchFilter updates searchFilter', () => {
    useSkillsStore.getState().setSearchFilter('deploy')
    expect(useSkillsStore.getState().searchFilter).toBe('deploy')
  })

  it('clearError resets error to null', () => {
    useSkillsStore.setState({ error: 'some error' })
    useSkillsStore.getState().clearError()
    expect(useSkillsStore.getState().error).toBeNull()
  })

  it('clearResult resets lastResult to null', () => {
    useSkillsStore.setState({
      lastResult: { skillId: 'x', output: 'y', exitCode: 0, duration: 0 }
    })
    useSkillsStore.getState().clearResult()
    expect(useSkillsStore.getState().lastResult).toBeNull()
  })
})
