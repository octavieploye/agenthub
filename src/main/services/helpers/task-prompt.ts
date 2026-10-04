export interface TaskPromptParts {
  guardrail: string
  skill: string | null | undefined
  baseDescription: string
  /** Either "" or a block that already starts with its own blank-line separator. */
  metadataBlock: string
  /** Either "" or the delimited shared-brain decisions block. */
  decisionBlock: string
}

/** Assemble the prompt of an orchestrated task; an empty decision block leaves the prompt unchanged. */
export function composeTaskPrompt(parts: TaskPromptParts): string {
  const { guardrail, skill, baseDescription, metadataBlock, decisionBlock } = parts
  const skillLine = skill ? `Use skill: /${skill}\n\n` : ''
  const decisions = decisionBlock ? `\n\n${decisionBlock}` : ''
  return `${guardrail}\n\n${skillLine}${baseDescription}${metadataBlock}${decisions}`
}

/** The prompt parts known before the shared-brain decision block is fetched. */
export type TaskPromptBaseParts = Omit<TaskPromptParts, 'decisionBlock'>

export interface ResolveTaskPromptInput {
  parts: TaskPromptBaseParts
  fetchDecisionBlock: (repoName: string, taskCategory: string | null) => Promise<string>
  repoName: string
  taskCategory: string | null
  /** Receives the error name/type only — never the message, which may carry a URL or a secret. */
  onError?: (errorType: string) => void
}

/** The name of a thrown Error, or the typeof of any other thrown value. */
function errorTypeOf(err: unknown): string {
  return err instanceof Error ? err.name : typeof err
}

/** Report an error type to an optional listener; a listener that throws is ignored. */
function reportErrorType(onError: ResolveTaskPromptInput['onError'], errorType: string): void {
  try {
    onError?.(errorType)
  } catch {
    // The listener is best-effort (logging); it must never break prompt assembly.
  }
}

/** Fetch the decision block; any throw, rejection or non-string result yields "" and is reported. */
async function fetchDecisionBlockOrEmpty(input: ResolveTaskPromptInput): Promise<string> {
  try {
    const block: unknown = await input.fetchDecisionBlock(input.repoName, input.taskCategory)
    if (typeof block !== 'string') throw new TypeError('decision block is not a string')
    return block
  } catch (err) {
    reportErrorType(input.onError, errorTypeOf(err))
    return ''
  }
}

/** Assemble the prompt of an orchestrated task with its shared-brain decision block; never throws. */
export async function resolveTaskPrompt(input: ResolveTaskPromptInput): Promise<string> {
  const decisionBlock = await fetchDecisionBlockOrEmpty(input)
  return composeTaskPrompt({ ...input.parts, decisionBlock })
}
