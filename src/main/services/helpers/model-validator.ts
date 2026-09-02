import { OLLAMA_CLOUD_MODELS, CODEX_MODELS } from '../../../shared/constants/model-catalog'

const ANTHROPIC_MODELS = ['claude-sonnet-4-6', 'claude-opus-4-6', 'claude-haiku-4-5'] as const

/**
 * Validates that a model override is a known model for the given provider.
 * Returns null if valid, or an error message string if invalid.
 */
export function validateModelOverride(
  model: string | null | undefined,
  provider: string | null | undefined
): string | null {
  if (!model) return null
  if (!provider) return null

  if (provider === 'anthropic') {
    if (!ANTHROPIC_MODELS.includes(model as typeof ANTHROPIC_MODELS[number])) {
      return `Unknown Anthropic model: "${model}". Valid: ${ANTHROPIC_MODELS.join(', ')}`
    }
    return null
  }

  if (provider === 'ollama-cloud') {
    const known = OLLAMA_CLOUD_MODELS.some(m => m.id === model)
    if (!known) {
      return `Unknown Ollama Cloud model: "${model}". Valid: ${OLLAMA_CLOUD_MODELS.map(m => m.id).join(', ')}`
    }
    return null
  }

  if (provider === 'openai-codex') {
    const known = CODEX_MODELS.some(m => m.id === model)
    if (!known) {
      return `Unknown Codex model: "${model}". Valid: ${CODEX_MODELS.map(m => m.id).join(', ')}`
    }
    return null
  }

  // ollama-local — we cannot validate at save time (depends on what's pulled locally).
  // Validation happens at dispatch time via /api/tags check.
  return null
}
