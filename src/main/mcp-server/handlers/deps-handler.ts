import { readFileSync, existsSync } from 'fs'
import type {
  AuditDepsToolInput,
  AuditDepsToolOutput,
  DependencyAuditEntry,
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
      headers: { Accept: 'application/json' },
    })

    clearTimeout(timer)

    if (!res.ok) {
      return { latest: null, deprecated: false, error: `HTTP ${res.status}` }
    }

    const data = (await res.json()) as NpmLatestResponse
    return {
      latest: data.version ?? null,
      deprecated: Boolean(data.deprecated),
      error: null,
    }
  } catch (err) {
    clearTimeout(timer)
    const msg = err instanceof Error ? err.message : 'Unknown error'
    return { latest: null, deprecated: false, error: msg }
  }
}

const NON_SEMVER_PREFIXES = ['workspace:', 'file:', 'link:', 'git+', 'github:', 'bitbucket:']

function parseVersion(raw: string): string {
  return raw.replace(/^[^0-9]*/, '')
}

function isOutdated(current: string, latest: string | null): boolean {
  if (!latest) return false
  if (NON_SEMVER_PREFIXES.some((p) => current.startsWith(p))) return false
  const cur = parseVersion(current)
  return cur !== latest
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
    ...Object.entries(pkg.devDependencies ?? {}),
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
        error: info.error,
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
    checkedAt: new Date().toISOString(),
  }
}
