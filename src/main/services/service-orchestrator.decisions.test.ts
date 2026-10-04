import { describe, it, expect } from 'vitest'
import * as fs from 'fs'
import * as path from 'path'

// Structural test: `decide` is a closure built at init and cannot be called directly,
// so the wiring of the shared-brain decisions block is checked on the source itself.

const SOURCE_FILE = path.resolve(__dirname, 'service-orchestrator.ts')
const source = fs.readFileSync(SOURCE_FILE, 'utf-8')

/** The source of the `decide` closure, up to the spawn options it returns. */
function extractDecideSource(fullSource: string): string {
  const start = fullSource.indexOf('decide: async (context) => {')
  const end = fullSource.indexOf('spawnOptions', start)
  return start === -1 || end === -1 ? '' : fullSource.slice(start, end)
}

const decideSource = extractDecideSource(source)

describe('service-orchestrator — shared-brain decisions block wiring', () => {
  it('imports resolveTaskPrompt and createDecisionBlockFetcher from the helpers', () => {
    expect(source).toMatch(
      /import\s*\{[^}]*\bresolveTaskPrompt\b[^}]*\}\s*from\s*'\.\/helpers\/task-prompt'/
    )
    expect(source).toMatch(
      /import\s*\{[^}]*\bcreateDecisionBlockFetcher\b[^}]*\}\s*from\s*'\.\/helpers\/decision-prompt-block'/
    )
  })

  it('creates the fetcher exactly once, outside decide, reading the Anamnesis reader lazily', () => {
    const creations = source.match(/createDecisionBlockFetcher\(/g) ?? []
    expect(creations).toHaveLength(1)
    expect(decideSource).not.toContain('createDecisionBlockFetcher(')
    expect(source).toMatch(
      /createDecisionBlockFetcher\(\{\s*getReader:\s*\(\)\s*=>\s*getAnamnesisReader\(\)/
    )
  })

  it('locates the decide closure', () => {
    expect(decideSource).not.toBe('')
  })

  // The fallback-on-failure behaviour itself is executed in helpers/task-prompt.test.ts.
  it('awaits resolveTaskPrompt exactly once, handing it the shared fetcher, the repo name and the task category', () => {
    const calls = decideSource.match(/resolveTaskPrompt\(/g) ?? []
    expect(calls).toHaveLength(1)
    expect(decideSource).toMatch(/const taskDescription = await resolveTaskPrompt\(\{/)
    expect(decideSource).toMatch(/\n\s*fetchDecisionBlock,\s*\n/)
    expect(decideSource).toMatch(/repoName:\s*taskRepo\.name\b/)
    expect(decideSource).toMatch(/taskCategory:\s*task\.category\b/)
  })

  it('builds the prompt parts from the dev guardrail, the effective skill, the description and the metadata', () => {
    expect(decideSource).toMatch(
      /parts:\s*\{\s*guardrail:\s*GUARDRAIL_PROMPTS\.dev,\s*skill:\s*effectiveSkill,\s*baseDescription,\s*metadataBlock\s*\}/
    )
  })

  it('logs a skipped decision block with the task id and the error type only', () => {
    expect(decideSource).toMatch(
      /onError:\s*\(errorType\)\s*=>\s*log\.warn\('\[orchestrator\] decision block skipped',\s*\{\s*taskId:\s*task\.id,\s*errorType\s*\}\)/
    )
  })

  it('no longer fetches or composes inline in decide', () => {
    expect(decideSource).not.toMatch(/\btry\s*\{\s*decisionBlock\b/)
    expect(decideSource).not.toContain('fetchDecisionBlock(')
    expect(source).not.toContain('composeTaskPrompt')
  })

  it('no longer contains the inline prompt template', () => {
    expect(source).not.toContain('Use skill: /${effectiveSkill}')
    expect(source).not.toContain('${GUARDRAIL_PROMPTS.dev}\\n\\n')
  })
})
