import { useTranslation } from 'react-i18next'
import type { ItemComponentProps } from '../../core/registry'
import { Pin } from '../common/Pin'
import { CardMedia } from '../common/CardMedia'
import '../common/cards.css'
import './image.css'

/** A pinned photo: polaroid (detective), rounded photo card (normal) or framed capture (hacker). */
export function ImageCard({ item }: ItemComponentProps<'image'>) {
  const { t } = useTranslation()
  const { mediaId, caption } = item.data
  return (
    <figure className="cd-card cd-image" aria-label={caption || t('cards.image')}>
      <Pin />
      <div className="cd-image__photo">
        <CardMedia mediaId={mediaId} alt={caption || t('cards.media_alt')} />
      </div>
      <figcaption className="cd-image__caption">
        {caption ? (
          <bdi className="cd-image__text">{caption}</bdi>
        ) : (
          // Terminal-style file name, only shown by the hacker theme when there is no caption.
          <span className="cd-image__file" dir="ltr" aria-hidden="true">
            {`IMG_${item.id.replace(/-/g, '').slice(0, 8).toUpperCase()}`}
          </span>
        )}
      </figcaption>
    </figure>
  )
}
