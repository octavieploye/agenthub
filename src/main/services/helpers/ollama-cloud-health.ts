import { retryWithBackoff } from './retry'

export interface OllamaHealthResult {
  available: boolean
  attempts: number
  lastError: string | null
  diagnostics: string | null
}

export async function checkOllamaHealth(
  baseUrl: string,
  options?: { runInferenceProbe?: boolean }
): Promise<OllamaHealthResult> {
  // Fast path: GET /api/tags with 5s timeout
  try {
    const tagsResponse = await fetch(`${baseUrl}/api/tags`, {
      method: 'GET',
      signal: AbortSignal.timeout(5_000)
    })

    if (tagsResponse.ok) {
      return { available: true, attempts: 1, lastError: null, diagnostics: null }
    }
  } catch (err) {
    // Fast path failed — fall through to inference probe if enabled
    if (!options?.runInferenceProbe) {
      const errorMessage = err instanceof Error ? err.message : String(err)
      return {
        available: false,
        attempts: 1,
        lastError: errorMessage,
        diagnostics: `GET ${baseUrl}/api/tags failed: ${errorMessage}`
      }
    }
  }

  // Inference probe (only when runInferenceProbe is true)
  if (!options?.runInferenceProbe) {
    return {
      available: false,
      attempts: 1,
      lastError: 'tags endpoint returned non-200',
      diagnostics: `GET ${baseUrl}/api/tags returned non-200 status`
    }
  }

  try {
    const probeResponse = await fetch(`${baseUrl}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'any',
        prompt: 'test',
        stream: false,
        options: { num_predict: 1 }
      }),
      signal: AbortSignal.timeout(10_000)
    })

    if (probeResponse.ok) {
      return { available: true, attempts: 2, lastError: null, diagnostics: null }
    }

    return {
      available: false,
      attempts: 2,
      lastError: `inference probe returned ${probeResponse.status}`,
      diagnostics: `POST ${baseUrl}/api/generate returned ${probeResponse.status} ${probeResponse.statusText}`
    }
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err)
    return {
      available: false,
      attempts: 2,
      lastError: errorMessage,
      diagnostics: `POST ${baseUrl}/api/generate failed: ${errorMessage}`
    }
  }
}

export async function checkOllamaHealthWithRetry(
  baseUrl: string
): Promise<OllamaHealthResult> {
  let firstFailure = true

  const result = await retryWithBackoff(
    async () => {
      const runProbe = firstFailure
      firstFailure = false

      const health = await checkOllamaHealth(baseUrl, {
        runInferenceProbe: runProbe
      })

      if (!health.available) {
        throw new Error(health.lastError ?? 'Ollama health check failed')
      }

      return health
    }
  )

  if (result.success && result.data) {
    return {
      ...result.data,
      attempts: result.attempts
    }
  }

  return {
    available: false,
    attempts: result.attempts,
    lastError: result.lastError?.message ?? null,
    diagnostics: result.lastError
      ? `All ${result.attempts} attempts failed. Last error: ${result.lastError.message}`
      : null
  }
}
