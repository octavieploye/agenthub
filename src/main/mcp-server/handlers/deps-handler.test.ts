import { afterEach, describe, expect, it, vi } from 'vitest'
import { mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { handleAuditDeps } from './deps-handler'

const temporaryRoots: string[] = []

function makeRoot(): string {
  const root = mkdtempSync(join(tmpdir(), 'agenthub-audit-deps-'))
  temporaryRoots.push(root)
  return root
}

function writePackageJson(root: string, content: string): string {
  const path = join(root, 'package.json')
  writeFileSync(path, content)
  return path
}

afterEach(() => {
  vi.unstubAllGlobals()
  for (const root of temporaryRoots.splice(0)) rmSync(root, { recursive: true, force: true })
})

describe('handleAuditDeps', () => {
  it('accepts a regular package.json within an approved root', async () => {
    const root = makeRoot()
    const packageJsonPath = writePackageJson(
      root,
      JSON.stringify({ dependencies: { zod: '^4.0.0' } })
    )
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ version: '4.1.0' })
      })
    )

    const result = await handleAuditDeps({ packageJsonPath }, [root])

    expect(result.upToDate).toHaveLength(1)
  })

  it('rejects paths outside approved roots before reading or fetching', async () => {
    const approvedRoot = makeRoot()
    const unapprovedRoot = makeRoot()
    const packageJsonPath = writePackageJson(unapprovedRoot, '{}')
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)

    await expect(handleAuditDeps({ packageJsonPath }, [approvedRoot])).rejects.toThrow('approved')
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('rejects a package.json symlink that resolves outside an approved root', async () => {
    const approvedRoot = makeRoot()
    const unapprovedRoot = makeRoot()
    const externalPackageJson = writePackageJson(unapprovedRoot, '{}')
    const packageJsonPath = join(approvedRoot, 'package.json')
    symlinkSync(externalPackageJson, packageJsonPath)

    await expect(handleAuditDeps({ packageJsonPath }, [approvedRoot])).rejects.toThrow('approved')
  })

  it('rejects an oversized package.json before reading dependencies', async () => {
    const root = makeRoot()
    const packageJsonPath = writePackageJson(root, ' '.repeat(1024 * 1024 + 1))
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)

    await expect(handleAuditDeps({ packageJsonPath }, [root])).rejects.toThrow('size limit')
    expect(fetchMock).not.toHaveBeenCalled()
  })
})
