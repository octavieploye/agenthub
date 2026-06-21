/**
 * Returns true when the cleanTextBuffer should be reset because the user
 * has submitted a new request (\r) and the agent is confirmed locked (not
 * debounced — uses ttsStatus which updates immediately on parser transitions).
 *
 * The previous bug used managed.state.status which lags up to 4 s behind the
 * real parser state, causing the \r reset to silently fail when the user
 * typed before the 4 s debounce elapsed.
 */
export function shouldResetTtsBuffer(data: string, ttsStatus: string): boolean {
  return data.includes('\r') && ttsStatus === 'locked'
}
