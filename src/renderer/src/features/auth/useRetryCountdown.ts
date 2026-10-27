import { useCallback, useEffect, useState } from 'react'

export interface RetryCountdown {
  /** Whole seconds left before another attempt is allowed; 0 when not rate limited. */
  seconds: number
  start(ms: number): void
}

/** Live countdown driven by a `rate_limited` response's `retryAfterMs`. */
export function useRetryCountdown(): RetryCountdown {
  const [until, setUntil] = useState(0)
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    if (until <= Date.now()) return
    const id = window.setInterval(() => {
      const t = Date.now()
      setNow(t)
      if (t >= until) window.clearInterval(id)
    }, 250)
    return () => window.clearInterval(id)
  }, [until])

  const start = useCallback((ms: number) => {
    const t = Date.now()
    setNow(t)
    setUntil(t + Math.max(1000, ms))
  }, [])

  return { seconds: Math.max(0, Math.ceil((until - now) / 1000)), start }
}
