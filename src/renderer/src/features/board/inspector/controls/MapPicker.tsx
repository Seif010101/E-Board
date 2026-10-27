// Map dialog for dropping and naming a location pin (OpenStreetMap tiles via react-leaflet).
// The pin, the latitude / longitude inputs and the "paste coordinates" box stay in sync, and
// coordinates keep their full precision so they paste back into Google Maps exactly.

import { useEffect, useId, useMemo, useState, type ClipboardEvent, type KeyboardEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { AttributionControl, MapContainer, Marker, TileLayer, useMap, useMapEvents } from 'react-leaflet'
import { divIcon, type LeafletEventHandlerFnMap, type Marker as LeafletMarker } from 'leaflet'
import 'leaflet/dist/leaflet.css'
import './MapPicker.css'
import { ClipboardPaste, MapPin, MousePointerClick } from 'lucide-react'
import type { GeoLocation } from '@shared/types'
import { cleanLine } from '@shared/validation'
import { newId } from '@renderer/lib/api'
import { formatCoords } from '../../cards/common/actions'
import { DrawerModal } from './Dialog'
import { FieldShell } from './FieldShell'
import { filters, plainText } from './inputRules'
import { latError, lngError, parseCoordinates, parseLat, parseLng, wrapLng, type LatLng } from './coords'

const TILE_URL = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png'
const ATTRIBUTION = '© OpenStreetMap contributors'
const WORLD_CENTER: [number, number] = [22, 30]
const WORLD_ZOOM = 2
const PIN_ZOOM = 16
const LABEL_MAX = 80
const ADDRESS_MAX = 300
const COORD_MAX = 24
const LABEL_SUGGESTIONS = ['home', 'office', 'work', 'meeting_point', 'last_seen', 'hideout'] as const

// Drawn entirely in CSS (see .insp-map-pin) so no marker image paths are involved.
const PIN_ICON = divIcon({ className: 'insp-map-pin', html: false, iconSize: [30, 36], iconAnchor: [15, 31] })

interface MapPickerProps {
  /** Location being edited, or null to add a new one. */
  initial: GeoLocation | null
  onClose(): void
  onSave(location: GeoLocation): void
}

type FlyTarget = LatLng & { seq: number }

function ClickToPlace({ onPick }: { onPick(p: LatLng): void }) {
  useMapEvents({ click: (e) => onPick({ lat: e.latlng.lat, lng: wrapLng(e.latlng.lng) }) })
  return null
}

function FlyTo({ target }: { target: FlyTarget | null }) {
  const map = useMap()
  useEffect(() => {
    if (target) map.setView([target.lat, target.lng], Math.max(map.getZoom(), PIN_ZOOM))
  }, [map, target])
  return null
}

/** The dialog animates in, so Leaflet must re-measure once the container has its final size. */
function AutoSize() {
  const map = useMap()
  useEffect(() => {
    const ro = new ResizeObserver(() => map.invalidateSize())
    ro.observe(map.getContainer())
    return () => ro.disconnect()
  }, [map])
  return null
}

export function MapPicker({ initial, onClose, onSave }: MapPickerProps) {
  const { t } = useTranslation()
  const ids = useId()
  const [latText, setLatText] = useState(initial ? String(initial.lat) : '')
  const [lngText, setLngText] = useState(initial ? String(initial.lng) : '')
  const [label, setLabel] = useState(initial?.label ?? '')
  const [address, setAddress] = useState(initial?.address ?? '')
  const [paste, setPaste] = useState('')
  const [pasteError, setPasteError] = useState<string | null>(null)
  const [pasted, setPasted] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [fly, setFly] = useState<FlyTarget | null>(null)

  const lat = parseLat(latText)
  const lng = parseLng(lngText)
  const point: LatLng | null = lat !== null && lng !== null ? { lat, lng } : null

  const cleanLabel = cleanLine(label)
  const cleanAddress = cleanLine(address)
  const labelError =
    cleanLabel === '' ? (submitted ? 'validation.required' : null) : cleanLabel.length > LABEL_MAX ? 'validation.too_long' : plainText(cleanLabel)
  const addressError = cleanAddress.length > ADDRESS_MAX ? 'validation.too_long' : cleanAddress ? plainText(cleanAddress) : null
  // Coordinate errors show once the user typed something or tried to save.
  const latMsg = latText !== '' || submitted ? latError(latText) : null
  const lngMsg = lngText !== '' || submitted ? lngError(lngText) : null
  const pointMissing = submitted && latText === '' && lngText === ''

  const place = (p: LatLng, recenter: boolean) => {
    setLatText(String(p.lat))
    setLngText(String(p.lng))
    setPasted(false)
    if (recenter) setFly({ ...p, seq: (fly?.seq ?? 0) + 1 })
  }

  const recenterOnTyped = () => {
    if (point) setFly({ ...point, seq: (fly?.seq ?? 0) + 1 })
  }

  const applyPaste = (text: string) => {
    if (cleanLine(text) === '') return
    const p = parseCoordinates(text)
    if (!p) {
      setPasteError('map.paste_invalid')
      return
    }
    place(p, true)
    setPaste('')
    setPasteError(null)
    setPasted(true)
  }

  const onPasteInput = (e: ClipboardEvent<HTMLInputElement>) => {
    const text = e.clipboardData.getData('text')
    if (!parseCoordinates(text)) return
    e.preventDefault()
    applyPaste(text)
  }

  const onEnter = (fn: () => void) => (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.nativeEvent.isComposing) {
      e.preventDefault()
      fn()
    }
  }

  const save = () => {
    setSubmitted(true)
    if (!point || cleanLabel === '' || labelError || addressError) return
    onSave({ id: initial?.id ?? newId(), label: cleanLabel, lat: point.lat, lng: point.lng, address: cleanAddress })
  }

  const markerEvents = useMemo<LeafletEventHandlerFnMap>(
    () => ({
      dragend: (e) => {
        const ll = (e.target as LeafletMarker).getLatLng()
        setLatText(String(ll.lat))
        setLngText(String(wrapLng(ll.lng)))
        setPasted(false)
      }
    }),
    []
  )

  return (
    <DrawerModal
      open
      title={initial ? t('map.edit_title') : t('map.add_title')}
      onClose={onClose}
      width={720}
      footer={
        <>
          <span className="insp-map__readout" dir="ltr" aria-live="polite">
            {point ? formatCoords(point.lat, point.lng) : ''}
          </span>
          <button type="button" className="btn" onClick={onClose}>
            {t('common.cancel')}
          </button>
          <button type="button" className="btn btn--primary" onClick={save}>
            {t('common.done')}
          </button>
        </>
      }
    >
      <div className="insp-map">
        <FieldShell
          label={t('map.paste_label')}
          htmlFor={`${ids}-paste`}
          error={pasteError ? t(pasteError) : null}
          hint={pasted ? t('map.paste_applied') : t('map.paste_hint')}
          messageId={`${ids}-paste-msg`}
        >
          <div className="insp-addrow__main">
            <input
              id={`${ids}-paste`}
              className="input insp-input--ltr"
              dir="ltr"
              value={paste}
              maxLength={4096}
              spellCheck={false}
              autoComplete="off"
              placeholder="25.114542313280626, 55.13366881944347"
              aria-invalid={pasteError ? true : undefined}
              aria-describedby={`${ids}-paste-msg`}
              onChange={(e) => {
                setPaste(e.target.value)
                setPasteError(null)
              }}
              onPaste={onPasteInput}
              onKeyDown={onEnter(() => applyPaste(paste))}
            />
            <button type="button" className="btn" onClick={() => applyPaste(paste)} disabled={cleanLine(paste) === ''}>
              <ClipboardPaste size={15} aria-hidden="true" />
              {t('map.apply')}
            </button>
          </div>
        </FieldShell>

        <div
          className={`insp-map__frame${pointMissing ? ' is-invalid' : ''}`}
          dir="ltr"
          role="group"
          aria-label={t('map.map_label')}
        >
          <MapContainer
            className="insp-map__canvas"
            center={initial ? [initial.lat, initial.lng] : WORLD_CENTER}
            zoom={initial ? PIN_ZOOM : WORLD_ZOOM}
            minZoom={2}
            maxZoom={19}
            worldCopyJump
            attributionControl={false}
          >
            <TileLayer url={TILE_URL} attribution={ATTRIBUTION} maxZoom={19} />
            <AttributionControl position="bottomright" prefix={false} />
            <ClickToPlace onPick={(p) => place(p, false)} />
            <FlyTo target={fly} />
            <AutoSize />
            {point && (
              <Marker
                position={[point.lat, point.lng]}
                icon={PIN_ICON}
                draggable
                keyboard={false}
                eventHandlers={markerEvents}
                title={cleanLabel || t('map.pin')}
              />
            )}
          </MapContainer>
          {!point && (
            <div className="insp-map__overlay" aria-hidden="true">
              <MousePointerClick size={16} />
              {t('map.click_hint')}
            </div>
          )}
        </div>
        {pointMissing ? (
          <div className="field__error insp-map__msg" role="alert">
            {t('map.point_required')}
          </div>
        ) : (
          <div className="field__hint insp-map__msg">{t('map.drag_hint')}</div>
        )}

        <div className="insp-row">
          <FieldShell
            label={t('map.latitude')}
            htmlFor={`${ids}-lat`}
            required
            error={latMsg ? t(latMsg) : null}
            messageId={`${ids}-lat-msg`}
          >
            <input
              id={`${ids}-lat`}
              className="input insp-input--ltr"
              dir="ltr"
              inputMode="decimal"
              value={latText}
              maxLength={COORD_MAX}
              placeholder="25.114542"
              autoComplete="off"
              aria-required
              aria-invalid={latMsg ? true : undefined}
              aria-describedby={latMsg ? `${ids}-lat-msg` : undefined}
              onChange={(e) => {
                setLatText(filters.decimal(e.target.value))
                setPasted(false)
              }}
              onBlur={recenterOnTyped}
              onKeyDown={onEnter(recenterOnTyped)}
            />
          </FieldShell>
          <FieldShell
            label={t('map.longitude')}
            htmlFor={`${ids}-lng`}
            required
            error={lngMsg ? t(lngMsg) : null}
            messageId={`${ids}-lng-msg`}
          >
            <input
              id={`${ids}-lng`}
              className="input insp-input--ltr"
              dir="ltr"
              inputMode="decimal"
              value={lngText}
              maxLength={COORD_MAX}
              placeholder="55.133669"
              autoComplete="off"
              aria-required
              aria-invalid={lngMsg ? true : undefined}
              aria-describedby={lngMsg ? `${ids}-lng-msg` : undefined}
              onChange={(e) => {
                setLngText(filters.decimal(e.target.value))
                setPasted(false)
              }}
              onBlur={recenterOnTyped}
              onKeyDown={onEnter(recenterOnTyped)}
            />
          </FieldShell>
        </div>

        <FieldShell
          label={t('map.label')}
          htmlFor={`${ids}-label`}
          required
          error={labelError ? t(labelError) : null}
          messageId={`${ids}-label-msg`}
        >
          <input
            id={`${ids}-label`}
            className="input"
            value={label}
            maxLength={LABEL_MAX}
            placeholder={t('map.label_placeholder')}
            autoComplete="off"
            aria-required
            aria-invalid={labelError ? true : undefined}
            aria-describedby={labelError ? `${ids}-label-msg` : undefined}
            onChange={(e) => setLabel(e.target.value)}
            onKeyDown={onEnter(save)}
          />
          <div className="insp-map__suggest" role="group" aria-label={t('map.suggestions')}>
            {LABEL_SUGGESTIONS.map((key) => {
              const text = t(`map.suggest.${key}`)
              return (
                <button
                  key={key}
                  type="button"
                  className={`insp-suggest${cleanLabel === text ? ' is-active' : ''}`}
                  aria-pressed={cleanLabel === text}
                  onClick={() => setLabel(text)}
                >
                  <MapPin size={12} aria-hidden="true" />
                  {text}
                </button>
              )
            })}
          </div>
        </FieldShell>

        <FieldShell
          label={t('map.address')}
          htmlFor={`${ids}-address`}
          error={addressError ? t(addressError) : null}
          hint={t('common.optional')}
          messageId={`${ids}-address-msg`}
        >
          <input
            id={`${ids}-address`}
            className="input"
            value={address}
            maxLength={ADDRESS_MAX}
            placeholder={t('map.address_placeholder')}
            autoComplete="off"
            aria-invalid={addressError ? true : undefined}
            aria-describedby={`${ids}-address-msg`}
            onChange={(e) => setAddress(e.target.value)}
            onKeyDown={onEnter(save)}
          />
        </FieldShell>
      </div>
    </DrawerModal>
  )
}
