export interface CodexCommandOptions {
  task?: string
  skipPermissions?: boolean
  telegramNotify?: boolean
  model?: string
  effort?: string
}

export function buildCodexCommand(options: CodexCommandOptions): string {
  const { task, skipPermissions, telegramNotify, model, effort } = options
  const modelFlag = model ? ` -m ${model}` : ''
  const effortFlag = effort ? ` -c model_reasoning_effort=${effort}` : ''
  const fullAutoFlag = skipPermissions ? ' --full-auto' : ''

  if (task) {
    const telegramSuffix = telegramNotify
      ? '\n\nTelegram is ON — communicate via send_telegram only. Do NOT write status updates or summaries to the terminal. Keep terminal output to essential work artifacts only (code, diffs, errors). When done, send_telegram a short bullet-point summary. If you need approval or have a question, also send_telegram.'
      : ''
    const escapedTask = (task + telegramSuffix).replace(/'/g, "'\\''")
    return `clear; codex${modelFlag}${effortFlag}${fullAutoFlag} -- '${escapedTask}'\n`
  }

  return `clear; codex${modelFlag}${effortFlag}${fullAutoFlag}\n`
}
