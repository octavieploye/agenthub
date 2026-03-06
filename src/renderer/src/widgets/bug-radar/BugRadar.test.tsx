import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import BugRadar from './BugRadar'
import type { BugEntry } from '@shared/types/bug-radar.types'

function createMockBug(overrides: Partial<BugEntry> = {}): BugEntry {
  return {
    id: 'bug-1',
    agentId: 'agent-1',
    agentName: 'agent-alpha',
    repoId: 'repo-1',
    repoName: 'frontend-app',
    errorType: 'test_failure',
    filePath: 'src/components/Button.test.tsx',
    message: 'Expected true to be false',
    severity: 'medium',
    resolvedAt: null,
    createdAt: '2026-03-05T10:00:00Z',
    ...overrides
  }
}

describe('BugRadar', () => {
  const mockOnNavigateToAgent = vi.fn()
  const mockOnResolveBug = vi.fn()

  const defaultRepos = [
    { id: 'repo-1', name: 'frontend-app' },
    { id: 'repo-2', name: 'backend-api' }
  ]

  beforeEach(() => {
    vi.clearAllMocks()
  })

  // ─── rendering ──────────────────────────────────────────────────

  describe('rendering', () => {
    it('renders "Bug Radar" heading', () => {
      render(
        <BugRadar
          bugs={[]}
          repos={defaultRepos}
          onNavigateToAgent={mockOnNavigateToAgent}
          onResolveBug={mockOnResolveBug}
        />
      )
      expect(screen.getByText('Bug Radar')).toBeInTheDocument()
    })

    it('renders bug entries grouped by repo name', () => {
      const bugs = [
        createMockBug({
          id: 'bug-1',
          repoId: 'repo-1',
          repoName: 'frontend-app',
          message: 'UI crash'
        }),
        createMockBug({
          id: 'bug-2',
          repoId: 'repo-2',
          repoName: 'backend-api',
          message: 'API timeout'
        }),
        createMockBug({
          id: 'bug-3',
          repoId: 'repo-1',
          repoName: 'frontend-app',
          message: 'Style mismatch'
        })
      ]

      render(
        <BugRadar
          bugs={bugs}
          repos={defaultRepos}
          onNavigateToAgent={mockOnNavigateToAgent}
          onResolveBug={mockOnResolveBug}
        />
      )

      // Repo name headings should be visible as group headers
      expect(screen.getByText('frontend-app')).toBeInTheDocument()
      expect(screen.getByText('backend-api')).toBeInTheDocument()
    })

    it('renders empty state message when no bugs', () => {
      render(
        <BugRadar
          bugs={[]}
          repos={defaultRepos}
          onNavigateToAgent={mockOnNavigateToAgent}
          onResolveBug={mockOnResolveBug}
        />
      )

      expect(screen.getByTestId('bug-radar-empty')).toBeInTheDocument()
    })

    it('shows agent name for each bug entry', () => {
      const bugs = [
        createMockBug({ id: 'bug-1', agentName: 'agent-alpha' }),
        createMockBug({ id: 'bug-2', agentName: 'agent-beta' })
      ]

      render(
        <BugRadar
          bugs={bugs}
          repos={defaultRepos}
          onNavigateToAgent={mockOnNavigateToAgent}
          onResolveBug={mockOnResolveBug}
        />
      )

      expect(screen.getByText('agent-alpha')).toBeInTheDocument()
      expect(screen.getByText('agent-beta')).toBeInTheDocument()
    })

    it('shows error type for each bug entry', () => {
      const bugs = [
        createMockBug({ id: 'bug-1', errorType: 'test_failure' }),
        createMockBug({ id: 'bug-2', errorType: 'compile_error' })
      ]

      render(
        <BugRadar
          bugs={bugs}
          repos={defaultRepos}
          onNavigateToAgent={mockOnNavigateToAgent}
          onResolveBug={mockOnResolveBug}
        />
      )

      expect(screen.getByText('test_failure')).toBeInTheDocument()
      expect(screen.getByText('compile_error')).toBeInTheDocument()
    })

    it('shows file path for each bug entry', () => {
      const bugs = [
        createMockBug({
          id: 'bug-1',
          filePath: 'src/components/Button.test.tsx'
        }),
        createMockBug({
          id: 'bug-2',
          filePath: 'src/utils/parser.ts'
        })
      ]

      render(
        <BugRadar
          bugs={bugs}
          repos={defaultRepos}
          onNavigateToAgent={mockOnNavigateToAgent}
          onResolveBug={mockOnResolveBug}
        />
      )

      expect(screen.getByText('src/components/Button.test.tsx')).toBeInTheDocument()
      expect(screen.getByText('src/utils/parser.ts')).toBeInTheDocument()
    })

    it('shows severity badge for each bug entry', () => {
      const bugs = [
        createMockBug({ id: 'bug-1', severity: 'critical' }),
        createMockBug({ id: 'bug-2', severity: 'low' })
      ]

      render(
        <BugRadar
          bugs={bugs}
          repos={defaultRepos}
          onNavigateToAgent={mockOnNavigateToAgent}
          onResolveBug={mockOnResolveBug}
        />
      )

      const criticalBadge = screen.getByTestId('severity-badge-bug-1')
      expect(criticalBadge).toHaveTextContent('critical')

      const lowBadge = screen.getByTestId('severity-badge-bug-2')
      expect(lowBadge).toHaveTextContent('low')
    })
  })

  // ─── filtering ──────────────────────────────────────────────────

  describe('filtering', () => {
    it('has a severity filter with options: all, low, medium, high, critical', () => {
      render(
        <BugRadar
          bugs={[]}
          repos={defaultRepos}
          onNavigateToAgent={mockOnNavigateToAgent}
          onResolveBug={mockOnResolveBug}
        />
      )

      const severityFilter = screen.getByTestId('severity-filter')
      expect(severityFilter).toBeInTheDocument()

      const options = severityFilter.querySelectorAll('option')
      const optionValues = Array.from(options).map((o) => o.getAttribute('value'))
      expect(optionValues).toContain('all')
      expect(optionValues).toContain('low')
      expect(optionValues).toContain('medium')
      expect(optionValues).toContain('high')
      expect(optionValues).toContain('critical')
    })

    it('has a repo filter with repo names', () => {
      render(
        <BugRadar
          bugs={[]}
          repos={defaultRepos}
          onNavigateToAgent={mockOnNavigateToAgent}
          onResolveBug={mockOnResolveBug}
        />
      )

      const repoFilter = screen.getByTestId('repo-filter')
      expect(repoFilter).toBeInTheDocument()

      const options = repoFilter.querySelectorAll('option')
      const optionTexts = Array.from(options).map((o) => o.textContent)
      expect(optionTexts).toContain('frontend-app')
      expect(optionTexts).toContain('backend-api')
    })
  })

  // ─── interactions ───────────────────────────────────────────────

  describe('interactions', () => {
    it('calls onNavigateToAgent when bug entry is clicked', () => {
      const bugs = [
        createMockBug({ id: 'bug-42', agentId: 'agent-42' })
      ]

      render(
        <BugRadar
          bugs={bugs}
          repos={defaultRepos}
          onNavigateToAgent={mockOnNavigateToAgent}
          onResolveBug={mockOnResolveBug}
        />
      )

      const bugEntry = screen.getByTestId('bug-entry-bug-42')
      fireEvent.click(bugEntry)

      expect(mockOnNavigateToAgent).toHaveBeenCalledTimes(1)
      expect(mockOnNavigateToAgent).toHaveBeenCalledWith('agent-42')
    })

    it('calls onResolveBug when resolve button is clicked', () => {
      const bugs = [
        createMockBug({ id: 'bug-99' })
      ]

      render(
        <BugRadar
          bugs={bugs}
          repos={defaultRepos}
          onNavigateToAgent={mockOnNavigateToAgent}
          onResolveBug={mockOnResolveBug}
        />
      )

      const resolveButton = screen.getByTestId('resolve-bug-bug-99')
      fireEvent.click(resolveButton)

      expect(mockOnResolveBug).toHaveBeenCalledTimes(1)
      expect(mockOnResolveBug).toHaveBeenCalledWith('bug-99')
    })
  })

  // ─── accessibility ──────────────────────────────────────────────

  describe('accessibility', () => {
    it('renders with role="region" and aria-label="Bug Radar"', () => {
      render(
        <BugRadar
          bugs={[]}
          repos={defaultRepos}
          onNavigateToAgent={mockOnNavigateToAgent}
          onResolveBug={mockOnResolveBug}
        />
      )

      const region = screen.getByRole('region', { name: 'Bug Radar' })
      expect(region).toBeInTheDocument()
    })
  })
})
