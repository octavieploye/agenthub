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
    source: 'project',
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

  it('displays skills grouped by category in accordion sections', async () => {
    const skills = [
      createMockSkill({ id: 'a', name: 'Skill A', category: 'testing' }),
      createMockSkill({ id: 'b', name: 'Skill B', category: 'deploy' })
    ]
    mockList.mockResolvedValue({ success: true, data: skills })

    render(<SkillsDropdown {...defaultProps} />)

    await waitFor(() => {
      expect(screen.getByTestId('section-testing')).toBeInTheDocument()
      expect(screen.getByTestId('section-deploy')).toBeInTheDocument()
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

  it('shows source badges (project/team)', async () => {
    const skills = [
      createMockSkill({ id: 'p', name: 'Project', source: 'project' }),
      createMockSkill({ id: 't', name: 'Team', source: 'team' })
    ]
    mockList.mockResolvedValue({ success: true, data: skills })

    render(<SkillsDropdown {...defaultProps} />)

    await waitFor(() => {
      expect(screen.getByText('project')).toBeInTheDocument()
      expect(screen.getByText('team')).toBeInTheDocument()
    })
  })

  it('shows empty state when no skills found', async () => {
    mockList.mockResolvedValue({ success: true, data: [] })

    render(<SkillsDropdown {...defaultProps} />)

    await waitFor(() => {
      expect(screen.getByText('No skills found')).toBeInTheDocument()
    })
  })

  it('renders accordion section headers with item counts', async () => {
    const skills = [
      createMockSkill({ id: 'a', name: 'Skill A', category: 'Code Quality' }),
      createMockSkill({ id: 'b', name: 'Skill B', category: 'Code Quality' }),
      createMockSkill({ id: 'c', name: 'Skill C', category: 'Teams' })
    ]
    mockList.mockResolvedValue({ success: true, data: skills })

    render(<SkillsDropdown {...defaultProps} />)

    await waitFor(() => {
      expect(screen.getByTestId('section-Code Quality')).toBeInTheDocument()
      expect(screen.getByTestId('section-Teams')).toBeInTheDocument()
      expect(screen.getByText('2')).toBeInTheDocument() // count badge
      expect(screen.getByText('1')).toBeInTheDocument()
    })
  })

  it('toggles accordion section on click', async () => {
    const skills = [
      createMockSkill({ id: 'a', name: 'Skill A', category: 'Code Quality' }),
      createMockSkill({ id: 'b', name: 'Skill B', category: 'Teams' })
    ]
    mockList.mockResolvedValue({ success: true, data: skills })

    render(<SkillsDropdown {...defaultProps} />)

    await waitFor(() => {
      expect(screen.getByText('Skill A')).toBeInTheDocument()
    })

    // Click to collapse the first section
    await act(async () => {
      fireEvent.click(screen.getByTestId('section-Code Quality'))
    })

    expect(screen.queryByText('Skill A')).not.toBeInTheDocument()

    // Click to re-expand
    await act(async () => {
      fireEvent.click(screen.getByTestId('section-Code Quality'))
    })

    expect(screen.getByText('Skill A')).toBeInTheDocument()
  })

  it('uses displayName when available', async () => {
    const skills = [
      createMockSkill({ id: 'token-optimizer', name: 'token-optimizer', displayName: 'Optimize AI Instructions', category: 'Code Quality' })
    ]
    mockList.mockResolvedValue({ success: true, data: skills })

    render(<SkillsDropdown {...defaultProps} />)

    await waitFor(() => {
      expect(screen.getByText('Optimize AI Instructions')).toBeInTheDocument()
      expect(screen.queryByText('token-optimizer')).not.toBeInTheDocument()
    })
  })

  it('shows description tooltip on hover', async () => {
    const skills = [
      createMockSkill({ id: 'a', name: 'Skill A', description: 'This is the full description' })
    ]
    mockList.mockResolvedValue({ success: true, data: skills })

    render(<SkillsDropdown {...defaultProps} />)

    await waitFor(() => {
      expect(screen.getByTestId('skill-a')).toBeInTheDocument()
    })

    const skillBtn = screen.getByTestId('skill-a')
    expect(skillBtn.getAttribute('title')).toBe('This is the full description')
  })

  it('auto-expands matching sections and collapses non-matching on search', async () => {
    const skills = [
      createMockSkill({ id: 'a', name: 'Deploy App', category: 'Code Quality' }),
      createMockSkill({ id: 'b', name: 'Market Scan', category: 'Market Intelligence' })
    ]
    mockList.mockResolvedValue({ success: true, data: skills })

    render(<SkillsDropdown {...defaultProps} />)

    await waitFor(() => {
      expect(screen.getByText('Deploy App')).toBeInTheDocument()
    })

    await act(async () => {
      fireEvent.change(screen.getByTestId('skills-search'), { target: { value: 'Market' } })
    })

    await waitFor(() => {
      expect(screen.getByText('Market Scan')).toBeInTheDocument()
      expect(screen.queryByText('Deploy App')).not.toBeInTheDocument()
    })
  })
})
