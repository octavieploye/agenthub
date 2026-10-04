import { describe, it, expect, vi } from 'vitest'
import { composeTaskPrompt, resolveTaskPrompt } from './task-prompt'

const guardrail = '[ORCHESTRATOR GUARDRAIL — DEV]\nBe careful.'
const baseDescription = 'Implement the thing.'
const metadataBlock = '\n\nTarget repo: /x/y\nCommit boundary: false — do NOT ask.'
const decisionBlock =
  '<anamnesis-decisions source="shared brain">\n- [Completed] code: A — B\n</anamnesis-decisions>'

describe('composeTaskPrompt', () => {
  it("with a skill: guardrail, skill line, description, metadata (today's shape)", () => {
    const out = composeTaskPrompt({
      guardrail,
      skill: 'tester-backend',
      baseDescription,
      metadataBlock,
      decisionBlock: ''
    })
    expect(out).toBe(
      `${guardrail}\n\nUse skill: /tester-backend\n\n${baseDescription}${metadataBlock}`
    )
  })

  it("without a skill (null): guardrail, description, metadata (today's shape)", () => {
    const out = composeTaskPrompt({
      guardrail,
      skill: null,
      baseDescription,
      metadataBlock,
      decisionBlock: ''
    })
    expect(out).toBe(`${guardrail}\n\n${baseDescription}${metadataBlock}`)
  })

  it('without a skill (undefined): same as null', () => {
    const out = composeTaskPrompt({
      guardrail,
      skill: undefined,
      baseDescription,
      metadataBlock,
      decisionBlock: ''
    })
    expect(out).toBe(`${guardrail}\n\n${baseDescription}${metadataBlock}`)
  })

  it('appends a non-empty decision block after the metadata, separated by a blank line (with skill)', () => {
    const out = composeTaskPrompt({
      guardrail,
      skill: 'tester-backend',
      baseDescription,
      metadataBlock,
      decisionBlock
    })
    expect(out).toBe(
      `${guardrail}\n\nUse skill: /tester-backend\n\n${baseDescription}${metadataBlock}\n\n${decisionBlock}`
    )
  })

  it('appends a non-empty decision block after the metadata, separated by a blank line (no skill)', () => {
    const out = composeTaskPrompt({
      guardrail,
      skill: null,
      baseDescription,
      metadataBlock,
      decisionBlock
    })
    expect(out).toBe(`${guardrail}\n\n${baseDescription}${metadataBlock}\n\n${decisionBlock}`)
  })

  it('separates the decision block by a blank line even when the metadata block is empty', () => {
    const out = composeTaskPrompt({
      guardrail,
      skill: null,
      baseDescription,
      metadataBlock: '',
      decisionBlock
    })
    expect(out).toBe(`${guardrail}\n\n${baseDescription}\n\n${decisionBlock}`)
  })

  it('an empty decision block changes nothing', () => {
    const withEmpty = composeTaskPrompt({
      guardrail,
      skill: 'x',
      baseDescription,
      metadataBlock,
      decisionBlock: ''
    })
    expect(withEmpty.endsWith(metadataBlock)).toBe(true)
    expect(withEmpty).not.toContain('anamnesis-decisions')
  })
})

