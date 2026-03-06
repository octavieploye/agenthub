import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import KillConfirmToast from './KillConfirmToast'

describe('KillConfirmToast', () => {
  const defaultProps = {
    agentName: 'test-agent',
    onConfirm: vi.fn(),
    onCancel: vi.fn()
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders the toast container', () => {
    render(<KillConfirmToast {...defaultProps} />)
    expect(screen.getByTestId('kill-confirm-toast')).toBeInTheDocument()
  })

  it('displays the agent name in confirmation message', () => {
    render(<KillConfirmToast {...defaultProps} agentName="my-agent" />)
    expect(screen.getByTestId('kill-confirm-toast')).toHaveTextContent('my-agent')
  })

  it('renders Confirm button', () => {
    render(<KillConfirmToast {...defaultProps} />)
    const btn = screen.getByTestId('kill-confirm-button')
    expect(btn).toBeInTheDocument()
    expect(btn).toHaveTextContent(/confirm/i)
  })

  it('renders Cancel button', () => {
    render(<KillConfirmToast {...defaultProps} />)
    const btn = screen.getByTestId('kill-cancel-button')
    expect(btn).toBeInTheDocument()
    expect(btn).toHaveTextContent(/cancel/i)
  })

  it('fires onConfirm when Confirm is clicked', () => {
    render(<KillConfirmToast {...defaultProps} />)
    fireEvent.click(screen.getByTestId('kill-confirm-button'))
    expect(defaultProps.onConfirm).toHaveBeenCalledOnce()
  })

  it('fires onCancel when Cancel is clicked', () => {
    render(<KillConfirmToast {...defaultProps} />)
    fireEvent.click(screen.getByTestId('kill-cancel-button'))
    expect(defaultProps.onCancel).toHaveBeenCalledOnce()
  })

  it('applies panel-glass styling', () => {
    render(<KillConfirmToast {...defaultProps} />)
    const toast = screen.getByTestId('kill-confirm-toast')
    expect(toast.className).toMatch(/panel-glass/)
  })

  it('applies destructive/red styling to Confirm button', () => {
    render(<KillConfirmToast {...defaultProps} />)
    const btn = screen.getByTestId('kill-confirm-button')
    expect(btn.className).toMatch(/btn-error|bg-error|text-error|bg-red/)
  })
})
