import { create } from 'zustand'

const THEMES = ['mocha', 'neon-noir', 'solarized-dusk', 'rose-pine', 'latte'] as const
type Theme = (typeof THEMES)[number]

interface ThemeStore {
  theme: Theme
  themes: readonly Theme[]
  setTheme: (theme: Theme) => void
}

function getStoredTheme(): Theme {
  try {
    const stored = localStorage.getItem('agenthub-theme')
    if (stored && THEMES.includes(stored as Theme)) return stored as Theme
  } catch {
    // ignore — localStorage may be unavailable
  }
  return 'mocha'
}

export const useThemeStore = create<ThemeStore>((set) => ({
  theme: getStoredTheme(),
  themes: THEMES,
  setTheme: (theme) => {
    localStorage.setItem('agenthub-theme', theme)
    document.documentElement.setAttribute('data-theme', theme)
    set({ theme })
  }
}))

export type { Theme }
export { THEMES }