describe('resolveTaskPrompt', () => {
  const parts = { guardrail, skill: 'tester-backend', baseDescription, metadataBlock }
  const withoutBlock = composeTaskPrompt({ ...parts, decisionBlock: '' })

  /** A fetcher whose resolved value is deliberately not a string (a misbehaving reader). */
  function fetcherReturning(value: unknown): (repo: string, category: string | null) => Promise<string> {
    return async () => value as string
  }

  it('fetcher rejects: byte-identical to the prompt without a block, onError gets the error name only', async () => {
    class ReaderDownError extends Error {
      override name = 'ReaderDownError'
    }
    const onError = vi.fn()
    const out = await resolveTaskPrompt({
      parts,
      fetchDecisionBlock: async () => {
        throw new ReaderDownError('secret http://localhost:9300?token=abc')
      },
      repoName: 'agenthub',
      taskCategory: 'backend',
      onError
    })
    expect(out).toBe(withoutBlock)
    expect(onError).toHaveBeenCalledTimes(1)
    expect(onError).toHaveBeenCalledWith('ReaderDownError')
    expect(JSON.stringify(onError.mock.calls)).not.toContain('secret')
  })

  it('fetcher throws synchronously: same fallback, onError gets the error name only', async () => {
    const onError = vi.fn()
    const out = await resolveTaskPrompt({
      parts,
      fetchDecisionBlock: () => {
        throw new TypeError('sync boom')
      },
      repoName: 'agenthub',
      taskCategory: 'backend',
      onError
    })
    expect(out).toBe(withoutBlock)
    expect(onError).toHaveBeenCalledTimes(1)
    expect(onError).toHaveBeenCalledWith('TypeError')
  })

  it('fetcher rejects with a non-Error value: onError gets its typeof, never the value', async () => {
    const onError = vi.fn()
    const out = await resolveTaskPrompt({
      parts,
      fetchDecisionBlock: () => Promise.reject('secret-token-value'),
      repoName: 'agenthub',
      taskCategory: null,
      onError
    })
    expect(out).toBe(withoutBlock)
    expect(onError).toHaveBeenCalledTimes(1)
    expect(onError).toHaveBeenCalledWith('string')
  })

  it('fetcher returns a block: appended after the metadata exactly as composeTaskPrompt does', async () => {
    const onError = vi.fn()
    const out = await resolveTaskPrompt({
      parts,
      fetchDecisionBlock: async () => decisionBlock,
      repoName: 'agenthub',
      taskCategory: 'backend',
      onError
    })
    expect(out).toBe(composeTaskPrompt({ ...parts, decisionBlock }))
    expect(out).toBe(
      `${guardrail}\n\nUse skill: /tester-backend\n\n${baseDescription}${metadataBlock}\n\n${decisionBlock}`
    )
    expect(onError).not.toHaveBeenCalled()
  })

  it('fetcher returns an empty string: prompt unchanged, no error reported', async () => {
    const onError = vi.fn()
    const out = await resolveTaskPrompt({
      parts,
      fetchDecisionBlock: async () => '',
      repoName: 'agenthub',
      taskCategory: 'backend',
      onError
    })
    expect(out).toBe(withoutBlock)
    expect(onError).not.toHaveBeenCalled()
  })

  it.each([
    ['undefined', undefined],
    ['an array', ['<anamnesis-decisions>']],
    ['a number', 42]
  ])('fetcher returns %s: decision block is "" and the type error is reported', async (_label, value) => {
    const onError = vi.fn()
    const out = await resolveTaskPrompt({
      parts,
      fetchDecisionBlock: fetcherReturning(value),
      repoName: 'agenthub',
      taskCategory: 'backend',
      onError
    })
    expect(out).toBe(withoutBlock)
    expect(onError).toHaveBeenCalledTimes(1)
    expect(onError).toHaveBeenCalledWith('TypeError')
  })

  it('calls the fetcher once with exactly (repoName, taskCategory)', async () => {
    const fetchDecisionBlock = vi.fn(async () => '')
    await resolveTaskPrompt({
      parts,
      fetchDecisionBlock,
      repoName: 'anamnesis',
      taskCategory: 'security'
    })
    expect(fetchDecisionBlock).toHaveBeenCalledTimes(1)
    expect(fetchDecisionBlock.mock.calls[0]).toEqual(['anamnesis', 'security'])
  })

  it('an onError that throws does not escape', async () => {
    const out = await resolveTaskPrompt({
      parts,
      fetchDecisionBlock: async () => {
        throw new Error('down')
      },
      repoName: 'agenthub',
      taskCategory: 'backend',
      onError: () => {
        throw new Error('logger broke')
      }
    })
    expect(out).toBe(withoutBlock)
  })

  it('never throws for a rejecting fetcher, with or without onError', async () => {
    const rejecting = (): Promise<string> => Promise.reject(new Error('down'))
    await expect(
      resolveTaskPrompt({ parts, fetchDecisionBlock: rejecting, repoName: 'r', taskCategory: null })
    ).resolves.toBe(withoutBlock)
    await expect(
      resolveTaskPrompt({
        parts,
        fetchDecisionBlock: rejecting,
        repoName: 'r',
        taskCategory: null,
        onError: vi.fn()
      })
    ).resolves.toBe(withoutBlock)
  })

  it('keeps the no-skill shape when the fetch fails', async () => {
    const noSkill = { ...parts, skill: null }
    const out = await resolveTaskPrompt({
      parts: noSkill,
      fetchDecisionBlock: () => Promise.reject(new Error('down')),
      repoName: 'agenthub',
      taskCategory: 'backend'
    })
    expect(out).toBe(`${guardrail}\n\n${baseDescription}${metadataBlock}`)
  })
})
