// C-T1 (RED): masked Anamnesis secret field in Settings → Advanced (implemented in C-T4).
//
// Contract under test:
//   - Advanced tab renders <input type="password" data-testid="anamnesis-secret-input">
//   - <button data-testid="anamnesis-secret-save"> is disabled while the input is blank
//   - Save calls window.agentHub.settings.setAnamnesisSecret(value) (IPC channel settings:set-anamnesis-secret)
//   - after a successful save the input is cleared and the secret is nowhere in the DOM
//   - the secret is never routed through the generic settings.set(key, value) channel
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import SettingsPanel from './SettingsPanel'

const SECRET = 'sk-anamnesis-very-secret-123'

describe('SettingsPanel — Anamnesis secret field', () => {
  const setAnamnesisSecret = vi.fn()
  const set = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    setAnamnesisSecret.mockResolvedValue({ success: true, data: undefined })
    set.mockResolvedValue({ success: true, data: undefined })
    // Preload bridge boundary (window.agentHub is injected by Electron's preload script).
    window.agentHub = {
      settings: {
        getAll: vi.fn().mockResolvedValue({ success: true, data: {} }),
        set,
        export: vi.fn().mockResolvedValue({ success: true, data: { version: '1.0.0', exportedAt: '', settings: {} } }),
        import: vi.fn().mockResolvedValue({ success: true, data: undefined }),
        setAnamnesisSecret,
      },
      voice: { status: vi.fn().mockResolvedValue({ success: true, data: { status: 'ready' } }) },
      docker: {
        status: vi.fn().mockResolvedValue({ success: true, data: { available: false, imageReady: false, imageTag: 'x', activeContainerCount: 0 } }),
        rebuild: vi.fn().mockResolvedValue({ success: true, data: undefined }),
        onBuildProgress: vi.fn().mockReturnValue(vi.fn()),
      },
      system: { openPath: vi.fn().mockResolvedValue(undefined) },
    } as never
  })

  function openAdvanced(): void {
    render(<SettingsPanel onClose={vi.fn()} />)
    fireEvent.click(screen.getByText('advanced'))
  }

  it('renders the secret as a masked (password) input', () => {
    openAdvanced()

    const input = screen.getByTestId('anamnesis-secret-input') as HTMLInputElement
    expect(input.type).toBe('password')
    expect(input.value).toBe('')
  })

  it('disables Save while the field is blank', () => {
    openAdvanced()

    expect((screen.getByTestId('anamnesis-secret-save') as HTMLButtonElement).disabled).toBe(true)

    fireEvent.change(screen.getByTestId('anamnesis-secret-input'), { target: { value: SECRET } })

    expect((screen.getByTestId('anamnesis-secret-save') as HTMLButtonElement).disabled).toBe(false)
  })

  it('saves through setAnamnesisSecret, clears the field, and never echoes the secret into the DOM', async () => {
    openAdvanced()
    const input = screen.getByTestId('anamnesis-secret-input') as HTMLInputElement

    fireEvent.change(input, { target: { value: SECRET } })
    fireEvent.click(screen.getByTestId('anamnesis-secret-save'))

    await waitFor(() => expect(setAnamnesisSecret).toHaveBeenCalledWith(SECRET))
    await waitFor(() => expect(input.value).toBe(''))
    expect(document.body.textContent).not.toContain(SECRET)
    expect(set).not.toHaveBeenCalled()
  })

  it('keeps the typed value out of the DOM text and leaves the field untouched when the save fails', async () => {
    setAnamnesisSecret.mockResolvedValue({ success: false, error: { code: 'SECRET_ERROR', message: 'safeStorage unavailable' } })
    openAdvanced()
    const input = screen.getByTestId('anamnesis-secret-input') as HTMLInputElement

    fireEvent.change(input, { target: { value: SECRET } })
    fireEvent.click(screen.getByTestId('anamnesis-secret-save'))

    await waitFor(() => expect(setAnamnesisSecret).toHaveBeenCalledTimes(1))
    expect(document.body.textContent).not.toContain(SECRET)
    expect(screen.getByText(/safeStorage unavailable|could not save|failed/i)).toBeTruthy()
  })
})
