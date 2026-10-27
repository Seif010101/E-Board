import type { TFunction } from 'i18next'
import type { EBoardApi, ErrorCode, Result } from '@shared/api'

export const api: EBoardApi = window.api

export class ApiError extends Error {
  constructor(
    public code: ErrorCode,
    public details: string[] = [],
    public retryAfterMs?: number
  ) {
    super(code)
    this.name = 'ApiError'
  }
}

/** Unwraps a Result, throwing ApiError on failure. */
export async function call<T>(promise: Promise<Result<T>>): Promise<T> {
  let r: Result<T>
  try {
    r = await promise
  } catch {
    throw new ApiError('internal')
  }
  if (r.ok) return r.data
  throw new ApiError(r.error, r.details ?? [], r.retryAfterMs)
}

/** Human readable, translated message for any thrown error. */
export function errorMessage(t: TFunction, err: unknown): string {
  if (err instanceof ApiError) {
    const base = t(`errors.${err.code}`, { seconds: Math.ceil((err.retryAfterMs ?? 0) / 1000) })
    if (err.details.length === 0) return base
    return `${base}: ${err.details.map((d) => t(d)).join(', ')}`
  }
  return t('errors.internal')
}

export const newId = (): string => crypto.randomUUID()
