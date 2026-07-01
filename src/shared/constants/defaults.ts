export const APP_DEFAULTS = {
  THEME: 'mocha',
  WINDOW_WIDTH: 1400,
  WINDOW_HEIGHT: 900,
  MIN_WIDTH: 860,   // fits 10" screens at 2× retina scaling (~1024 logical px)
  MIN_HEIGHT: 600,
  SNAPSHOT_INTERVAL_MS: 60000,
  MAX_TERMINAL_BUFFER_LINES: 5000
} as const

export const AGENT_COLOR_PALETTE = [
  '#3B82F6',  // Blue
  '#EF4444',  // Red
  '#10B981',  // Green
  '#F59E0B',  // Amber
  '#8B5CF6',  // Violet
  '#EC4899',  // Pink
  '#06B6D4',  // Cyan
  '#F97316',  // Orange
  '#6366F1',  // Indigo
  '#14B8A6',  // Teal
] as const
