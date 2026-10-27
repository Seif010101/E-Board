import { useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { ImageOff } from 'lucide-react'
import { mediaUrl, type Id } from '@shared/types'

interface CardMediaProps {
  mediaId: Id
  alt: string
  className?: string
  /** Rendered instead of the image when it cannot be loaded (missing or deleted media). */
  fallback?: ReactNode
}

/** An image from the media store (eboard-media://); main validated it as PNG/JPEG on import. */
export function CardMedia({ mediaId, alt, className, fallback }: CardMediaProps) {
  const { t } = useTranslation()
  // Keyed by id so replacing a broken image retries the new one.
  const [failedId, setFailedId] = useState<Id | null>(null)

  if (failedId === mediaId) {
    return (
      fallback ?? (
        <span className="cd-media-missing" role="img" aria-label={t('cards.image_unavailable')}>
          <ImageOff size={22} aria-hidden="true" />
        </span>
      )
    )
  }
  return (
    <img
      className={className}
      src={mediaUrl(mediaId)}
      alt={alt}
      draggable={false}
      decoding="async"
      onError={() => setFailedId(mediaId)}
    />
  )
}
