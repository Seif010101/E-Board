// Expected, user-facing failures. Anything else that escapes a handler is reported as 'internal'.

import type { ErrorCode } from '@shared/api'

export class AppError extends Error {
  constructor(
    public readonly code: ErrorCode,
    public readonly details?: string[],
    public readonly retryAfterMs?: number
  ) {
    super(code)
    this.name = 'AppError'
  }
}

export const fail = (code: ErrorCode, details?: string[]): never => {
  throw new AppError(code, details)
}

/** SQLite extended result codes for UNIQUE / PRIMARY KEY violations. */
const CONSTRAINT_UNIQUE = 2067
const CONSTRAINT_PRIMARYKEY = 1555

export const isUniqueViolation = (err: unknown): boolean => {
  if (!(err instanceof Error)) return false
  const code = (err as Error & { errcode?: unknown }).errcode
  return code === CONSTRAINT_UNIQUE || code === CONSTRAINT_PRIMARYKEY
}
