import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import ClipLauncher from './ClipLauncher'

interface Clip {
  id: string
  title: string
  description: string
  prompt: string
  defaultRepoId: string | null
  launchCount: number
  lastUsedAt: string | null
  createdAt: string
}

function createMockClip(overrides: Partial<Clip> = {}): Clip {
  return {
    id: 'clip-1',
    title: 'Fix Auth Flow',
    description: 'Repairs the broken authentication module',
    prompt: 'Please fix the auth flow in src/auth.ts',
    defaultRepoId: null,
    launchCount: 3,
    lastUsedAt: '2026-03-05T14:30:00Z',
    createdAt: '2026-03-01T10:00:00Z',
    ...overrides
  }
}

describe('ClipLauncher', () => {
  const mockOnCreateClip = vi.fn()
  const mockOnLaunchClip = vi.fn()
  const mockOnDeleteClip = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('rendering', () => {
    it('renders panel-glass container with data-testid="clip-launcher"', () => {
      render(
        <ClipLauncher
          clips={[]}
          onCreateClip={mockOnCreateClip}
          onLaunchClip={mockOnLaunchClip}
          onDeleteClip={mockOnDeleteClip}
        />
      )
      const container = screen.getByTestId('clip-launcher')
      expect(container).toBeInTheDocument()
    })

    it('renders "Clips" header', () => {
      render(
        <ClipLauncher
          clips={[]}
          onCreateClip={mockOnCreateClip}
          onLaunchClip={mockOnLaunchClip}
          onDeleteClip={mockOnDeleteClip}
        />
      )
      expect(screen.getByText('Clips')).toBeInTheDocument()
    })

    it('renders "+ New Clip" button', () => {
      render(
        <ClipLauncher
          clips={[]}
          onCreateClip={mockOnCreateClip}
          onLaunchClip={mockOnLaunchClip}
          onDeleteClip={mockOnDeleteClip}
        />
      )
      expect(screen.getByText('+ New Clip')).toBeInTheDocument()
    })

    it('renders clip titles', () => {
      const clips = [
        createMockClip({ id: 'clip-1', title: 'Fix Auth Flow' }),
        createMockClip({ id: 'clip-2', title: 'Refactor DB Layer' })
      ]
      render(
        <ClipLauncher
          clips={clips}
          onCreateClip={mockOnCreateClip}
          onLaunchClip={mockOnLaunchClip}
          onDeleteClip={mockOnDeleteClip}
        />
      )
      expect(screen.getByText('Fix Auth Flow')).toBeInTheDocument()
      expect(screen.getByText('Refactor DB Layer')).toBeInTheDocument()
    })

    it('renders clip descriptions', () => {
      const clips = [
        createMockClip({ id: 'clip-1', description: 'Repairs authentication' }),
        createMockClip({ id: 'clip-2', description: 'Optimizes queries' })
      ]
      render(
        <ClipLauncher
          clips={clips}
          onCreateClip={mockOnCreateClip}
          onLaunchClip={mockOnLaunchClip}
          onDeleteClip={mockOnDeleteClip}
        />
      )
      expect(screen.getByText('Repairs authentication')).toBeInTheDocument()
      expect(screen.getByText('Optimizes queries')).toBeInTheDocument()
    })

    it('renders launch count for each clip', () => {
      const clips = [
        createMockClip({ id: 'clip-1', launchCount: 5 }),
        createMockClip({ id: 'clip-2', launchCount: 12 })
      ]
      render(
        <ClipLauncher
          clips={clips}
          onCreateClip={mockOnCreateClip}
          onLaunchClip={mockOnLaunchClip}
          onDeleteClip={mockOnDeleteClip}
        />
      )
      expect(screen.getByText(/5/)).toBeInTheDocument()
      expect(screen.getByText(/12/)).toBeInTheDocument()
    })

    it('renders last-used date when present', () => {
      const clips = [
        createMockClip({ id: 'clip-1', lastUsedAt: '2026-03-05T14:30:00Z' })
      ]
      render(
        <ClipLauncher
          clips={clips}
          onCreateClip={mockOnCreateClip}
          onLaunchClip={mockOnLaunchClip}
          onDeleteClip={mockOnDeleteClip}
        />
      )
      // Should render some formatted date text (not "Never used")
      const clipItem = screen.getByTestId('clip-item-clip-1')
      expect(clipItem.textContent).not.toContain('Never used')
    })

    it('renders "Never used" when lastUsedAt is null', () => {
      const clips = [
        createMockClip({ id: 'clip-1', lastUsedAt: null })
      ]
      render(
        <ClipLauncher
          clips={clips}
          onCreateClip={mockOnCreateClip}
          onLaunchClip={mockOnLaunchClip}
          onDeleteClip={mockOnDeleteClip}
        />
      )
      expect(screen.getByText('Never used')).toBeInTheDocument()
    })

    it('renders empty state message when clips array is empty', () => {
      render(
        <ClipLauncher
          clips={[]}
          onCreateClip={mockOnCreateClip}
          onLaunchClip={mockOnLaunchClip}
          onDeleteClip={mockOnDeleteClip}
        />
      )
      expect(screen.getByTestId('clip-launcher-empty')).toBeInTheDocument()
    })
  })

  describe('interactions', () => {
    it('shows create form and calls onCreateClip when submitted', () => {
      render(
        <ClipLauncher
          clips={[]}
          onCreateClip={mockOnCreateClip}
          onLaunchClip={mockOnLaunchClip}
          onDeleteClip={mockOnDeleteClip}
        />
      )
      fireEvent.click(screen.getByText('+ New Clip'))
      expect(screen.getByTestId('clip-form-title')).toBeInTheDocument()

      fireEvent.change(screen.getByTestId('clip-form-title'), { target: { value: 'My Clip' } })
      fireEvent.change(screen.getByTestId('clip-form-prompt'), {
        target: { value: 'Do the thing' }
      })
      fireEvent.click(screen.getByTestId('clip-form-submit'))
      expect(mockOnCreateClip).toHaveBeenCalledWith({
        title: 'My Clip',
        description: '',
        prompt: 'Do the thing'
      })
    })

    it('calls onLaunchClip with clip id when launch button clicked', () => {
      const clips = [
        createMockClip({ id: 'clip-42', title: 'Launch Me' })
      ]
      render(
        <ClipLauncher
          clips={clips}
          onCreateClip={mockOnCreateClip}
          onLaunchClip={mockOnLaunchClip}
          onDeleteClip={mockOnDeleteClip}
        />
      )
      fireEvent.click(screen.getByTestId('launch-clip-clip-42'))
      expect(mockOnLaunchClip).toHaveBeenCalledWith('clip-42')
    })

    it('calls onDeleteClip with clip id when delete button clicked', () => {
      const clips = [
        createMockClip({ id: 'clip-99', title: 'Delete Me' })
      ]
      render(
        <ClipLauncher
          clips={clips}
          onCreateClip={mockOnCreateClip}
          onLaunchClip={mockOnLaunchClip}
          onDeleteClip={mockOnDeleteClip}
        />
      )
      fireEvent.click(screen.getByTestId('delete-clip-clip-99'))
      expect(mockOnDeleteClip).toHaveBeenCalledWith('clip-99')
    })
  })

  describe('styling', () => {
    it('container has panel-glass class', () => {
      render(
        <ClipLauncher
          clips={[]}
          onCreateClip={mockOnCreateClip}
          onLaunchClip={mockOnLaunchClip}
          onDeleteClip={mockOnDeleteClip}
        />
      )
      const container = screen.getByTestId('clip-launcher')
      expect(container.className).toMatch(/panel-glass/)
    })

    it('clip items have rounded styling', () => {
      const clips = [createMockClip({ id: 'clip-1' })]
      render(
        <ClipLauncher
          clips={clips}
          onCreateClip={mockOnCreateClip}
          onLaunchClip={mockOnLaunchClip}
          onDeleteClip={mockOnDeleteClip}
        />
      )
      const clipItem = screen.getByTestId('clip-item-clip-1')
      expect(clipItem.className).toMatch(/rounded/)
    })

    it('"+ New Clip" button has btn-primary style', () => {
      render(
        <ClipLauncher
          clips={[]}
          onCreateClip={mockOnCreateClip}
          onLaunchClip={mockOnLaunchClip}
          onDeleteClip={mockOnDeleteClip}
        />
      )
      const button = screen.getByText('+ New Clip')
      expect(button.className).toMatch(/btn-primary/)
    })

    it('each clip shows its prompt text', () => {
      const clips = [
        createMockClip({ id: 'clip-1', prompt: 'Fix the login bug in auth.ts' })
      ]
      render(
        <ClipLauncher
          clips={clips}
          onCreateClip={mockOnCreateClip}
          onLaunchClip={mockOnLaunchClip}
          onDeleteClip={mockOnDeleteClip}
        />
      )
      expect(screen.getByText('Fix the login bug in auth.ts')).toBeInTheDocument()
    })
  })
})
