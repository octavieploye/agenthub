import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import { vi, describe, test, expect, beforeEach } from 'vitest'
import HowToPanel from './HowToPanel'

const mockDocs = [
  { title: 'Kanban Board', order: 1, content: '# Kanban Board\nUse the board to track tasks.' },
  { title: 'Sprint Automation', order: 2, content: '# Sprint Automation\nSprint flow documentation.' },
]

function setupMock(data = mockDocs): void {
  ;(window as unknown as Record<string, unknown>).agentHub = {
    system: {
      listHowTo: vi.fn().mockResolvedValue({ success: true, data })
    }
  }
}

describe('HowToPanel', () => {
  beforeEach(() => {
    setupMock()
  })

  test('renders nothing when closed', () => {
    const { container } = render(<HowToPanel isOpen={false} onClose={() => {}} />)
    expect(container.firstChild).toBeNull()
  })

  test('shows loading state while fetching', async () => {
    let resolve: (val: unknown) => void = () => {}
    ;(window as any).agentHub.system.listHowTo = vi.fn().mockReturnValue(
      new Promise((r) => { resolve = r })
    )
    render(<HowToPanel isOpen={true} onClose={() => {}} />)
    expect(screen.getByText('Loading…')).toBeInTheDocument()
    await act(async () => { resolve({ success: true, data: [] }) })
  })

  test('renders accordion sections after load', async () => {
    render(<HowToPanel isOpen={true} onClose={() => {}} />)
    await waitFor(() => {
      expect(screen.getByText('Kanban Board')).toBeInTheDocument()
      expect(screen.getByText('Sprint Automation')).toBeInTheDocument()
    })
  })

  test('first section is open by default with no search', async () => {
    render(<HowToPanel isOpen={true} onClose={() => {}} />)
    await waitFor(() => screen.getByText('Kanban Board'))
    // content of first section visible
    expect(screen.getByText(/Use the board to track tasks/)).toBeInTheDocument()
  })

  test('clicking a closed section opens it', async () => {
    render(<HowToPanel isOpen={true} onClose={() => {}} />)
    await waitFor(() => screen.getByText('Sprint Automation'))
    // Sprint section is closed by default
    expect(screen.queryByText(/Sprint flow documentation/)).not.toBeInTheDocument()
    fireEvent.click(screen.getByText('Sprint Automation'))
    expect(screen.getByText(/Sprint flow documentation/)).toBeInTheDocument()
  })

  test('search filters: unmatched sections get opacity-40 class', async () => {
    render(<HowToPanel isOpen={true} onClose={() => {}} />)
    await waitFor(() => screen.getByText('Kanban Board'))

    fireEvent.change(screen.getByPlaceholderText('Search guides…'), {
      target: { value: 'sprint' }
    })

    // The wrapper div of Kanban (unmatched) should have opacity-40
    const kanbanButton = screen.getByText('Kanban Board')
    const kanbanWrapper = kanbanButton.closest('[data-section]')
    expect(kanbanWrapper).toHaveClass('opacity-40')
  })

  test('search auto-expands sections whose body matches', async () => {
    render(<HowToPanel isOpen={true} onClose={() => {}} />)
    await waitFor(() => screen.getByText('Sprint Automation'))

    fireEvent.change(screen.getByPlaceholderText('Search guides…'), {
      target: { value: 'sprint flow' }
    })

    // Sprint body content is visible (section auto-expanded)
    expect(screen.getByText(/Sprint flow documentation/)).toBeInTheDocument()
  })

  test('Escape key triggers onClose', async () => {
    const onClose = vi.fn()
    render(<HowToPanel isOpen={true} onClose={onClose} />)
    await waitFor(() => screen.getByText('Kanban Board'))
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(onClose).toHaveBeenCalledOnce()
  })

  test('close button triggers onClose', async () => {
    const onClose = vi.fn()
    render(<HowToPanel isOpen={true} onClose={onClose} />)
    await waitFor(() => screen.getByText('Kanban Board'))
    fireEvent.click(screen.getByLabelText('Close guide'))
    expect(onClose).toHaveBeenCalledOnce()
  })

  test('clicking overlay triggers onClose', async () => {
    const onClose = vi.fn()
    render(<HowToPanel isOpen={true} onClose={onClose} />)
    await waitFor(() => screen.getByText('Kanban Board'))
    fireEvent.click(screen.getByTestId('how-to-overlay'))
    expect(onClose).toHaveBeenCalledOnce()
  })
})
