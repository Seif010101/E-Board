// Board-search text built from card data.

import type { GeoLocation, SocialAccount } from '@shared/types'

type Part = string | readonly string[] | null | undefined

export const joinSearch = (...parts: Part[]): string =>
  parts
    .flat()
    .filter((p): p is string => !!p)
    .join(' ')

export const locationsText = (locations: GeoLocation[]): string[] =>
  locations.map((l) => `${l.label} ${l.address}`)

export const socialsText = (socials: SocialAccount[]): string[] => socials.map((s) => `${s.handle} ${s.url}`)
