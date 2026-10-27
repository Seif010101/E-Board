// Image card details: the picture (replace / view full size / fit the card to it) and its caption.

import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Expand, ImageIcon, Info, Ratio } from 'lucide-react'
import { mediaUrl, type ItemOfType, type MediaRef } from '@shared/types'
import { board } from '../../core/store'
import { MediaField } from '../controls/MediaField'
import { DrawerModal } from '../controls/Dialog'
import { Section } from '../controls/Section'
import { TextField } from '../controls/TextField'
import { plainLine, RelationshipsSection } from './shared'

const CAPTION_MAX = 200
/** Strip under the picture that holds the caption (same convention as images dropped on the board). */
const CAPTION_HEIGHT = 40

const clampAspect = (h: number, w: number): number => (w > 0 ? Math.min(2.5, Math.max(0.25, h / w)) : 1)

/** Card height that shows a picture of the given natural size at the card's current width. */
const fittedHeight = (cardW: number, size: { w: number; h: number }): number =>
  Math.round(cardW * clampAspect(size.h, size.w)) + CAPTION_HEIGHT

export function ImageForm({ item }: { item: ItemOfType<'image'> }) {
  const { t } = useTranslation()
  const d = item.data
  const [natural, setNatural] = useState<{ id: string; w: number; h: number } | null>(null)
  const [viewing, setViewing] = useState(false)
  const size = natural && natural.id === d.mediaId ? natural : null
  const fitted = size ? fittedHeight(item.w, size) : null
  const needsFit = fitted !== null && Math.abs(fitted - item.h) > 2

  // A new picture keeps the card width and takes its proportions, in the same undo step.
  const replace = (mediaId: string | null, ref?: MediaRef) => {
    if (!mediaId) return
    const h = ref ? fittedHeight(item.w, { w: ref.width, h: ref.height }) : item.h
    board().updateItem<'image'>(item.id, { h, data: { mediaId } })
  }

  return (
    <div className="insp-form">
      <Section id="image.picture" title={t('inspector.section.picture')} icon={ImageIcon}>
        <MediaField
          label={t('inspector.image.picture')}
          mediaId={d.mediaId}
          onChange={replace}
          variant="photo"
          removable={false}
          onMeasured={(s) => setNatural({ id: d.mediaId, ...s })}
        />
        <TextField
          label={t('inspector.image.caption')}
          value={d.caption}
          onCommit={(caption) => board().updateItem<'image'>(item.id, { data: { caption } })}
          validate={plainLine(CAPTION_MAX)}
          maxLength={CAPTION_MAX}
          live
          placeholder={t('inspector.image.caption_placeholder')}
          hint={t('inspector.image.caption_hint')}
        />
      </Section>

      <Section id="image.details" title={t('inspector.section.image_details')} icon={Info}>
        <dl className="insp-facts">
          <div className="insp-facts__row">
            <dt>{t('inspector.image.dimensions')}</dt>
            <dd dir="ltr">{size ? t('inspector.image.pixels', { w: size.w, h: size.h }) : '—'}</dd>
          </div>
          <div className="insp-facts__row">
            <dt>{t('inspector.image.card_size')}</dt>
            <dd dir="ltr">{t('inspector.image.pixels', { w: Math.round(item.w), h: Math.round(item.h) })}</dd>
          </div>
        </dl>
        <div className="insp-actions">
          <button type="button" className="btn btn--sm" onClick={() => setViewing(true)}>
            <Expand size={14} aria-hidden="true" />
            {t('inspector.image.view')}
          </button>
          <button
            type="button"
            className="btn btn--sm"
            disabled={!needsFit}
            onClick={() => fitted !== null && board().updateItem<'image'>(item.id, { h: fitted })}
            title={needsFit ? t('inspector.image.fit_hint') : t('inspector.image.fitted')}
          >
            <Ratio size={14} aria-hidden="true" />
            {t('inspector.image.fit')}
          </button>
        </div>
      </Section>

      <RelationshipsSection scope="image" item={item} />

      {viewing && (
        <DrawerModal open title={d.caption || t('inspector.image.view_title')} onClose={() => setViewing(false)} width={960}>
          <div className="insp-lightbox">
            <img src={mediaUrl(d.mediaId)} alt={d.caption || t('inspector.image.view_title')} draggable={false} />
          </div>
        </DrawerModal>
      )}
    </div>
  )
}
