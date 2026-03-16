import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import SettingsPanel from './SettingsPanel'

// Mock theme store
const mockSetTheme = vi.fn()
vi.mock('../../stores/theme-store', () => ({
  useThemeStore: vi.fn((selector) =>
    selector({ theme: 'deep-space', setTheme: mockSetTheme })
  )
}))

describe('SettingsPanel', () => {
  const onClose = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    window.agentHub = {
      settings: {
        getAll: vi.fn().mockResolvedValue({ success: true, data: {} }),
        set: vi.fn().mockResolvedValue({ success: true, data: undefined }),
        export: vi.fn().mockResolvedValue({
          success: true,
          data: { version: '1.0.0', exportedAt: '2026-03-07', settings: { theme: 'deep-space' } }
        }),
        import: vi.fn().mockResolvedValue({ success: true, data: undefined })
      },
      voice: {
        status: vi.fn().mockResolvedValue({ success: true, data: { status: 'ready' } })
      },
      docker: {
        status: vi.fn().mockResolvedValue({ success: true, data: { available: false, imageReady: false, imageTag: 'agenthub-cli:latest', activeContainerCount: 0 } }),
        rebuild: vi.fn().mockResolvedValue({ success: true, data: undefined }),
        onBuildProgress: vi.fn().mockReturnValue(vi.fn())
      }
    } as any
    // Mock URL methods
    global.URL.createObjectURL = vi.fn(() => 'blob:url')
    global.URL.revokeObjectURL = vi.fn()
  })

  it('renders the settings panel', () => {
    render(<SettingsPanel onClose={onClose} />)
    expect(screen.getByTestId('settings-panel')).toBeInTheDocument()
    expect(screen.getByText('Settings')).toBeInTheDocument()
  })

  it('closes on X button click', () => {
    render(<SettingsPanel onClose={onClose} />)
    fireEvent.click(screen.getByTestId('settings-close'))
    expect(onClose).toHaveBeenCalled()
  })

  it('renders all 7 theme buttons', () => {
    render(<SettingsPanel onClose={onClose} />)
    const themes = ['deep-space', 'ember', 'matrix', 'arctic', 'twilight', 'jade', 'carbon']
    for (const t of themes) {
      expect(screen.getByTestId(`theme-${t}`)).toBeInTheDocument()
    }
  })

  it('calls setTheme when theme button clicked', () => {
    render(<SettingsPanel onClose={onClose} />)
    fireEvent.click(screen.getByTestId('theme-ember'))
    expect(mockSetTheme).toHaveBeenCalledWith('ember')
  })

  it('renders export button', () => {
    render(<SettingsPanel onClose={onClose} />)
    expect(screen.getByTestId('settings-export')).toBeInTheDocument()
  })

  it('renders import button', () => {
    render(<SettingsPanel onClose={onClose} />)
    expect(screen.getByTestId('settings-import')).toBeInTheDocument()
  })

  it('calls settings.export on export click', async () => {
    render(<SettingsPanel onClose={onClose} />)
    fireEvent.click(screen.getByTestId('settings-export'))
    await waitFor(() => {
      expect(window.agentHub.settings.export).toHaveBeenCalled()
    })
  })

  it('shows success feedback after export', async () => {
    render(<SettingsPanel onClose={onClose} />)
    fireEvent.click(screen.getByTestId('settings-export'))
    await waitFor(() => {
      expect(screen.getByText('Exported!')).toBeInTheDocument()
    })
  })

  it('displays CLAUDE.md path', () => {
    render(<SettingsPanel onClose={onClose} />)
    expect(screen.getByText('~/.claude/CLAUDE.md')).toBeInTheDocument()
  })
})
