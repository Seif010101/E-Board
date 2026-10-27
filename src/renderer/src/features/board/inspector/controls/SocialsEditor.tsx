import { useState, type CSSProperties } from 'react'
import { useTranslation } from 'react-i18next'
import { ExternalLink, Link2 } from 'lucide-react'
import { SOCIAL_PLATFORMS, type SocialAccount, type SocialPlatform } from '@shared/types'
import { LIMITS, rules } from '@shared/validation'
import { BrandIcon } from '../../cards/common/BrandIcon'
import { BRANDS } from '../../cards/common/brands'
import { openExternal } from '../../cards/common/actions'
import { socialLabel } from '../labels'
import { useDraft } from './useDraft'

/** Platforms whose accounts are usually identified by a phone number. */
const PHONE_PLATFORMS: readonly SocialPlatform[] = ['whatsapp', 'signal']

interface SocialsEditorProps {
  socials: SocialAccount[]
  onChange(socials: SocialAccount[]): void
}

/** One row per platform: a filled handle lights the platform up on the card. */
export function SocialsEditor({ socials, onChange }: SocialsEditorProps) {
  const { t } = useTranslation()

  const setHandle = (platform: SocialPlatform, handle: string) => {
    const index = socials.findIndex((s) => s.platform === platform)
    if (handle === '') {
      if (index >= 0) onChange(socials.filter((_, i) => i !== index))
    } else if (index >= 0) {
      onChange(socials.map((s, i) => (i === index ? { ...s, handle } : s)))
    } else if (socials.length < LIMITS.socials) {
      onChange([...socials, { platform, handle, url: '' }])
    }
  }

  const setUrl = (platform: SocialPlatform, url: string) => {
    onChange(socials.map((s) => (s.platform === platform ? { ...s, url } : s)))
  }

  return (
    <div className="insp-socials">
      <p className="insp-note">{t('inspector.socials.hint')}</p>
      <ul className="insp-socials__list" role="list">
        {SOCIAL_PLATFORMS.map((platform) => (
          <SocialRow
            key={platform}
            platform={platform}
            account={socials.find((s) => s.platform === platform) ?? null}
            onHandle={(h) => setHandle(platform, h)}
            onUrl={(u) => setUrl(platform, u)}
          />
        ))}
      </ul>
    </div>
  )
}

interface RowProps {
  platform: SocialPlatform
  account: SocialAccount | null
  onHandle(handle: string): void
  onUrl(url: string): void
}

function SocialRow({ platform, account, onHandle, onUrl }: RowProps) {
  const { t } = useTranslation()
  const name = socialLabel(t, platform)
  const brand = BRANDS[platform]
  const lit = !!account?.handle
  const [showUrl, setShowUrl] = useState(false)
  const urlOpen = lit && (showUrl || !!account?.url)

  const handle = useDraft({ value: account?.handle ?? '', onCommit: onHandle, validate: rules.handle, maxLength: 64, live: true })
  const url = useDraft({ value: account?.url ?? '', onCommit: onUrl, validate: rules.url, maxLength: LIMITS.url })
  const error = handle.errorKey ?? url.errorKey

  const tileStyle = lit ? ({ background: brand.bg, color: brand.fg } as CSSProperties) : undefined

  return (
    <li className={`insp-social${lit ? ' is-lit' : ''}${error ? ' is-invalid' : ''}`}>
      <div className="insp-social__main">
        <span className="insp-social__tile" style={tileStyle} title={name}>
          <BrandIcon platform={platform} size={16} accent={lit && platform === 'tiktok'} />
        </span>
        <input
          className="insp-social__input insp-input--ltr"
          dir="ltr"
          value={handle.value}
          onChange={(e) => handle.change(e.target.value)}
          onBlur={() => handle.commit()}
          onKeyDown={handle.keyDown}
          maxLength={64}
          spellCheck={false}
          autoComplete="off"
          placeholder={
            PHONE_PLATFORMS.includes(platform)
              ? t('inspector.socials.phone_placeholder', { platform: name })
              : t('inspector.socials.handle_placeholder', { platform: name })
          }
          aria-label={t('inspector.socials.handle_label', { platform: name })}
          aria-invalid={handle.errorKey ? true : undefined}
        />
        {account?.url && !url.dirty && !url.errorKey ? (
          <button
            type="button"
            className="icon-btn icon-btn--sm"
            onClick={() => void openExternal(account.url)}
            aria-label={t('inspector.socials.open_profile', { platform: name })}
            title={t('inspector.socials.open_profile', { platform: name })}
          >
            <ExternalLink size={14} />
          </button>
        ) : (
          <button
            type="button"
            className="icon-btn icon-btn--sm"
            onClick={() => setShowUrl((v) => !v)}
            disabled={!lit}
            aria-pressed={urlOpen}
            aria-label={t('inspector.socials.add_url', { platform: name })}
            title={lit ? t('inspector.socials.add_url', { platform: name }) : t('inspector.socials.handle_first')}
          >
            <Link2 size={14} />
          </button>
        )}
      </div>
      {urlOpen && (
        <input
          className="insp-social__url insp-input--ltr"
          dir="ltr"
          type="url"
          value={url.value}
          onChange={(e) => url.change(e.target.value)}
          onBlur={() => url.commit()}
          onKeyDown={url.keyDown}
          maxLength={LIMITS.url}
          spellCheck={false}
          autoComplete="off"
          placeholder="https://"
          aria-label={t('inspector.socials.url_label', { platform: name })}
          aria-invalid={url.errorKey ? true : undefined}
        />
      )}
      {error && (
        <div className="field__error" role="alert">
          {t(error)}
        </div>
      )}
    </li>
  )
}
