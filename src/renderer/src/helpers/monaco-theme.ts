import type { editor } from 'monaco-editor'
import { cssColorToHex } from '../widgets/full-terminal/theme-bridge'

/**
 * Reads a CSS custom property from :root and converts it to hex.
 */
function getCssVar(prop: string): string {
  const raw = getComputedStyle(document.documentElement).getPropertyValue(prop).trim()
  if (!raw) return '#000000'
  return cssColorToHex(raw)
}

/**
 * Builds a Monaco IStandaloneThemeData from the active DaisyUI theme CSS variables.
 * Follows the same pattern as theme-bridge.ts (getXtermTheme).
 */
export function buildMonacoTheme(): editor.IStandaloneThemeData {
  const base200 = getCssVar('--color-base-200')
  const base300 = getCssVar('--color-base-300')
  const baseContent = getCssVar('--color-base-content')
  const primary = getCssVar('--color-primary')
  const secondary = getCssVar('--color-secondary')
  const accent = getCssVar('--color-accent')
  const neutral = getCssVar('--color-neutral')
  const success = getCssVar('--color-success')
  const warning = getCssVar('--color-warning')
  const error = getCssVar('--color-error')
  const info = getCssVar('--color-info')

  const isLight = getComputedStyle(document.documentElement)
    .getPropertyValue('color-scheme').trim() === 'light'

  return {
    base: isLight ? 'vs' : 'vs-dark',
    inherit: true,
    rules: [
      { token: 'comment', foreground: stripHash(neutral), fontStyle: 'italic' },
      { token: 'keyword', foreground: stripHash(primary) },
      { token: 'keyword.control', foreground: stripHash(primary) },
      { token: 'string', foreground: stripHash(success) },
      { token: 'string.escape', foreground: stripHash(accent) },
      { token: 'number', foreground: stripHash(warning) },
      { token: 'type', foreground: stripHash(info) },
      { token: 'type.identifier', foreground: stripHash(info) },
      { token: 'function', foreground: stripHash(accent) },
      { token: 'variable', foreground: stripHash(baseContent) },
      { token: 'operator', foreground: stripHash(secondary) },
      { token: 'delimiter', foreground: stripHash(baseContent) },
      { token: 'tag', foreground: stripHash(error) },
      { token: 'attribute.name', foreground: stripHash(warning) },
      { token: 'attribute.value', foreground: stripHash(success) },
      { token: 'metatag', foreground: stripHash(primary) },
      { token: 'annotation', foreground: stripHash(secondary) },
      { token: 'constant', foreground: stripHash(warning) },
      { token: 'regexp', foreground: stripHash(error) },
    ],
    colors: {
      'editor.background': base300,
      'editor.foreground': baseContent,
      'editor.lineHighlightBackground': base200 + '40',
      'editorLineNumber.foreground': neutral,
      'editorLineNumber.activeForeground': baseContent,
      'editor.selectionBackground': primary + '44',
      'editor.inactiveSelectionBackground': primary + '22',
      'editorCursor.foreground': primary,
      'editorIndentGuide.background': neutral + '30',
      'editorIndentGuide.activeBackground': neutral + '60',
      'editorBracketMatch.background': primary + '30',
      'editorBracketMatch.border': primary + '60',
      'editor.findMatchBackground': warning + '44',
      'editor.findMatchHighlightBackground': warning + '22',
      'editorWidget.background': base200,
      'editorWidget.border': neutral,
      'editorGutter.background': base300,
      'scrollbar.shadow': '#00000000',
      'scrollbarSlider.background': neutral + '40',
      'scrollbarSlider.hoverBackground': neutral + '60',
      'scrollbarSlider.activeBackground': neutral + '80',
    }
  }
}

function stripHash(hex: string): string {
  return hex.startsWith('#') ? hex.slice(1) : hex
}
