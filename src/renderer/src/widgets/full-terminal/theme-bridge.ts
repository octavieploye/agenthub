import type { ITheme } from '@xterm/xterm'

/**
 * Converts any CSS color value (including oklch) to a hex string (#RRGGBB).
 * Uses a temporary DOM element to let the browser resolve the color.
 */
export function cssColorToHex(cssValue: string): string {
  const el = document.createElement('div')
  el.style.color = cssValue
  document.body.appendChild(el)
  const computed = getComputedStyle(el).color
  document.body.removeChild(el)
  return rgbStringToHex(computed)
}

/**
 * Converts an rgb()/rgba() string from getComputedStyle into #RRGGBB or #RRGGBBAA.
 */
function rgbStringToHex(rgb: string): string {
  const match = rgb.match(/rgba?\(\s*([\d.]+),?\s*([\d.]+),?\s*([\d.]+)(?:[,/]\s*([\d.]+))?\s*\)/)
  if (!match) return '#000000'
  const r = Math.round(Number(match[1]))
  const g = Math.round(Number(match[2]))
  const b = Math.round(Number(match[3]))
  const hex = `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`
  if (match[4] !== undefined) {
    const a = Math.round(Number(match[4]) * 255)
    return `${hex}${a.toString(16).padStart(2, '0')}`
  }
  return hex
}

/**
 * Reads a CSS custom property from the document root and converts it to hex.
 */
function getCssVar(prop: string): string {
  const raw = getComputedStyle(document.documentElement).getPropertyValue(prop).trim()
  if (!raw) return '#000000'
  return cssColorToHex(raw)
}

/**
 * Lightens a hex color by blending it toward white.
 * @param hex - color in #RRGGBB format
 * @param amount - 0..1 blend factor toward white
 */
function lighten(hex: string, amount: number): string {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  const lr = Math.min(255, Math.round(r + (255 - r) * amount))
  const lg = Math.min(255, Math.round(g + (255 - g) * amount))
  const lb = Math.min(255, Math.round(b + (255 - b) * amount))
  return `#${lr.toString(16).padStart(2, '0')}${lg.toString(16).padStart(2, '0')}${lb.toString(16).padStart(2, '0')}`
}

/**
 * Builds an xterm ITheme by reading CSS custom properties from the active DaisyUI theme.
 */
export function getXtermTheme(): ITheme {
  const background = getCssVar('--color-base-100')
  const foreground = getCssVar('--color-base-content')
  const primary = getCssVar('--color-primary')
  const base300 = getCssVar('--color-base-300')
  const error = getCssVar('--color-error')
  const success = getCssVar('--color-success')
  const warning = getCssVar('--color-warning')
  const info = getCssVar('--color-info')
  const accent = getCssVar('--color-accent')
  const secondary = getCssVar('--color-secondary')

  // Selection uses primary with ~27% alpha
  const selectionBackground = primary.slice(0, 7) + '44'

  return {
    background,
    foreground,
    cursor: primary,
    cursorAccent: background,
    selectionBackground,
    black: base300,
    red: error,
    green: success,
    yellow: warning,
    blue: info,
    magenta: accent,
    cyan: secondary,
    white: foreground,
    brightBlack: lighten(base300, 0.25),
    brightRed: lighten(error, 0.2),
    brightGreen: lighten(success, 0.2),
    brightYellow: lighten(warning, 0.2),
    brightBlue: lighten(info, 0.2),
    brightMagenta: lighten(accent, 0.2),
    brightCyan: lighten(secondary, 0.2),
    brightWhite: '#ffffff'
  }
}
