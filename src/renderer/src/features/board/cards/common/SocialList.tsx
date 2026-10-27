import type { CSSProperties } from 'react'
import { useTranslation } from 'react-i18next'
import { ExternalLink } from 'lucide-react'
import type { SocialAccount, SocialPlatform } from '@shared/types'
import { isHttpUrl } from '@shared/validation'
import { BrandIcon } from './BrandIcon'
import { BRANDS, groupSocials } from './brands'
import { copyText, openExternal } from './actions'

/**
 * Every platform stacked vertically. Platforms where the person has an account are "lit"
 * (brand background + handle; click copies the handle, the arrow opens the profile URL),
 * the others are dimmed, compact rows.
 */
export function SocialList({ socials }: { socials: SocialAccount[] }) {
  const { t } = useTranslation()
  const { lit, dim } = groupSocials(socials)
  return (
    <ul className="cd-social" aria-label={t('cards.social_media')}>
      {lit.map((account, i) => (
        <LitRow key={`${account.platform}:${i}`} account={account} />
      ))}
      {dim.map((platform) => (
        <DimRow key={platform} platform={platform} />
      ))}
    </ul>
  )
}

function LitRow({ account }: { account: SocialAccount }) {
  const { t } = useTranslation()
  const { platform, handle, url } = account
  const brand = BRANDS[platform]
  const name = t(`social.${platform}`)
  const style = { '--cd-brand-bg': brand.bg, '--cd-brand-fg': brand.fg } as CSSProperties
  const copyLabel = t('cards.copy_handle', { platform: name, handle })
  return (
    <li className="cd-social__row is-lit" data-platform={platform} style={style}>
      <button
        type="button"
        className="cd-social__copy"
        onClick={() => void copyText(handle, t('cards.copied_handle', { handle }))}
        aria-label={copyLabel}
        title={copyLabel}
      >
        <BrandIcon platform={platform} size={15} color={brand.fg} accent={platform === 'tiktok'} />
        <span className="cd-social__handle" dir="auto">
          {handle}
        </span>
      </button>
      {url && isHttpUrl(url) && (
        <button
          type="button"
          className="cd-social__open"
          onClick={() => void openExternal(url)}
          aria-label={t('cards.open_profile', { platform: name })}
          title={t('cards.open_profile', { platform: name })}
        >
          <ExternalLink size={13} aria-hidden="true" />
        </button>
      )}
    </li>
  )
}

function DimRow({ platform }: { platform: SocialPlatform }) {
  const { t } = useTranslation()
  const name = t(`social.${platform}`)
  const label = t('cards.no_account', { platform: name })
  return (
    <li className="cd-social__row is-dim" data-platform={platform} title={label}>
      <BrandIcon platform={platform} size={12} />
      <span className="cd-social__name" aria-hidden="true">
        {name}
      </span>
      <span className="cd-sr">{label}</span>
    </li>
  )
}
