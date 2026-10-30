// How much each piece of information is trusted (0-100). Stored on the card as a map keyed by the
// field ("fullName") or by the list entry ("phones:+971581234567"); a field without an entry is unrated.

import { createContext, useContext } from 'react'

export interface CertaintyBinding {
  value: number | undefined
  onChange(value: number): void
}

/** Key of a list entry: the value itself identifies it, so reordering or removing others is safe. */
export const entryKey = (list: string, value: string): string => `${list}:${value}`

/** Reads a card's map; cards saved before ratings existed have none. */
export const certaintyMap = (data: { certainty?: Record<string, number> }): Record<string, number> => data.certainty ?? {}

/** Provided by each card form; lets any field below it show a rating bar with just a key. */
export const CertaintyContext = createContext<((key: string) => CertaintyBinding) | null>(null)

/** Binding for `key`, or undefined outside a card form. */
export function useCertainty(key: string | undefined): CertaintyBinding | undefined {
  const bind = useContext(CertaintyContext)
  return key && bind ? bind(key) : undefined
}

/** For list editors that rate each entry: a function from entry key to binding. */
export const useCertaintyFor = (): ((key: string) => CertaintyBinding) | null => useContext(CertaintyContext)
