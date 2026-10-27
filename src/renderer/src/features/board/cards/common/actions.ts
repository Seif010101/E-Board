// Clipboard / external-link helpers shared by card faces and the inspector.

import type { GeoLocation, Id } from '@shared/types'
import i18n from '@renderer/i18n'
import { api, call, errorMessage } from '@renderer/lib/api'
import { toast } from '@renderer/components/ui/toast'
import { board } from '../../core/store'

export async function copyText(text: string, message?: string): Promise<void> {
  try {
    await call(api.system.copyText({ text }))
    toast.success(message ?? i18n.t('common.copied'))
  } catch (err) {
    toast.error(errorMessage(i18n.t, err))
  }
}

export async function openExternal(url: string): Promise<void> {
  try {
    await call(api.system.openExternal({ url }))
  } catch (err) {
    toast.error(errorMessage(i18n.t, err))
  }
}

/** Full-precision "lat, lng", the format Google Maps accepts in its search box. */
export const formatCoords = (lat: number, lng: number): string => `${lat}, ${lng}`

export const formatCoordsShort = (lat: number, lng: number): string => `${lat.toFixed(6)}, ${lng.toFixed(6)}`

export const mapsUrl = (lat: number, lng: number): string => `https://www.google.com/maps?q=${lat},${lng}`

export const copyCoords = (loc: GeoLocation): Promise<void> =>
  copyText(formatCoords(loc.lat, loc.lng), i18n.t('cards.copied_coords'))

export const openInMaps = (loc: GeoLocation): Promise<void> => openExternal(mapsUrl(loc.lat, loc.lng))

/** Hostname for display, or the raw value if it does not parse. */
export const displayHost = (url: string): string => {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return url
  }
}

/** Double-click on a card face: open its details drawer. */
export const openDetails = (item: { id: Id }): void => board().openInspector({ kind: 'item', id: item.id })
