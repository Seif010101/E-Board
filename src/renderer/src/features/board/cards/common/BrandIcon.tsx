import type { SocialPlatform } from '@shared/types'
import { BRANDS } from './brands'

interface BrandIconProps {
  platform: SocialPlatform
  size?: number
  /** Glyph colour; defaults to currentColor. */
  color?: string
  /** TikTok's cyan/red offset accent (only drawn for TikTok). */
  accent?: boolean
  className?: string
}

export function BrandIcon({ platform, size = 16, color = 'currentColor', accent = false, className }: BrandIconProps) {
  const brand = BRANDS[platform]
  const rule = brand.evenOdd ? 'evenodd' : undefined
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      className={className}
      aria-hidden="true"
      focusable="false"
      style={{ flex: 'none', overflow: 'visible' }}
    >
      {accent && platform === 'tiktok' && (
        <>
          <path d={brand.path} fill="#25F4EE" transform="translate(-1 -1)" />
          <path d={brand.path} fill="#FE2C55" transform="translate(1 1)" />
        </>
      )}
      <path d={brand.path} fill={color} fillRule={rule} clipRule={rule} />
    </svg>
  )
}
