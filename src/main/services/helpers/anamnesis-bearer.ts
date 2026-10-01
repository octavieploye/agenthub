import log from 'electron-log/main'

/** `URL.hostname` forms of the loopback hosts a plain-http Anamnesis URL may use. */
const LOOPBACK_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]'])

/** URLs already warned about, so a misconfigured ANAMNESIS_URL logs once, not once per request. */
const warnedUrls = new Set<string>()

/** True when the bearer may travel to this URL: https anywhere, http only to loopback. */
function isBearerSafeUrl(baseUrl: string): boolean {
  let parsed: URL
  try {
    parsed = new URL(baseUrl)
  } catch {
    return false
  }
  if (parsed.protocol === 'https:') return true
  return parsed.protocol === 'http:' && LOOPBACK_HOSTS.has(parsed.hostname)
}

/** Origin only (no userinfo, path or query) so a URL with embedded credentials is never logged. */
function originForLog(baseUrl: string): string {
  try {
    return new URL(baseUrl).origin
  } catch {
    return 'unparseable URL'
  }
}

/** Log the refusal once per URL; never includes the secret. */
function warnBearerWithheldOnce(baseUrl: string): void {
  if (warnedUrls.has(baseUrl)) return
  warnedUrls.add(baseUrl)
  log.warn(
    'Anamnesis: bearer secret withheld — ANAMNESIS_URL must be https, or http on localhost/127.0.0.1/::1',
    { anamnesisUrl: originForLog(baseUrl) }
  )
}

/**
 * The `Authorization` header for Anamnesis requests, or `{}` when there is no secret or the
 * URL is neither https nor loopback http (S94/S89). Shared by the writer and the reader.
 */
export function resolveAnamnesisAuthHeaders(
  baseUrl: string,
  authSecret: string | undefined
): Record<string, string> {
  if (!authSecret) return {}
  if (!isBearerSafeUrl(baseUrl)) {
    warnBearerWithheldOnce(baseUrl)
    return {}
  }
  return { Authorization: `Bearer ${authSecret}` }
}
