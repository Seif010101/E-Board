import type { CSSProperties } from 'react'
import { useTranslation } from 'react-i18next'
import { ExternalLink } from 'lucide-react'
import type { SocialAccount } from '@shared/types'
import { isHttpUrl } from '@shared/validation'
import { BrandIcon } from './BrandIcon'
import { BRANDS, groupSocials } from './brands'
import { copyText, openExternal } from './actions'

/**
 * The accounts that were added, one brand-coloured row each (click copies the handle, the arrow
 * opens the profile URL). Platforms without an account are not listed at all.
 */
export function SocialList({ socials }: { socials: SocialAccount[] }) {
  const { t } = useTranslation()
  const { lit } = groupSocials(socials)
  if (lit.length === 0) return null
  return (
    <ul className="cd-social" aria-label={t('cards.social_media')}>
      {lit.map((account, i) => (
        <LitRow key={`${account.platform}:${i}`} account={account} />
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
