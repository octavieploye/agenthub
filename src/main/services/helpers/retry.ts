export const BACKOFF_SCHEDULE_MS = [10_000, 20_000, 40_000, 60_000]
export const MAX_ATTEMPTS = 5

export interface RetryResult<T> {
  success: boolean
  data?: T
  attempts: number
  lastError?: Error
}

export interface RetryOptions {
  maxAttempts?: number
  backoffSchedule?: number[]
  onRetry?: (attempt: number, error: Error) => void
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  options?: RetryOptions
): Promise<RetryResult<T>> {
  const maxAttempts = options?.maxAttempts ?? MAX_ATTEMPTS
  const schedule = options?.backoffSchedule ?? BACKOFF_SCHEDULE_MS

  let lastError: Error | undefined

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const data = await fn()
      return { success: true, data, attempts: attempt }
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err))

      if (attempt >= maxAttempts) {
        break
      }

      if (options?.onRetry) {
        options.onRetry(attempt, lastError)
      }

      const waitMs = schedule[attempt - 1] ?? schedule[schedule.length - 1] ?? 10_000
      await delay(waitMs)
    }
  }

  return { success: false, attempts: maxAttempts, lastError }
}
