export interface CodexCommandOptions {
  task?: string
  skipPermissions?: boolean
  telegramNotify?: boolean
}

export function buildCodexCommand(options: CodexCommandOptions): string {
  const { task, skipPermissions, telegramNotify } = options
  const fullAutoFlag = skipPermissions ? ' --full-auto' : ''

  if (task) {
    const telegramSuffix = telegramNotify
      ? '\n\nTelegram is ON — communicate via send_telegram only. Do NOT write status updates or summaries to the terminal. Keep terminal output to essential work artifacts only (code, diffs, errors). When done, send_telegram a short bullet-point summary. If you need approval or have a question, also send_telegram.'
      : ''
    const escapedTask = (task + telegramSuffix).replace(/'/g, "'\\''")
    return `clear; codex${fullAutoFlag} -- '${escapedTask}'\n`
  }

  return `clear; codex${fullAutoFlag}\n`
}
