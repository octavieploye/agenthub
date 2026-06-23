import { describe, it, expect } from 'vitest'
import { buildSprintDecompositionPrompt } from './sprint-decomposition-prompt'

const baseInput = {
  docPath: '/home/user/brief.md',
  projectName: 'My Project',
  repoId: 'repo-123',
  outputPath: '/home/user/.config/agenthub/sprint-intake',
  projectPath: '/home/user/projects/my-project',
  draftFilename: 'sprint-proj-abc.draft.json'
}

describe('buildSprintDecompositionPrompt', () => {
  it('includes the doc path', () => {
    expect(buildSprintDecompositionPrompt(baseInput)).toContain('/home/user/brief.md')
  })

  it('includes the repoId in the JSON schema', () => {
    expect(buildSprintDecompositionPrompt(baseInput)).toContain('repo-123')
  })

  it('includes the outputPath for the draft JSON', () => {
    expect(buildSprintDecompositionPrompt(baseInput)).toContain('/home/user/.config/agenthub/sprint-intake')
  })

  it('includes the draftFilename', () => {
    expect(buildSprintDecompositionPrompt(baseInput)).toContain('sprint-proj-abc.draft.json')
  })

  it('includes the projectPath for sprint.md', () => {
    expect(buildSprintDecompositionPrompt(baseInput)).toContain('/home/user/projects/my-project')
  })

  it('instructs agent to write sprint.md first, draft JSON second', () => {
    const result = buildSprintDecompositionPrompt(baseInput)
    const mdIndex = result.indexOf('sprint.md')
    const draftIndex = result.indexOf('.draft.json')
    expect(mdIndex).toBeGreaterThan(-1)
    expect(draftIndex).toBeGreaterThan(-1)
    expect(mdIndex).toBeLessThan(draftIndex)
  })

  it('returns a non-empty string', () => {
    expect(buildSprintDecompositionPrompt(baseInput).length).toBeGreaterThan(200)
  })
})
