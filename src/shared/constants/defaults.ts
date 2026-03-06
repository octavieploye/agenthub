export const APP_DEFAULTS = {
  THEME: 'deep-space',
  WINDOW_WIDTH: 1400,
  WINDOW_HEIGHT: 900,
  MIN_WIDTH: 720,
  MIN_HEIGHT: 500,
  SNAPSHOT_INTERVAL_MS: 60000,
  MAX_TERMINAL_BUFFER_LINES: 5000
} as const

export const AGENT_COLOR_PALETTE = [
  '#3B82F6', // blue
  '#10B981', // emerald
  '#F59E0B', // amber
  '#EF4444', // red
  '#8B5CF6', // violet
  '#EC4899', // pink
  '#06B6D4', // cyan
  '#F97316', // orange
  '#14B8A6', // teal
  '#6366F1'  // indigo
] as const
