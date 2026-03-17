/**
 * Map model IDs to short human-friendly display names for compact UI.
 */

const CLAUDE_SHORT: Record<string, string> = {
  'claude-opus-4-6': 'Opus 4.6',
  'claude-sonnet-4-6': 'Sonnet 4.6',
  'claude-haiku-4-5-20251001': 'Haiku 4.5',
  'claude-sonnet-4-5-20241022': 'Sonnet 4.5',
  'claude-3-5-sonnet-20241022': 'Sonnet 3.5',
  'claude-3-5-haiku-20241022': 'Haiku 3.5',
  'claude-3-opus-20240229': 'Opus 3',
}

export function getShortModelName(model: string): string {
  // Direct match
  if (CLAUDE_SHORT[model]) return CLAUDE_SHORT[model]

  // Claude pattern: claude-<family>-<version>-<date>
  if (model.startsWith('claude-')) {
    // Try without date suffix
    const noDate = model.replace(/-\d{8}$/, '')
    if (CLAUDE_SHORT[noDate]) return CLAUDE_SHORT[noDate]

    // Extract family name from claude-<family>-<rest>
    const parts = model.replace('claude-', '').split('-')
    if (parts.length >= 1) {
      const family = parts[0].charAt(0).toUpperCase() + parts[0].slice(1)
      const version = parts.slice(1).filter(p => !/^\d{8}$/.test(p)).join('.')
      return version ? `${family} ${version}` : family
    }
  }

  // Ollama-style: model:tag (e.g., llama3.3:70b, deepseek-r1:32b)
  if (model.includes(':')) {
    const [name, tag] = model.split(':')
    const cleanName = name
      .split('-')
      .map(w => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ')
    const cleanTag = tag.toUpperCase()
    return `${cleanName} ${cleanTag}`
  }

  return model
}
