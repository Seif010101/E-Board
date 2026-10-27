import { useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ApiError, errorMessage } from '@renderer/lib/api'
import { useRetryCountdown } from './useRetryCountdown'

export interface FormRequest {
  pending: boolean
  /** True while pending or rate limited: submit buttons should be disabled. */
  blocked: boolean
  retrySeconds: number
  /** Form-level message, including the live rate-limit countdown. */
  alert: string | null
  setError(message: string | null): void
  /**
   * Runs one request at a time. Rate limiting starts the countdown; `onError` may handle any
   * other failure itself by returning true, otherwise its translated message is shown.
   * Resolves to whether the task succeeded.
   */
  run(task: () => Promise<void>, onError?: (err: unknown) => boolean): Promise<boolean>
}

export function useFormRequest(): FormRequest {
  const { t } = useTranslation()
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const retry = useRetryCountdown()
  const busy = useRef(false)

  const run = async (task: () => Promise<void>, onError?: (err: unknown) => boolean): Promise<boolean> => {
    if (busy.current || retry.seconds > 0) return false
    busy.current = true
    setPending(true)
    setError(null)
    try {
      await task()
      return true
    } catch (err) {
      if (err instanceof ApiError && err.code === 'rate_limited') retry.start(err.retryAfterMs ?? 30_000)
      else if (!onError?.(err)) setError(errorMessage(t, err))
      return false
    } finally {
      busy.current = false
      setPending(false)
    }
  }

  return {
    pending,
    blocked: pending || retry.seconds > 0,
    retrySeconds: retry.seconds,
    alert: retry.seconds > 0 ? t('errors.rate_limited', { seconds: retry.seconds }) : error,
    setError,
    run
  }
}

/** True when the main process rejected a password re-confirmation. */
export const isWrongPassword = (err: unknown): boolean => err instanceof ApiError && err.code === 'invalid_credentials'
