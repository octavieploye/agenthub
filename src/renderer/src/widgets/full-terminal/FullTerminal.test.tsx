import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, act } from '@testing-library/react'
import { useThemeStore } from '@renderer/stores/theme-store'

/* ---------- Mock xterm ---------- */
const mockTerminalInstance = {
  open: vi.fn(),
  loadAddon: vi.fn(),
  write: vi.fn(),
  resize: vi.fn(),
  focus: vi.fn(),
  onData: vi.fn(() => ({ dispose: vi.fn() })),
  dispose: vi.fn(),
  options: {} as Record<string, unknown>
}

// Use a class so `new Terminal(...)` works
vi.mock('@xterm/xterm', () => {
  const MockTerminal = vi.fn(function (this: unknown, opts: Record<string, unknown>) {
    mockTerminalInstance.options = { ...opts }
    Object.assign(this as Record<string, unknown>, mockTerminalInstance)
    // Also keep a mutable reference on the singleton for theme updates
    return mockTerminalInstance
  })
  return { Terminal: MockTerminal }
})

vi.mock('@xterm/addon-webgl', () => {
  const MockWebglAddon = vi.fn(function () {
    return { dispose: vi.fn(), onContextLoss: vi.fn() }
  })
  return { WebglAddon: MockWebglAddon }
})

/* ---------- Mock ResizeObserver (not in jsdom) ---------- */
class MockResizeObserver {
  observe = vi.fn()
  unobserve = vi.fn()
  disconnect = vi.fn()
}
global.ResizeObserver = MockResizeObserver as unknown as typeof ResizeObserver

/* ---------- Mock IPC ---------- */
const mockOn = {
  agentOutput: vi.fn(() => vi.fn())
}
const mockAgents = {
  sendInput: vi.fn(),
  resize: vi.fn()
}

Object.defineProperty(window, 'agentHub', {
  value: { on: mockOn, agents: mockAgents },
  writable: true
})

/* ---------- Mock getComputedStyle for CSS custom properties ---------- */
const CSS_VARS: Record<string, string> = {
  '--color-base-100': 'rgb(26, 26, 46)',
  '--color-base-200': 'rgb(20, 20, 36)',
  '--color-base-300': 'rgb(14, 14, 26)',
  '--color-base-content': 'rgb(224, 224, 224)',
  '--color-primary': 'rgb(100, 120, 238)',
  '--color-secondary': 'rgb(6, 182, 212)',
  '--color-accent': 'rgb(168, 85, 247)',
  '--color-error': 'rgb(239, 68, 68)',
  '--color-success': 'rgb(16, 185, 129)',
  '--color-warning': 'rgb(245, 158, 11)',
  '--color-info': 'rgb(59, 130, 246)'
}

const EMBER_VARS: Record<string, string> = {
  '--color-base-100': 'rgb(30, 16, 12)',
  '--color-base-200': 'rgb(24, 12, 8)',
  '--color-base-300': 'rgb(18, 8, 4)',
  '--color-base-content': 'rgb(224, 200, 190)',
  '--color-primary': 'rgb(220, 80, 40)',
  '--color-secondary': 'rgb(200, 140, 60)',
  '--color-accent': 'rgb(240, 180, 60)',
  '--color-error': 'rgb(239, 68, 68)',
  '--color-success': 'rgb(16, 185, 129)',
  '--color-warning': 'rgb(245, 158, 11)',
  '--color-info': 'rgb(59, 130, 246)'
}

let activeCssVars = CSS_VARS
const originalGetComputedStyle = window.getComputedStyle

function setupComputedStyleMock(): void {
  vi.spyOn(window, 'getComputedStyle').mockImplementation((el: Element) => {
    const real = originalGetComputedStyle(el)
    return new Proxy(real, {
      get(target, prop) {
        if (prop === 'getPropertyValue') {
          return (name: string): string => {
            if (name in activeCssVars) return activeCssVars[name]
            return target.getPropertyValue(name)
          }
        }
        if (prop === 'color') {
          const color = (el as HTMLElement).style?.color
          if (color && color.startsWith('rgb')) return color
          return color || target.color
        }
        const value = Reflect.get(target, prop)
        return typeof value === 'function' ? value.bind(target) : value
      }
    })
  })
}

describe('FullTerminal', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    activeCssVars = CSS_VARS
    setupComputedStyleMock()
    // Reset theme store to default
    useThemeStore.setState({ theme: 'deep-space' })
    document.documentElement.setAttribute('data-theme', 'deep-space')
    // Reset terminal instance options
    mockTerminalInstance.options = {}
  })

  it('creates Terminal with theme derived from CSS custom properties', async () => {
    const { Terminal } = await import('@xterm/xterm')
    // Dynamic import of component so mocks are in place
    const { default: FullTerminal } = await import('./FullTerminal')

    render(<FullTerminal agentId="agent-1" visible={true} />)

    expect(Terminal).toHaveBeenCalledTimes(1)

    const constructorCall = vi.mocked(Terminal).mock.calls[0][0]
    const theme = constructorCall?.theme as Record<string, string>

    // The theme should have been derived from CSS vars, not hardcoded
    expect(theme).toBeDefined()
    expect(theme.background).toBeDefined()
    expect(theme.foreground).toBeDefined()
    expect(theme.cursor).toBeDefined()
    expect(theme.cursorAccent).toBeDefined()
    expect(theme.selectionBackground).toBeDefined()
    expect(theme.black).toBeDefined()
    expect(theme.red).toBeDefined()
    expect(theme.green).toBeDefined()
    expect(theme.yellow).toBeDefined()
    expect(theme.blue).toBeDefined()
    expect(theme.magenta).toBeDefined()
    expect(theme.cyan).toBeDefined()
    expect(theme.white).toBeDefined()
    expect(theme.brightBlack).toBeDefined()
    expect(theme.brightWhite).toBe('#ffffff')

    // allowTransparency should still be true
    expect(constructorCall?.allowTransparency).toBe(true)
  })

  it('updates terminal theme when theme store changes', async () => {
    const { default: FullTerminal } = await import('./FullTerminal')

    render(<FullTerminal agentId="agent-1" visible={true} />)

    // Capture theme after initial render
    const initialTheme = { ...mockTerminalInstance.options.theme as Record<string, string> }
    expect(initialTheme).toBeDefined()

    // Switch to ember theme
    activeCssVars = EMBER_VARS
    act(() => {
      useThemeStore.getState().setTheme('ember')
    })

    // The terminal options.theme should have been reassigned
    const updatedTheme = mockTerminalInstance.options.theme as Record<string, string>
    expect(updatedTheme).toBeDefined()
    // The background should differ since ember has a different base-100
    expect(updatedTheme.background).not.toBe(initialTheme.background)
  })
})
