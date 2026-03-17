import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import RepoSelectDropdown from '../RepoSelectDropdown'

const mockRepos = [
  { id: 'r1', name: 'alpha-proj', path: '/dev/alpha', glowColor: '#89b4fa', createdAt: '2026-01-01', lastUsedAt: '2026-03-17T10:00:00Z' },
  { id: 'r2', name: 'beta-proj', path: '/dev/beta', glowColor: '#a6e3a1', createdAt: '2026-01-02' },
  { id: 'r3', name: 'gamma-proj', path: '/dev/gamma', glowColor: '#fab387', createdAt: '2026-01-03', lastUsedAt: '2026-03-16T08:00:00Z' },
]

describe('RepoSelectDropdown', () => {
  it('renders trigger with placeholder when no repo selected', () => {
    render(<RepoSelectDropdown repos={mockRepos} selectedRepoId="" onSelect={vi.fn()} onRemove={vi.fn()} onColorChange={vi.fn()} />)
    expect(screen.getByText('Select repository...')).toBeInTheDocument()
  })

  it('opens panel and shows search on click', () => {
    render(<RepoSelectDropdown repos={mockRepos} selectedRepoId="" onSelect={vi.fn()} onRemove={vi.fn()} onColorChange={vi.fn()} />)
    fireEvent.click(screen.getByText('Select repository...'))
    expect(screen.getByPlaceholderText('Search repositories...')).toBeInTheDocument()
  })

  it('shows Recent section for repos with lastUsedAt', () => {
    render(<RepoSelectDropdown repos={mockRepos} selectedRepoId="" onSelect={vi.fn()} onRemove={vi.fn()} onColorChange={vi.fn()} />)
    fireEvent.click(screen.getByText('Select repository...'))
    expect(screen.getByText('RECENT')).toBeInTheDocument()
  })

  it('filters repos by search text', () => {
    render(<RepoSelectDropdown repos={mockRepos} selectedRepoId="" onSelect={vi.fn()} onRemove={vi.fn()} onColorChange={vi.fn()} />)
    fireEvent.click(screen.getByText('Select repository...'))
    fireEvent.change(screen.getByPlaceholderText('Search repositories...'), { target: { value: 'beta' } })
    expect(screen.getByText('beta-proj')).toBeInTheDocument()
    expect(screen.queryByText('alpha-proj')).not.toBeInTheDocument()
  })

  it('calls onSelect when a repo is clicked', () => {
    const onSelect = vi.fn()
    render(<RepoSelectDropdown repos={mockRepos} selectedRepoId="" onSelect={onSelect} onRemove={vi.fn()} onColorChange={vi.fn()} />)
    fireEvent.click(screen.getByText('Select repository...'))
    fireEvent.click(screen.getByText('beta-proj'))
    expect(onSelect).toHaveBeenCalledWith('r2')
  })

  it('shows selected repo name in trigger', () => {
    render(<RepoSelectDropdown repos={mockRepos} selectedRepoId="r1" onSelect={vi.fn()} onRemove={vi.fn()} onColorChange={vi.fn()} />)
    expect(screen.getByText('alpha-proj')).toBeInTheDocument()
  })

  it('closes on Escape', () => {
    render(<RepoSelectDropdown repos={mockRepos} selectedRepoId="" onSelect={vi.fn()} onRemove={vi.fn()} onColorChange={vi.fn()} />)
    fireEvent.click(screen.getByText('Select repository...'))
    expect(screen.getByPlaceholderText('Search repositories...')).toBeInTheDocument()
    fireEvent.keyDown(screen.getByPlaceholderText('Search repositories...'), { key: 'Escape' })
    expect(screen.queryByPlaceholderText('Search repositories...')).not.toBeInTheDocument()
  })

  it('shows Custom path footer option', () => {
    render(<RepoSelectDropdown repos={mockRepos} selectedRepoId="" onSelect={vi.fn()} onRemove={vi.fn()} onColorChange={vi.fn()} />)
    fireEvent.click(screen.getByText('Select repository...'))
    expect(screen.getByText('Custom path...')).toBeInTheDocument()
  })
})
