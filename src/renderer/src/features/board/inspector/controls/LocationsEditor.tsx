import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Copy, ExternalLink, MapPin, Pencil, Plus, X } from 'lucide-react'
import type { GeoLocation } from '@shared/types'
import { LIMITS } from '@shared/validation'
import { copyCoords, formatCoords, formatCoordsShort, openInMaps } from '../../cards/common/actions'
import { MapPicker } from './MapPicker'

interface LocationsEditorProps {
  locations: GeoLocation[]
  onChange(locations: GeoLocation[]): void
}

/**
 * Saved places of a card. Each one is a link-style chip: clicking it copies the full-precision
 * "lat, lng" (which Google Maps accepts in its search box); the side buttons open it in Google Maps,
 * re-open the map picker or remove it.
 */
export function LocationsEditor({ locations, onChange }: LocationsEditorProps) {
  const { t } = useTranslation()
  const [editing, setEditing] = useState<GeoLocation | 'new' | null>(null)
  const full = locations.length >= LIMITS.locations

  const save = (loc: GeoLocation) => {
    if (editing === 'new') onChange([...locations, loc])
    else onChange(locations.map((l) => (l.id === loc.id ? loc : l)))
    setEditing(null)
  }

  return (
    <div className="insp-locs">
      {locations.length === 0 ? (
        <p className="insp-empty">{t('map.empty')}</p>
      ) : (
        <ul className="insp-locs__list" role="list">
          {locations.map((loc) => (
            <li key={loc.id} className="insp-loc">
              <button
                type="button"
                className="insp-loc__link"
                onClick={() => void copyCoords(loc)}
                title={`${formatCoords(loc.lat, loc.lng)}\n${t('map.copy_hint')}`}
                aria-label={t('map.copy_aria', { label: loc.label })}
              >
                <MapPin size={15} className="insp-loc__pin" aria-hidden="true" />
                <span className="insp-loc__text">
                  <span className="insp-loc__label">{loc.label}</span>
                  <span className="insp-loc__coords" dir="ltr">
                    {formatCoordsShort(loc.lat, loc.lng)}
                  </span>
                  {loc.address && <span className="insp-loc__address">{loc.address}</span>}
                </span>
                <Copy size={13} className="insp-loc__copy" aria-hidden="true" />
              </button>
              <div className="insp-loc__actions">
                <button
                  type="button"
                  className="icon-btn icon-btn--sm"
                  onClick={() => void openInMaps(loc)}
                  aria-label={t('map.open_aria', { label: loc.label })}
                  title={t('map.open')}
                >
                  <ExternalLink size={14} />
                </button>
                <button
                  type="button"
                  className="icon-btn icon-btn--sm"
                  onClick={() => setEditing(loc)}
                  aria-label={t('map.edit_aria', { label: loc.label })}
                  title={t('common.edit')}
                >
                  <Pencil size={14} />
                </button>
                <button
                  type="button"
                  className="icon-btn icon-btn--sm insp-danger-hover"
                  onClick={() => onChange(locations.filter((l) => l.id !== loc.id))}
                  aria-label={t('inspector.remove_item', { name: loc.label })}
                  title={t('common.remove')}
                >
                  <X size={14} />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
      {full ? (
        <div className="field__hint">{t('inspector.limit_reached', { max: LIMITS.locations })}</div>
      ) : (
        <button type="button" className="insp-addbtn" onClick={() => setEditing('new')}>
          <Plus size={15} aria-hidden="true" />
          {t('map.add')}
        </button>
      )}
      {editing && (
        <MapPicker initial={editing === 'new' ? null : editing} onClose={() => setEditing(null)} onSave={save} />
      )}
    </div>
  )
}
