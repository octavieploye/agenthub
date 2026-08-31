import { describe, it, expect } from 'vitest'
import { calculateRisk } from './risk-calculator'

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** N files all inside the same directory — isolates R4 without triggering R7. */
function filesInSameDir(n: number): string[] {
  return Array.from({ length: n }, (_, i) => `src/main/services/file${i}.ts`)
}

/** N files each in a unique directory — triggers both R4 and R7 above threshold. */
function filesInDifferentDirs(n: number): string[] {
  return Array.from({ length: n }, (_, i) => `src/dir${i}/file${i}.ts`)
}

// ─── Output shape ─────────────────────────────────────────────────────────────

describe('calculateRisk', () => {
  describe('output shape', () => {
    it('returns riskScore, riskFactors, and riskLevel for empty input', () => {
      const result = calculateRisk({})
      expect(typeof result.riskScore).toBe('number')
      expect(Array.isArray(result.riskFactors)).toBe(true)
      expect(['high', 'medium', 'low']).toContain(result.riskLevel)
    })

    it('returns a riskScore between 0 and 1 inclusive', () => {
      const result = calculateRisk({})
      expect(result.riskScore).toBeGreaterThanOrEqual(0)
      expect(result.riskScore).toBeLessThanOrEqual(1)
    })
  })

  // ─── R1 — Destructive command detection (+0.30) ───────────────────────────

  describe('R1 — destructive command detection (+0.30)', () => {
    // Every pattern from destructive-commands-ban.md, organised by category.
    const banListPatterns: [string, string][] = [
      // Git — permanent data destruction
      ['git clean -fd workspace', 'git clean'],
      ['git reset --hard HEAD', 'git reset --hard'],
      ['git push --force origin main', 'git push --force'],
      ['git push --force-with-lease origin main', 'git push --force-with-lease'],
      ['git push -f origin main', 'git push -f'],
      ['git rebase -i HEAD~3', 'git rebase'],
      ['git checkout .', 'git checkout .'],
      ['git restore .', 'git restore .'],
      ['git branch -D feature/old', 'git branch -D'],
      ['git stash drop stash@{0}', 'git stash drop'],
      ['git reflog expire --expire=now --all', 'git reflog expire'],
      ['git gc --prune=now', 'git gc --prune'],
      // Shell — permanent file destruction
      ['rm -f important.txt', 'rm -f'],
      ['rm -rf /path/to/dir', 'rm -rf'],
      ['rm -r old-directory/', 'rm -r'],
      ['find . -name "*.log" -delete', 'find -delete'],
      ['find /tmp -exec rm {} \\;', 'find -exec rm'],
      ['mv temp-file /dev/null', 'mv /dev/null'],
      ['rm ~/.ssh/id_rsa', 'rm .ssh'],
      ['rm .env.local', 'rm .env'],
      // Database — permanent data destruction
      ['DROP TABLE users', 'DROP TABLE'],
      ['TRUNCATE TABLE sessions', 'TRUNCATE TABLE'],
      ['DELETE FROM tasks WHERE 1=1', 'DELETE FROM'],
      // Docker — permanent volume destruction
      ['docker system prune -a --volumes', 'docker system prune'],
      ['docker volume rm myvolume', 'docker volume rm'],
      ['docker volume prune', 'docker volume prune'],
      ['docker rm -fv container123', 'docker rm -v'],
      // Process killing
      ['kill -9 1234', 'kill -9'],
      ['pkill -9 node', 'pkill -9'],
      ['killall -9 electron', 'killall -9'],
      // Other destructive utilities
      ['shred -u secret.key', 'shred'],
      ['dd if=/dev/zero of=disk.img bs=1M count=100', 'dd if=/dev/zero'],
      ['truncate -s 0 app.log', 'truncate -s 0'],
    ]

    it.each(banListPatterns)(
      'detects "%s" (%s) in description',
      (command) => {
        const result = calculateRisk({ description: command })
        expect(result.riskFactors.some((f) => f.startsWith('R1:'))).toBe(true)
      }
    )

    it('detects destructive pattern in skills array when description is clean', () => {
      const result = calculateRisk({
        description: 'prepare for deployment',
        skills: ['git clean -fd artifacts'],
      })
      expect(result.riskFactors.some((f) => f.startsWith('R1:'))).toBe(true)
    })

    it('is case-insensitive — GIT CLEAN triggers R1', () => {
      const result = calculateRisk({ description: 'GIT CLEAN -FD' })
      expect(result.riskFactors.some((f) => f.startsWith('R1:'))).toBe(true)
    })

    it('is case-insensitive — RM -RF triggers R1', () => {
      const result = calculateRisk({ description: 'RM -RF /' })
      expect(result.riskFactors.some((f) => f.startsWith('R1:'))).toBe(true)
    })

    it('is case-insensitive — drop table triggers R1', () => {
      const result = calculateRisk({ description: 'drop table users' })
      expect(result.riskFactors.some((f) => f.startsWith('R1:'))).toBe(true)
    })

    it('is case-insensitive — KILL -9 triggers R1', () => {
      const result = calculateRisk({ description: 'KILL -9 1234' })
      expect(result.riskFactors.some((f) => f.startsWith('R1:'))).toBe(true)
    })

    it('does not fire on a safe description', () => {
      const result = calculateRisk({ description: 'update README with new API docs' })
      expect(result.riskFactors.some((f) => f.startsWith('R1:'))).toBe(false)
    })

    it('adds exactly +0.30 to score in isolation', () => {
      // Non-empty description (no R6), no files (no R4/R7/R2), no category (no R3), no tokens (no R5)
      const result = calculateRisk({ description: 'git clean -fd' })
      expect(result.riskScore).toBe(0.3)
    })
  })

  // ─── R2 — Protected path matching (+0.25) ────────────────────────────────

  describe('R2 — protected path matching (+0.25)', () => {
    it('fires on exact file path match', () => {
      const result = calculateRisk({
        description: 'update config',
        targetFiles: ['src/main/db/agenthub.db'],
        protectedPaths: ['src/main/db/agenthub.db'],
      })
      expect(result.riskFactors.some((f) => f.startsWith('R2:'))).toBe(true)
    })

    it('fires when file is under a protected directory prefix', () => {
      const result = calculateRisk({
        description: 'update migration',
        targetFiles: ['src/main/db/migrations/001-init.sql'],
        protectedPaths: ['src/main/db'],
      })
      expect(result.riskFactors.some((f) => f.startsWith('R2:'))).toBe(true)
    })

    it('fires when at least one of multiple target files matches a protected path', () => {
      const result = calculateRisk({
        description: 'bulk update',
        targetFiles: ['src/renderer/App.tsx', 'src/main/db/agenthub.db'],
        protectedPaths: ['src/main/db/agenthub.db'],
      })
      expect(result.riskFactors.some((f) => f.startsWith('R2:'))).toBe(true)
    })

    it('does not fire when protectedPaths is not supplied', () => {
      const result = calculateRisk({
        description: 'update config',
        targetFiles: ['src/main/db/agenthub.db'],
      })
      expect(result.riskFactors.some((f) => f.startsWith('R2:'))).toBe(false)
    })

    it('does not fire when protectedPaths is empty', () => {
      const result = calculateRisk({
        description: 'update config',
        targetFiles: ['src/main/db/agenthub.db'],
        protectedPaths: [],
      })
      expect(result.riskFactors.some((f) => f.startsWith('R2:'))).toBe(false)
    })

    it('does not fire when target file is not in any protected path', () => {
      const result = calculateRisk({
        description: 'update renderer',
        targetFiles: ['src/renderer/src/App.tsx'],
        protectedPaths: ['src/main/db'],
      })
      expect(result.riskFactors.some((f) => f.startsWith('R2:'))).toBe(false)
    })

    it('does not fire on partial directory name — no false prefix match', () => {
      // 'src/main/dba/schema.sql' must NOT match protected path 'src/main/db'
      const result = calculateRisk({
        description: 'update schema',
        targetFiles: ['src/main/dba/schema.sql'],
        protectedPaths: ['src/main/db'],
      })
      expect(result.riskFactors.some((f) => f.startsWith('R2:'))).toBe(false)
    })

    it('adds exactly +0.25 to score in isolation', () => {
      const result = calculateRisk({
        description: 'fix migration',
        targetFiles: ['migrations/001.sql'],
        protectedPaths: ['migrations/001.sql'],
      })
      expect(result.riskScore).toBe(0.25)
    })
  })

  // ─── R3 — Supervised category detection (+0.15) ──────────────────────────

  describe('R3 — supervised category detection (+0.15)', () => {
    it('fires when category is supervised and requiresApproval is absent', () => {
      const result = calculateRisk({
        description: 'deploy to prod',
        category: 'deployment',
        supervisedCategories: ['deployment'],
      })
      expect(result.riskFactors.some((f) => f.startsWith('R3:'))).toBe(true)
    })

    it('fires when category is supervised and requiresApproval is explicitly false', () => {
      const result = calculateRisk({
        description: 'deploy to prod',
        category: 'deployment',
        supervisedCategories: ['deployment'],
        requiresApproval: false,
      })
      expect(result.riskFactors.some((f) => f.startsWith('R3:'))).toBe(true)
    })

    it('does not fire when requiresApproval is true', () => {
      const result = calculateRisk({
        description: 'deploy to prod',
        category: 'deployment',
        supervisedCategories: ['deployment'],
        requiresApproval: true,
      })
      expect(result.riskFactors.some((f) => f.startsWith('R3:'))).toBe(false)
    })

    it('does not fire when category is not in supervisedCategories', () => {
      const result = calculateRisk({
        description: 'add unit tests',
        category: 'testing',
        supervisedCategories: ['deployment', 'security'],
      })
      expect(result.riskFactors.some((f) => f.startsWith('R3:'))).toBe(false)
    })

    it('does not fire when supervisedCategories is not supplied', () => {
      const result = calculateRisk({
        description: 'deploy to prod',
        category: 'deployment',
      })
      expect(result.riskFactors.some((f) => f.startsWith('R3:'))).toBe(false)
    })

    it('does not fire when supervisedCategories is empty', () => {
      const result = calculateRisk({
        description: 'deploy to prod',
        category: 'deployment',
        supervisedCategories: [],
      })
      expect(result.riskFactors.some((f) => f.startsWith('R3:'))).toBe(false)
    })

    it('includes the category name in the risk factor label', () => {
      const result = calculateRisk({
        description: 'critical op',
        category: 'security-patch',
        supervisedCategories: ['security-patch'],
      })
      const r3 = result.riskFactors.find((f) => f.startsWith('R3:'))
      expect(r3).toContain('security-patch')
    })

    it('adds exactly +0.15 to score in isolation', () => {
      const result = calculateRisk({
        description: 'deploy',
        category: 'deploy',
        supervisedCategories: ['deploy'],
      })
      expect(result.riskScore).toBe(0.15)
    })
  })

  // ─── R4 — File count ─────────────────────────────────────────────────────

  describe('R4 — file count (+0.05 for 4–10 files, +0.10 for 11+)', () => {
    it('does not fire for 0 files', () => {
      const result = calculateRisk({ description: 'update docs' })
      expect(result.riskFactors.some((f) => f.startsWith('R4:'))).toBe(false)
    })

    it('does not fire for 1 file', () => {
      const result = calculateRisk({ description: 'fix bug', targetFiles: ['src/main/a.ts'] })
      expect(result.riskFactors.some((f) => f.startsWith('R4:'))).toBe(false)
    })

    it('does not fire for 3 files (boundary below moderate floor)', () => {
      const result = calculateRisk({
        description: 'fix bug',
        targetFiles: filesInSameDir(3),
      })
      expect(result.riskFactors.some((f) => f.startsWith('R4:'))).toBe(false)
    })

    it('adds +0.05 for 4 files (moderate floor boundary)', () => {
      const result = calculateRisk({
        description: 'batch update',
        targetFiles: filesInSameDir(4),
      })
      const r4 = result.riskFactors.find((f) => f.startsWith('R4:'))
      expect(r4).toBeDefined()
      expect(r4).toContain('Moderate')
      expect(r4).toContain('4 files')
      expect(result.riskScore).toBe(0.05)
    })

    it('adds +0.05 for 10 files (high ceiling boundary — still moderate)', () => {
      const result = calculateRisk({
        description: 'batch update',
        targetFiles: filesInSameDir(10),
      })
      const r4 = result.riskFactors.find((f) => f.startsWith('R4:'))
      expect(r4).toBeDefined()
      expect(r4).toContain('Moderate')
      expect(result.riskScore).toBe(0.05)
    })

    it('adds +0.10 for 11 files (first file above high ceiling)', () => {
      const result = calculateRisk({
        description: 'batch update',
        targetFiles: filesInSameDir(11),
      })
      const r4 = result.riskFactors.find((f) => f.startsWith('R4:'))
      expect(r4).toBeDefined()
      expect(r4).toContain('High')
      expect(r4).toContain('11 files')
      expect(result.riskScore).toBe(0.1)
    })

    it('adds +0.10 for 50 files', () => {
      const result = calculateRisk({
        description: 'major refactor',
        targetFiles: filesInSameDir(50),
      })
      expect(result.riskScore).toBe(0.1)
    })
  })

  // ─── R5 — Token budget ───────────────────────────────────────────────────

  describe('R5 — token budget (+0.05 for 20K–50K tokens, +0.10 for >50K)', () => {
    it('does not fire when estimatedTokens is not provided', () => {
      const result = calculateRisk({ description: 'fix bug' })
      expect(result.riskFactors.some((f) => f.startsWith('R5:'))).toBe(false)
    })

    it('does not fire when estimatedTokens is undefined', () => {
      const result = calculateRisk({ description: 'fix bug', estimatedTokens: undefined })
      expect(result.riskFactors.some((f) => f.startsWith('R5:'))).toBe(false)
    })

    it('does not fire when estimatedTokens is NaN', () => {
      const result = calculateRisk({ description: 'fix bug', estimatedTokens: NaN })
      expect(result.riskFactors.some((f) => f.startsWith('R5:'))).toBe(false)
    })

    it('does not fire for 20000 tokens (at threshold, not above)', () => {
      const result = calculateRisk({ description: 'fix bug', estimatedTokens: 20_000 })
      expect(result.riskFactors.some((f) => f.startsWith('R5:'))).toBe(false)
    })

    it('adds +0.05 for 20001 tokens (first token above moderate threshold)', () => {
      const result = calculateRisk({ description: 'fix bug', estimatedTokens: 20_001 })
      const r5 = result.riskFactors.find((f) => f.startsWith('R5:'))
      expect(r5).toBeDefined()
      expect(r5).toContain('High token budget')
      expect(result.riskScore).toBe(0.05)
    })

    it('adds +0.05 for 50000 tokens (at high threshold, not above)', () => {
      const result = calculateRisk({ description: 'fix bug', estimatedTokens: 50_000 })
      const r5 = result.riskFactors.find((f) => f.startsWith('R5:'))
      expect(r5).toContain('High token budget')
      expect(result.riskScore).toBe(0.05)
    })

    it('adds +0.10 for 50001 tokens (first token above high threshold)', () => {
      const result = calculateRisk({ description: 'fix bug', estimatedTokens: 50_001 })
      const r5 = result.riskFactors.find((f) => f.startsWith('R5:'))
      expect(r5).toBeDefined()
      expect(r5).toContain('Very high token budget')
      expect(result.riskScore).toBe(0.1)
    })

    it('adds +0.10 for 100000 tokens', () => {
      const result = calculateRisk({ description: 'fix bug', estimatedTokens: 100_000 })
      expect(result.riskScore).toBe(0.1)
    })
  })

  // ─── R6 — No description (+0.05) ─────────────────────────────────────────

  describe('R6 — no description (+0.05)', () => {
    it('fires when description is omitted', () => {
      const result = calculateRisk({})
      expect(result.riskFactors.some((f) => f.startsWith('R6:'))).toBe(true)
    })

    it('fires when description is an empty string', () => {
      const result = calculateRisk({ description: '' })
      expect(result.riskFactors.some((f) => f.startsWith('R6:'))).toBe(true)
    })

    it('fires when description is whitespace only', () => {
      const result = calculateRisk({ description: '   ' })
      expect(result.riskFactors.some((f) => f.startsWith('R6:'))).toBe(true)
    })

    it('fires when description is a tab character', () => {
      const result = calculateRisk({ description: '\t' })
      expect(result.riskFactors.some((f) => f.startsWith('R6:'))).toBe(true)
    })

    it('does not fire when description has content', () => {
      const result = calculateRisk({ description: 'fix auth bug' })
      expect(result.riskFactors.some((f) => f.startsWith('R6:'))).toBe(false)
    })

    it('adds exactly +0.05 to score in isolation', () => {
      const result = calculateRisk({ description: '' })
      expect(result.riskScore).toBe(0.05)
    })
  })

  // ─── R7 — Cross-directory scope (+0.05) ──────────────────────────────────

  describe('R7 — cross-directory scope (+0.05)', () => {
    it('does not fire for a single file', () => {
      const result = calculateRisk({
        description: 'fix bug',
        targetFiles: ['src/main/services/agent-manager.ts'],
      })
      expect(result.riskFactors.some((f) => f.startsWith('R7:'))).toBe(false)
    })

    it('does not fire for multiple files in the same directory', () => {
      const result = calculateRisk({
        description: 'fix bug',
        targetFiles: ['src/main/services/a.ts', 'src/main/services/b.ts', 'src/main/services/c.ts'],
      })
      expect(result.riskFactors.some((f) => f.startsWith('R7:'))).toBe(false)
    })

    it('fires for files spanning two directories', () => {
      const result = calculateRisk({
        description: 'fix wiring',
        targetFiles: ['src/main/services/agent.ts', 'src/renderer/src/App.tsx'],
      })
      expect(result.riskFactors.some((f) => f.startsWith('R7:'))).toBe(true)
    })

    it('includes the directory count in the risk factor label', () => {
      const result = calculateRisk({
        description: 'refactor',
        targetFiles: [
          'src/main/services/agent.ts',
          'src/renderer/src/App.tsx',
          'src/shared/types/agent.types.ts',
        ],
      })
      const r7 = result.riskFactors.find((f) => f.startsWith('R7:'))
      expect(r7).toBeDefined()
      expect(r7).toContain('3 directories')
    })

    it('adds exactly +0.05 to score in isolation', () => {
      // Two files in different dirs, non-empty description, no other triggers
      const result = calculateRisk({
        description: 'fix wiring',
        targetFiles: ['src/main/a.ts', 'src/renderer/b.ts'],
      })
      expect(result.riskScore).toBe(0.05)
    })
  })

  // ─── Score clamping ───────────────────────────────────────────────────────

  describe('score clamped at 1.0', () => {
    it('clamps combined score to 1.0 when all seven rules fire', () => {
      // R1 via skills (+0.30), R6 via empty description (+0.05)
      // R2 protected path (+0.25), R3 supervised category (+0.15)
      // R4 11+ files (+0.10), R5 >50K tokens (+0.10), R7 cross-dir (+0.05)
      // Total: 1.00 — Math.min(1.0, 1.0) = 1.0
      const targetFiles = [
        'src/main/db/agenthub.db',         // protected (R2)
        'src/renderer/App.tsx',             // different dir (R7)
        ...Array.from({ length: 9 }, (_, i) => `src/services/file${i}.ts`), // 9 more = 11 total (R4 high)
      ]
      const result = calculateRisk({
        description: '',                     // R6: no description
        skills: ['git clean -fd'],           // R1: destructive in skills
        targetFiles,                         // R2 + R4 + R7
        protectedPaths: ['src/main/db/agenthub.db'],
        category: 'deployment',             // R3
        supervisedCategories: ['deployment'],
        requiresApproval: false,
        estimatedTokens: 100_000,           // R5: very high
      })
      expect(result.riskScore).toBe(1.0)
      expect(result.riskLevel).toBe('high')
    })
  })

  // ─── riskLevel thresholds ─────────────────────────────────────────────────

  describe('riskLevel thresholds', () => {
    it('returns low for score < 0.35 — R1 alone (0.30)', () => {
      const result = calculateRisk({ description: 'git clean -fd' })
      expect(result.riskScore).toBe(0.3)
      expect(result.riskLevel).toBe('low')
    })

    it('returns low for score of 0.05 — R6 only', () => {
      const result = calculateRisk({ description: '' })
      expect(result.riskScore).toBe(0.05)
      expect(result.riskLevel).toBe('low')
    })

    it('returns medium at exactly 0.35 boundary — R1 via skills + R6 via empty description', () => {
      const result = calculateRisk({
        description: '',
        skills: ['git clean -fd'],
      })
      expect(result.riskScore).toBe(0.35)
      expect(result.riskLevel).toBe('medium')
    })

    it('returns medium for score of 0.55 — R1 + R2', () => {
      const result = calculateRisk({
        description: 'git clean -fd workspace',
        targetFiles: ['src/main/db/agenthub.db'],
        protectedPaths: ['src/main/db/agenthub.db'],
      })
      expect(result.riskScore).toBe(0.55)
      expect(result.riskLevel).toBe('medium')
    })

    it('returns high at exactly 0.70 boundary — R1 + R2 + R3', () => {
      const result = calculateRisk({
        description: 'git clean -fd workspace',
        targetFiles: ['src/main/db/agenthub.db'],
        protectedPaths: ['src/main/db/agenthub.db'],
        category: 'deployment',
        supervisedCategories: ['deployment'],
        requiresApproval: false,
      })
      expect(result.riskScore).toBe(0.7)
      expect(result.riskLevel).toBe('high')
    })

    it('returns high for score above 0.70', () => {
      const result = calculateRisk({
        description: 'git clean -fd workspace',
        targetFiles: ['src/main/db/agenthub.db'],
        protectedPaths: ['src/main/db/agenthub.db'],
        category: 'deployment',
        supervisedCategories: ['deployment'],
        requiresApproval: false,
        estimatedTokens: 100_000,  // R5 +0.10 → 0.80
      })
      expect(result.riskScore).toBe(0.8)
      expect(result.riskLevel).toBe('high')
    })
  })

  // ─── Additive scoring — independent rules accumulate correctly ────────────

  describe('additive scoring', () => {
    it('accumulates R4 + R5 independently', () => {
      // R4 moderate (4 same-dir files) + R5 moderate (25K tokens) = 0.10
      const result = calculateRisk({
        description: 'fix batch',
        targetFiles: filesInSameDir(4),
        estimatedTokens: 25_000,
      })
      expect(result.riskScore).toBe(0.1)
      expect(result.riskFactors.some((f) => f.startsWith('R4:'))).toBe(true)
      expect(result.riskFactors.some((f) => f.startsWith('R5:'))).toBe(true)
    })

    it('accumulates R6 + R7 independently', () => {
      // R6 (empty description) + R7 (two dirs) = 0.10
      const result = calculateRisk({
        description: '',
        targetFiles: ['src/main/a.ts', 'src/renderer/b.ts'],
      })
      expect(result.riskScore).toBe(0.1)
      expect(result.riskFactors.some((f) => f.startsWith('R6:'))).toBe(true)
      expect(result.riskFactors.some((f) => f.startsWith('R7:'))).toBe(true)
    })

    it('accumulates R4 + R5 + R6 + R7 when files span multiple dirs', () => {
      // filesInDifferentDirs(4): 4 files in 4 dirs → R4 moderate (0.05) + R7 (0.05)
      // R5 moderate (25K tokens) = 0.05
      // R6 (empty description) = 0.05
      // Total = 0.20
      const result = calculateRisk({
        description: '',
        targetFiles: filesInDifferentDirs(4),
        estimatedTokens: 25_000,
      })
      expect(result.riskFactors.some((f) => f.startsWith('R4:'))).toBe(true)
      expect(result.riskFactors.some((f) => f.startsWith('R5:'))).toBe(true)
      expect(result.riskFactors.some((f) => f.startsWith('R6:'))).toBe(true)
      expect(result.riskFactors.some((f) => f.startsWith('R7:'))).toBe(true)
      expect(result.riskScore).toBe(0.2)
    })
  })
})
