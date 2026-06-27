// src/renderer/src/widgets/settings-panel/tabs/TelegramTab.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import TelegramTab from './TelegramTab'

// Mock window.agentHub.telegram (the bridge used by the component)
const mockTelegram = {
  getStatus: vi.fn(),
  saveToken: vi.fn(),
  disconnect: vi.fn(),
  getPrefs: vi.fn(),
  setPref: vi.fn(),
  sendTest: vi.fn(),
  onFirstContactLinked: vi.fn(() => vi.fn()),
  onBlockedSender: vi.fn(() => vi.fn()),
}

Object.defineProperty(window, 'agentHub', {
  value: { telegram: mockTelegram },
  writable: true,
})

describe('TelegramTab', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockTelegram.getStatus.mockResolvedValue({ connected: false })
    mockTelegram.onFirstContactLinked.mockReturnValue(vi.fn())
  })

  it('shows "Set up Telegram alerts" button when not connected', async () => {
    render(<TelegramTab />)
    await waitFor(() => {
      expect(screen.getByText('Set up Telegram alerts')).toBeTruthy()
    })
  })

  it('does not show the word "bot" on the not-connected screen', async () => {
    render(<TelegramTab />)
    await waitFor(() => {
      const content = document.body.textContent ?? ''
      expect(content.toLowerCase()).not.toContain('bot')
    })
  })

  it('shows trust anchor text', async () => {
    render(<TelegramTab />)
    await waitFor(() => {
      expect(screen.getByText(/Your work stays on your machine/)).toBeTruthy()
    })
  })

  it('shows wizard step 1 after clicking setup button', async () => {
    const { fireEvent } = await import('@testing-library/react')
    render(<TelegramTab />)
    await waitFor(() => screen.getByText('Set up Telegram alerts'))
    fireEvent.click(screen.getByText('Set up Telegram alerts'))
    expect(screen.getByText(/Create your private bot/)).toBeTruthy()
    expect(screen.getByText(/Step 1 of 3/)).toBeTruthy()
  })

  it('shows connected state when status returns connected', async () => {
    mockTelegram.getStatus.mockResolvedValue({
      connected: true,
      maskedUserId: '···7842',
      prefs: {
        notify_completed: true, notify_failed: true,
        notify_awaiting_approval: true, notify_needs_input: true
      }
    })
    render(<TelegramTab />)
    await waitFor(() => {
      expect(screen.getByText(/Telegram alerts active/)).toBeTruthy()
    })
  })
})
