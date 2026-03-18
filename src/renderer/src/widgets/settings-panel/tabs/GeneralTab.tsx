import { useThemeStore } from '../../../stores/theme-store'
import type { Theme } from '../../../stores/theme-store'

const THEME_PERSONALITIES: Record<Theme, string> = {
  mocha: 'Warm & cozy',
  'neon-noir': 'Vivid & electric',
  'solarized-dusk': 'Earthy & familiar',
  'rose-pine': 'Romantic & warm',
  latte: 'Clean & light'
}

const THEME_COLORS: Record<Theme, { primary: string; secondary: string; accent: string; base: string }> = {
  mocha: { primary: '#89b4fa', secondary: '#cba6f7', accent: '#94e2d5', base: '#1e1e2e' },
  'neon-noir': { primary: '#00e5ff', secondary: '#ff2d8a', accent: '#39ff14', base: '#121218' },
  'solarized-dusk': { primary: '#268bd2', secondary: '#6c71c4', accent: '#b58900', base: '#002b36' },
  'rose-pine': { primary: '#c4a7e7', secondary: '#eb6f92', accent: '#f6c177', base: '#191724' },
  latte: { primary: '#1e66f5', secondary: '#8839ef', accent: '#179299', base: '#eff1f5' }
}

export function GeneralTab(): React.JSX.Element {
  const theme = useThemeStore((s) => s.theme)
  const setTheme = useThemeStore((s) => s.setTheme)
  const themes = useThemeStore((s) => s.themes)

  return (
    <div className="space-y-4">
      <div>
        <p className="text-xs font-medium text-base-content/70 mb-2">Theme</p>
        <div className="grid grid-cols-2 gap-2">
          {themes.map((t) => {
            const colors = THEME_COLORS[t]
            const isActive = theme === t
            return (
              <button
                key={t}
                data-testid={`theme-${t}`}
                onClick={() => setTheme(t)}
                className={`flex flex-col gap-1.5 p-2.5 rounded-lg text-left transition-all ${
                  isActive
                    ? 'ring-2 ring-primary shadow-[0_0_8px_var(--p)]'
                    : 'bg-base-200/50 hover:bg-base-200'
                }`}
              >
                <div className="flex gap-1">
                  {[colors.primary, colors.secondary, colors.accent, colors.base].map((color, i) => (
                    <span
                      key={i}
                      className="w-3 h-3 rounded-full border border-white/10"
                      style={{ backgroundColor: color }}
                    />
                  ))}
                </div>
                <p className="text-xs font-medium capitalize leading-tight">{t.replace(/-/g, ' ')}</p>
                <p className="text-[10px] text-base-content/40 leading-tight">{THEME_PERSONALITIES[t]}</p>
              </button>
            )
          })}
        </div>
      </div>

      <div className="space-y-2">
        <p className="text-xs text-base-content/50 uppercase tracking-wide">Typography</p>
        <div className="flex gap-4 text-sm">
          <div>
            <p className="font-mono font-semibold">AgentHub</p>
            <p className="text-[10px] text-base-content/40">JetBrains Mono 600</p>
          </div>
          <div>
            <p>Managing agents...</p>
            <p className="text-[10px] text-base-content/40">Geist Sans 400</p>
          </div>
        </div>
      </div>
    </div>
  )
}
