import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import RepoListItem from '../RepoListItem'

const mockRepo = {
  id: 'repo-1',
  name: 'my-project',
  path: '/Users/dev/my-project',
  glowColor: '#89b4fa',
  createdAt: '2026-01-01T00:00:00Z'
}

describe('RepoListItem', () => {
  it('renders repo name and path', () => {
    render(<RepoListItem repo={mockRepo} isSelected={false} isHighlighted={false} onSelect={vi.fn()} onRemove={vi.fn()} onRequestColorPicker={vi.fn()} />)
    expect(screen.getByText('my-project')).toBeInTheDocument()
    expect(screen.getByText('/Users/dev/my-project')).toBeInTheDocument()
  })

  it('calls onSelect when clicked', () => {
    const onSelect = vi.fn()
    render(<RepoListItem repo={mockRepo} isSelected={false} isHighlighted={false} onSelect={onSelect} onRemove={vi.fn()} onRequestColorPicker={vi.fn()} />)
    fireEvent.click(screen.getByText('my-project'))
    expect(onSelect).toHaveBeenCalledWith('repo-1')
  })

  it('shows remove button on hover', () => {
    render(<RepoListItem repo={mockRepo} isSelected={false} isHighlighted={false} onSelect={vi.fn()} onRemove={vi.fn()} onRequestColorPicker={vi.fn()} />)
    const item = screen.getByText('my-project').closest('[role="option"]')!
    fireEvent.mouseEnter(item)
    expect(screen.getByLabelText('Remove repository')).toBeInTheDocument()
  })

  it('shows checkmark when selected', () => {
    render(<RepoListItem repo={mockRepo} isSelected={true} isHighlighted={false} onSelect={vi.fn()} onRemove={vi.fn()} onRequestColorPicker={vi.fn()} />)
    expect(screen.getByTestId('selected-check')).toBeInTheDocument()
  })
})
