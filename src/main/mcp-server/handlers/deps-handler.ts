import { readFileSync, existsSync } from 'fs'
import type {
  AuditDepsToolInput,
  AuditDepsToolOutput,
  DependencyAuditEntry
} from '@shared/types/mcp-server.types'

const FETCH_TIMEOUT_MS = 5_000
const MAX_DEPS_CHECKED = 20

interface NpmLatestResponse {
  version?: string
  deprecated?: string | boolean
}

async function fetchPackageInfo(
  pkg: string
): Promise<{ latest: string | null; deprecated: boolean; error: string | null }> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)

  try {
    const res = await fetch(`https://registry.npmjs.org/${encodeURIComponent(pkg)}/latest`, {
      signal: controller.signal,
      headers: { Accept: 'application/json' }
    })

    clearTimeout(timer)

    if (!res.ok) {
      return { latest: null, deprecated: false, error: `HTTP ${res.status}` }
    }

    const data = (await res.json()) as NpmLatestResponse
    return {
      latest: data.version ?? null,
      deprecated: Boolean(data.deprecated),
      error: null
    }
  } catch (err) {
    clearTimeout(timer)
    const msg = err instanceof Error ? err.message : 'Unknown error'
    return { latest: null, deprecated: false, error: msg }
  }
}

const NON_SEMVER_PREFIXES = ['workspace:', 'file:', 'link:', 'git+', 'github:', 'bitbucket:']
const VERSION_PATTERN = /^(\d+)\.(\d+)\.(\d+)(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/

interface Semver {
  major: number
  minor: number
  patch: number
}

function parseVersion(raw: string): Semver | null {
  const match = VERSION_PATTERN.exec(raw.trim().replace(/^v/, ''))
  if (!match) return null
  return { major: Number(match[1]), minor: Number(match[2]), patch: Number(match[3]) }
}

function compareVersions(left: Semver, right: Semver): number {
  return left.major - right.major || left.minor - right.minor || left.patch - right.patch
}

function nextCaretBoundary(version: Semver): Semver {
  if (version.major > 0) return { major: version.major + 1, minor: 0, patch: 0 }
  if (version.minor > 0) return { major: 0, minor: version.minor + 1, patch: 0 }
  return { major: 0, minor: 0, patch: version.patch + 1 }
}

function nextTildeBoundary(version: Semver): Semver {
  return { major: version.major, minor: version.minor + 1, patch: 0 }
}

/** Whether the registry's latest version is accepted by the declared range. */
function satisfiesRange(range: string, latest: Semver): boolean {
  const normalized = range.trim()
  if (!normalized || normalized === '*' || normalized === 'latest') return true

  return normalized.split('||').some((alternative) => {
    const expression = alternative.trim()
    const prefix = expression[0]
    const versionText = expression.replace(/^(\^|~|>=|<=|>|<|=)\s*/, '')
    const version = parseVersion(versionText)
    if (!version) return false

    if (prefix === '^') {
      return (
        compareVersions(latest, version) >= 0 &&
        compareVersions(latest, nextCaretBoundary(version)) < 0
      )
    }
    if (prefix === '~') {
      return (
        compareVersions(latest, version) >= 0 &&
        compareVersions(latest, nextTildeBoundary(version)) < 0
      )
    }

    const comparator = expression.match(/^(>=|<=|>|<|=)/)?.[1] ?? '='
    const comparison = compareVersions(latest, version)
    return comparator === '>='
      ? comparison >= 0
      : comparator === '<='
        ? comparison <= 0
        : comparator === '>'
          ? comparison > 0
          : comparator === '<'
            ? comparison < 0
            : comparison === 0
  })
}

function isOutdated(current: string, latest: string | null): boolean {
  if (!latest || NON_SEMVER_PREFIXES.some((prefix) => current.startsWith(prefix))) return false
  const latestVersion = parseVersion(latest)
  return latestVersion ? !satisfiesRange(current, latestVersion) : false
}

export async function handleAuditDeps(input: AuditDepsToolInput): Promise<AuditDepsToolOutput> {
  if (!existsSync(input.packageJsonPath)) {
    throw new Error(`package.json not found at: ${input.packageJsonPath}`)
  }

  const raw = readFileSync(input.packageJsonPath, 'utf-8')
  const pkg = JSON.parse(raw) as {
    dependencies?: Record<string, string>
    devDependencies?: Record<string, string>
  }

  const allDeps: [string, string][] = [
    ...Object.entries(pkg.dependencies ?? {}),
    ...Object.entries(pkg.devDependencies ?? {})
  ]

  const checked = allDeps.slice(0, MAX_DEPS_CHECKED)

  const results = await Promise.all(
    checked.map(async ([name, versionRange]): Promise<DependencyAuditEntry> => {
      const info = await fetchPackageInfo(name)
      return {
        name,
        currentVersion: versionRange,
        latestVersion: info.latest,
        isOutdated: isOutdated(versionRange, info.latest),
        isDeprecated: info.deprecated,
        error: info.error
      }
    })
  )

  const outdated: DependencyAuditEntry[] = []
  const upToDate: DependencyAuditEntry[] = []
  const deprecated: DependencyAuditEntry[] = []
  const errors: DependencyAuditEntry[] = []

  for (const entry of results) {
    if (entry.error) {
      errors.push(entry)
    } else {
      if (entry.isDeprecated) deprecated.push(entry)
      if (entry.isOutdated) outdated.push(entry)
      if (!entry.isDeprecated && !entry.isOutdated) upToDate.push(entry)
    }
  }

  return {
    outdated,
    upToDate,
    deprecated,
    errors,
    checkedAt: new Date().toISOString()
  }
}
