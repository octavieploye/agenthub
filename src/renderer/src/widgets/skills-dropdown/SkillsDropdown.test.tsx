import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest'
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import SkillsDropdown from './SkillsDropdown'
import { useSkillsStore } from '@renderer/stores/skills-store'
import type { SkillItem } from '@shared/types/skills.types'

// Mock window.agentHub.skills
const mockList = vi.fn()
const mockExecute = vi.fn()
const mockRefresh = vi.fn()

beforeAll(() => {
  Object.defineProperty(window, 'agentHub', {
    value: {
      skills: {
        list: mockList,
        execute: mockExecute,
        refresh: mockRefresh
      }
    },
    writable: true
  })
})

function createMockSkill(overrides: Partial<SkillItem> = {}): SkillItem {
  return {
    id: 'test-skill',
    name: 'Test Skill',
    description: 'A test skill description',
    category: 'general',
    path: '/path/to/skill.md',
    source: 'global',
    ...overrides
  }
}

describe('SkillsDropdown', () => {
  const defaultProps = {
    isOpen: true,
    onClose: vi.fn(),
    repoPath: '/test/repo'
  }

  beforeEach(() => {
    vi.clearAllMocks()
    mockList.mockResolvedValue({ success: true, data: [] })
    mockRefresh.mockResolvedValue({ success: true, data: [] })
    mockExecute.mockResolvedValue({
      success: true,
      data: { skillId: 'test', output: 'done', exitCode: 0, duration: 100 }
    })
    // Reset store
    useSkillsStore.setState({
      skills: [],
      loading: false,
      executing: null,
      lastResult: null,
      error: null,
      searchFilter: ''
    })
  })

  it('renders nothing when isOpen is false', () => {
    render(<SkillsDropdown {...defaultProps} isOpen={false} />)
    expect(screen.queryByTestId('skills-dropdown')).not.toBeInTheDocument()
  })

  it('renders dropdown with search input when isOpen is true', async () => {
    render(<SkillsDropdown {...defaultProps} />)
    expect(screen.getByTestId('skills-dropdown')).toBeInTheDocument()
    expect(screen.getByTestId('skills-search')).toBeInTheDocument()
  })

  it('displays skills grouped by category', async () => {
    const skills = [
      createMockSkill({ id: 'a', name: 'Skill A', category: 'testing' }),
      createMockSkill({ id: 'b', name: 'Skill B', category: 'deploy' })
    ]
    mockList.mockResolvedValue({ success: true, data: skills })

    render(<SkillsDropdown {...defaultProps} />)

    await waitFor(() => {
      expect(screen.getByText('testing')).toBeInTheDocument()
      expect(screen.getByText('deploy')).toBeInTheDocument()
      expect(screen.getByText('Skill A')).toBeInTheDocument()
      expect(screen.getByText('Skill B')).toBeInTheDocument()
    })
  })

  it('filters skills when typing in search', async () => {
    const skills = [
      createMockSkill({ id: 'deploy', name: 'Deploy App' }),
      createMockSkill({ id: 'test', name: 'Run Tests' })
    ]
    mockList.mockResolvedValue({ success: true, data: skills })

    render(<SkillsDropdown {...defaultProps} />)

    await waitFor(() => {
      expect(screen.getByText('Deploy App')).toBeInTheDocument()
    })

    await act(async () => {
      fireEvent.change(screen.getByTestId('skills-search'), { target: { value: 'Deploy' } })
    })

    await waitFor(() => {
      expect(screen.getByText('Deploy App')).toBeInTheDocument()
      expect(screen.queryByText('Run Tests')).not.toBeInTheDocument()
    })
  })

  it('calls executeSkill when clicking a skill', async () => {
    const skills = [createMockSkill({ id: 'my-skill', name: 'My Skill' })]
    mockList.mockResolvedValue({ success: true, data: skills })

    render(<SkillsDropdown {...defaultProps} />)

    await waitFor(() => {
      expect(screen.getByText('My Skill')).toBeInTheDocument()
    })

    await act(async () => {
      fireEvent.click(screen.getByTestId('skill-my-skill'))
    })

    expect(mockExecute).toHaveBeenCalledWith('my-skill', '/test/repo')
  })

  it('shows execution result after skill runs', async () => {
    const skills = [createMockSkill({ id: 'run', name: 'Run It' })]
    mockList.mockResolvedValue({ success: true, data: skills })
    mockExecute.mockResolvedValue({
      success: true,
      data: { skillId: 'run', output: 'Success output', exitCode: 0, duration: 1500 }
    })

    render(<SkillsDropdown {...defaultProps} />)

    await waitFor(() => {
      expect(screen.getByText('Run It')).toBeInTheDocument()
    })

    await act(async () => {
      fireEvent.click(screen.getByTestId('skill-run'))
    })

    await waitFor(() => {
      expect(screen.getByText('exit 0')).toBeInTheDocument()
      expect(screen.getByText(/Success output/)).toBeInTheDocument()
    })
  })

  it('calls refreshSkills when clicking refresh button', async () => {
    render(<SkillsDropdown {...defaultProps} />)

    await act(async () => {
      fireEvent.click(screen.getByTestId('skills-refresh'))
    })

    expect(mockRefresh).toHaveBeenCalledWith('/test/repo')
  })

  it('calls onClose when pressing Escape', async () => {
    render(<SkillsDropdown {...defaultProps} />)

    fireEvent.keyDown(window, { key: 'Escape' })
    expect(defaultProps.onClose).toHaveBeenCalled()
  })

  it('shows source badges (global/project)', async () => {
    const skills = [
      createMockSkill({ id: 'g', name: 'Global', source: 'global' }),
      createMockSkill({ id: 'p', name: 'Project', source: 'project' })
    ]
    mockList.mockResolvedValue({ success: true, data: skills })

    render(<SkillsDropdown {...defaultProps} />)

    await waitFor(() => {
      expect(screen.getByText('global')).toBeInTheDocument()
      expect(screen.getByText('project')).toBeInTheDocument()
    })
  })

  it('shows empty state when no skills found', async () => {
    mockList.mockResolvedValue({ success: true, data: [] })

    render(<SkillsDropdown {...defaultProps} />)

    await waitFor(() => {
      expect(screen.getByText('No skills found')).toBeInTheDocument()
    })
  })
})
