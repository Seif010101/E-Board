import { useCallback, useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'
import { ChevronLeft, ChevronRight, ImagePlus, Play, Trash2 } from 'lucide-react'
import { mediaUrl, type AlbumEntry } from '@shared/types'
import { cleanLine, LIMITS } from '@shared/validation'
import { Modal } from '@renderer/components/ui/Modal'
import { toast } from '@renderer/components/ui/toast'
import { api, call, errorMessage } from '@renderer/lib/api'
import { plainText } from './inputRules'
import './album.css'

interface Props {
  name: string
  entries: AlbumEntry[]
  onChange(entries: AlbumEntry[]): void
  onClose(): void
}

const CAPTION_MAX = 200

/** The photos and videos kept for one person: a grid, and a viewer with captions. */
export function AlbumDialog({ name, entries, onChange, onClose }: Props) {
  const { t, i18n } = useTranslation()
  const [view, setView] = useState<number | null>(null)
  const [busy, setBusy] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const rtl = i18n.dir() === 'rtl'

  const add = async () => {
    if (busy) return
    setBusy(true)
    try {
      const files = await call(api.media.pickAlbumFiles())
      const known = new Set(entries.map((e) => e.mediaId))
      const fresh = files
        .filter((f) => !known.has(f.id))
        .map((f): AlbumEntry => ({ mediaId: f.id, kind: f.mime.startsWith('video/') ? 'video' : 'image', caption: '' }))
      if (fresh.length === 0) return
      const room = LIMITS.album - entries.length
      if (fresh.length > room) toast.info(t('inspector.album.limit', { max: LIMITS.album }))
      onChange([...entries, ...fresh.slice(0, Math.max(0, room))])
    } catch (err) {
      toast.error(errorMessage(t, err))
    } finally {
      setBusy(false)
    }
  }

  const step = useCallback(
    (delta: number) => setView((i) => (i === null || entries.length === 0 ? i : (i + delta + entries.length) % entries.length)),
    [entries.length]
  )

  useEffect(() => {
    if (view === null) return
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement) return
      if (e.key === 'ArrowRight') step(rtl ? -1 : 1)
      else if (e.key === 'ArrowLeft') step(rtl ? 1 : -1)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [view, step, rtl])

  const current = view !== null ? entries[view] : undefined

  const setCaption = (caption: string) => {
    if (view === null) return
    const clean = cleanLine(caption)
    if (clean === entries[view].caption || clean.length > CAPTION_MAX || plainText(clean)) return
    onChange(entries.map((e, i) => (i === view ? { ...e, caption: clean } : e)))
  }

  const remove = () => {
    if (view === null) return
    const next = entries.filter((_, i) => i !== view)
    onChange(next)
    setConfirmDelete(false)
    setView(next.length === 0 ? null : Math.min(view, next.length - 1))
  }

  const close = () => {
    if (confirmDelete) setConfirmDelete(false)
    else if (view !== null) setView(null)
    else onClose()
  }

  return createPortal(
    <Modal
      open
      title={t('inspector.album.title', { name })}
      onClose={close}
      width={760}
      footer={
        view === null ? (
          <>
            <button type="button" className="btn" onClick={onClose}>
              {t('common.close')}
            </button>
            <button type="button" className="btn btn--primary" onClick={() => void add()} disabled={busy || entries.length >= LIMITS.album}>
              <ImagePlus size={16} aria-hidden="true" />
              {t('inspector.album.add')}
            </button>
          </>
        ) : undefined
      }
    >
      {current && view !== null ? (
        <div className="album-view">
          <div className="album-view__stage">
            <button type="button" className="icon-btn album-view__nav" onClick={() => step(-1)} aria-label={t('inspector.album.previous')}>
              <ChevronLeft size={22} className="insp-flip" />
            </button>
            {current.kind === 'video' ? (
              <video key={current.mediaId} className="album-view__media" src={mediaUrl(current.mediaId)} controls preload="metadata" />
            ) : (
              <img key={current.mediaId} className="album-view__media" src={mediaUrl(current.mediaId)} alt={current.caption} draggable={false} />
            )}
            <button type="button" className="icon-btn album-view__nav" onClick={() => step(1)} aria-label={t('inspector.album.next')}>
              <ChevronRight size={22} className="insp-flip" />
            </button>
          </div>
          <div className="album-view__bar">
            <span className="album-view__count">
              {view + 1} / {entries.length}
            </span>
            <input
              key={current.mediaId}
              className="input album-view__caption"
              defaultValue={current.caption}
              maxLength={CAPTION_MAX}
              placeholder={t('inspector.album.caption')}
              aria-label={t('inspector.album.caption')}
              onBlur={(e) => setCaption(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && !e.nativeEvent.isComposing && e.currentTarget.blur()}
            />
            {confirmDelete ? (
              <button type="button" className="btn btn--danger btn--sm" onClick={remove}>
                {t('inspector.album.confirm_delete')}
              </button>
            ) : (
              <button type="button" className="icon-btn insp-danger-hover" onClick={() => setConfirmDelete(true)} aria-label={t('inspector.album.delete')} title={t('inspector.album.delete')}>
                <Trash2 size={17} />
              </button>
            )}
            <button type="button" className="btn btn--sm" onClick={() => setView(null)}>
              {t('inspector.album.back')}
            </button>
          </div>
        </div>
      ) : entries.length === 0 ? (
        <div className="album-empty">
          <ImagePlus size={32} aria-hidden="true" />
          <p>{t('inspector.album.empty')}</p>
        </div>
      ) : (
        <ul className="album-grid" role="list">
          {entries.map((e, i) => (
            <li key={e.mediaId}>
              <button type="button" className="album-tile" onClick={() => setView(i)} aria-label={e.caption || t('inspector.album.open_item', { n: i + 1 })}>
                {e.kind === 'video' ? (
                  <>
                    <video className="album-tile__media" src={`${mediaUrl(e.mediaId)}#t=0.1`} preload="metadata" muted />
                    <span className="album-tile__play" aria-hidden="true">
                      <Play size={18} />
                    </span>
                  </>
                ) : (
                  <img className="album-tile__media" src={mediaUrl(e.mediaId)} alt="" loading="lazy" draggable={false} />
                )}
                {e.caption && <span className="album-tile__caption">{e.caption}</span>}
              </button>
            </li>
          ))}
        </ul>
      )}
    </Modal>,
    document.body
  )
}
