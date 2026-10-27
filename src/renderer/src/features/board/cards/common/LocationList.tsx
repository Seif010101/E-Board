import { useTranslation } from 'react-i18next'
import { ExternalLink, MapPin } from 'lucide-react'
import type { GeoLocation } from '@shared/types'
import { copyCoords, formatCoords, formatCoordsShort, openInMaps } from './actions'

interface LocationListProps {
  locations: GeoLocation[]
  /** Rows shown before collapsing the rest into "+N more". */
  max?: number
}

/** Saved places as links: click copies "lat, lng" for Google Maps, the arrow opens it there. */
export function LocationList({ locations, max = 4 }: LocationListProps) {
  const { t } = useTranslation()
  const hidden = locations.length - max
  return (
    <ul className="cd-locs">
      {locations.slice(0, max).map((loc) => (
        <li key={loc.id} className="cd-locs__row">
          <button
            type="button"
            className="cd-locs__copy"
            onClick={() => void copyCoords(loc)}
            aria-label={t('cards.copy_coords', { label: loc.label })}
            title={loc.address ? `${loc.address}\n${formatCoords(loc.lat, loc.lng)}` : formatCoords(loc.lat, loc.lng)}
          >
            <MapPin size={13} aria-hidden="true" className="cd-locs__icon" />
            <span className="cd-locs__label">{loc.label}</span>
            <span className="cd-locs__coords" dir="ltr">
              {formatCoordsShort(loc.lat, loc.lng)}
            </span>
          </button>
          <button
            type="button"
            className="cd-icon-btn"
            onClick={() => void openInMaps(loc)}
            aria-label={t('cards.open_in_maps', { label: loc.label })}
            title={t('cards.open_in_maps', { label: loc.label })}
          >
            <ExternalLink size={12} aria-hidden="true" />
          </button>
        </li>
      ))}
      {hidden > 0 && <li className="cd-more-count">{t('cards.more_count', { count: hidden })}</li>}
    </ul>
  )
}
