import { useThemeStore } from '../../stores/theme-store'
import type { Theme } from '../../stores/theme-store'

const THEME_LABELS: Record<Theme, string> = {
  'deep-space': 'Deep Space',
  ember: 'Ember',
  matrix: 'Matrix',
  arctic: 'Arctic',
  twilight: 'Twilight',
  jade: 'Jade',
  carbon: 'Carbon'
}

function ThemeSwitcher(): React.JSX.Element {
  const { theme, themes, setTheme } = useThemeStore()

  return (
    <select
      value={theme}
      onChange={(e) => setTheme(e.target.value as Theme)}
      className="select select-xs bg-base-200/50 border-base-content/10 rounded-full text-xs min-w-0"
      aria-label="Select theme"
      data-testid="theme-switcher"
    >
      {themes.map((t) => (
        <option key={t} value={t}>
          {THEME_LABELS[t]}
        </option>
      ))}
    </select>
  )
}

export default ThemeSwitcher
