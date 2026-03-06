import { useState, useEffect } from 'react'

/**
 * Returns Date.now() and re-renders at the given interval.
 * Pass 0 to disable ticking (returns a static snapshot).
 */
export function useNow(intervalMs: number): number {
  const [now, setNow] = useState(Date.now())

  useEffect(() => {
    if (intervalMs <= 0) return
    const id = setInterval(() => setNow(Date.now()), intervalMs)
    return () => clearInterval(id)
  }, [intervalMs])

  return now
}
