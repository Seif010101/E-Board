import { useState, type DragEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { Building2, ImagePlus, ImageOff, RefreshCw, Trash2, UserRound } from 'lucide-react'
import { mediaUrl, type Id, type MediaRef } from '@shared/types'
import { cleanLine } from '@shared/validation'
import { api, call, errorMessage } from '@renderer/lib/api'
import { toast } from '@renderer/components/ui/toast'

const ACCEPTED = ['image/png', 'image/jpeg']
const MAX_BYTES = 15 * 1024 * 1024

interface MediaFieldProps {
  label: string
  mediaId: Id | null
  /** `ref` describes the newly stored picture (absent when it was removed). */
  onChange(id: Id | null, ref?: MediaRef): void
  /** Preview shape: round for people, square for logos, wide for photos. */
  variant: 'avatar' | 'logo' | 'photo'
  /** Image cards always need a picture, so they can only replace it. */
  removable?: boolean
  /** Reports the natural size of the loaded picture. */
  onMeasured?(size: { w: number; h: number }): void
}

/**
 * Picture picker. Files come either from the native dialog (main restricts it to PNG/JPEG) or from
 * drag & drop; in both cases the main process checks the bytes before storing anything.
 */
export function MediaField({ label, mediaId, onChange, variant, removable = true, onMeasured }: MediaFieldProps) {
  const { t } = useTranslation()
  const [busy, setBusy] = useState(false)
  const [over, setOver] = useState(false)
  const [broken, setBroken] = useState<Id | null>(null)

  const run = async (task: () => Promise<MediaRef | null>) => {
    if (busy) return
    setBusy(true)
    try {
      const ref = await task()
      if (ref) {
        setBroken(null)
        onChange(ref.id, ref)
      }
    } catch (err) {
      toast.error(errorMessage(t, err))
    } finally {
      setBusy(false)
    }
  }

  const pick = () => void run(() => call(api.media.pickImage()))

  const hasFiles = (e: DragEvent) => Array.from(e.dataTransfer.types).includes('Files')

  const onDrop = (e: DragEvent<HTMLDivElement>) => {
    if (!hasFiles(e)) return
    e.preventDefault()
    e.stopPropagation()
    setOver(false)
    const file = e.dataTransfer.files[0]
    if (!file) return
    if (!ACCEPTED.includes(file.type)) {
      toast.error(t('errors.invalid_file'))
      return
    }
    if (file.size > MAX_BYTES) {
      toast.error(t('errors.file_too_large'))
      return
    }
    void run(async () => {
      const bytes = new Uint8Array(await file.arrayBuffer())
      const name = cleanLine(file.name).slice(0, 255) || 'image'
      return call(api.media.importImageBytes({ name, bytes }))
    })
  }

  const Placeholder = variant === 'avatar' ? UserRound : variant === 'logo' ? Building2 : ImagePlus
  const isBroken = mediaId !== null && broken === mediaId

  return (
    <div
      className={`insp-media insp-media--${variant}${over ? ' is-over' : ''}`}
      onDragOver={(e) => {
        if (!hasFiles(e)) return
        e.preventDefault()
        e.dataTransfer.dropEffect = 'copy'
        setOver(true)
      }}
      onDragLeave={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setOver(false)
      }}
      onDrop={onDrop}
    >
      <button
        type="button"
        className="insp-media__preview"
        onClick={pick}
        disabled={busy}
        aria-label={mediaId ? t('inspector.media.replace_named', { name: label }) : t('inspector.media.upload_named', { name: label })}
      >
        {mediaId && !isBroken ? (
          <img
            src={mediaUrl(mediaId)}
            alt=""
            draggable={false}
            onError={() => setBroken(mediaId)}
            onLoad={(e) => onMeasured?.({ w: e.currentTarget.naturalWidth, h: e.currentTarget.naturalHeight })}
          />
        ) : isBroken ? (
          <ImageOff size={26} aria-hidden="true" />
        ) : (
          <Placeholder size={variant === 'photo' ? 30 : 34} aria-hidden="true" />
        )}
        {busy && (
          <span className="insp-media__busy">
            <span className="spinner" />
          </span>
        )}
      </button>
      <div className="insp-media__side">
        <div className="insp-media__label">{label}</div>
        <div className="insp-media__hint">{isBroken ? t('inspector.media.missing') : t('inspector.media.hint')}</div>
        <div className="insp-media__actions">
          <button type="button" className="btn btn--sm" onClick={pick} disabled={busy}>
            {mediaId ? <RefreshCw size={14} aria-hidden="true" /> : <ImagePlus size={14} aria-hidden="true" />}
            {mediaId ? t('inspector.media.replace') : t('inspector.media.upload')}
          </button>
          {removable && mediaId && (
            <button
              type="button"
              className="btn btn--sm btn--ghost insp-danger-hover"
              onClick={() => onChange(null)}
              disabled={busy}
            >
              <Trash2 size={14} aria-hidden="true" />
              {t('common.remove')}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
