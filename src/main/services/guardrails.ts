import { mkdirSync, writeFileSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'

/**
 * Git-boundary guardrail for orchestrator-spawned agents.
 *
 * Worker agents must never run git-mutation commands — git writes are the
 * git-ops agent's job only. This rule lives in src/ (not plugin/) so it is
 * version-controlled alongside the spawn code that injects it, and so a
 * spawned builder agent cannot silently rewrite it.
 */
export const GIT_BOUNDARY_RULE = `## GIT BOUNDARY (worker agents)

You are a worker agent. You NEVER run git commands that mutate state:
- NEVER: git commit, git reset (ANY form, including plain \`git reset\` and \`git reset HEAD\`), git stash (including pop/drop), git clean, git checkout ., git restore ., git push, git rebase, git branch -D.
- Git writes are performed ONLY by the git-ops agent, never by you.

You work ONLY on the files your task explicitly names. If \`git status\` shows unrelated dirty files, untracked files, or other commits/branches, ignore them. They are not yours to touch, fix, tidy, or "clean up".

When your task is complete: signal completion and STOP immediately. Do NOT tidy up git. Do NOT try to leave the repository "clean". Do NOT stage, commit, reset, stash, or otherwise touch git.
`

/**
 * Writes the git-boundary rule to a temp file and returns its path. The path is
 * injected into every spawned agent via `--append-system-prompt-file`. Written on
 * every call so a tmpdir cleanup cannot leave a stale path pointing at a missing file.
 */
export function getGitBoundaryPath(): string {
  const dir = join(tmpdir(), 'agenthub-guardrails')
  mkdirSync(dir, { recursive: true })
  const filePath = join(dir, 'git-boundary.md')
  writeFileSync(filePath, GIT_BOUNDARY_RULE, 'utf-8')
  return filePath
}
