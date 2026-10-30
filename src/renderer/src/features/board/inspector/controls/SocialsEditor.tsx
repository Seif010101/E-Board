import { useState, type CSSProperties, type KeyboardEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { ExternalLink, Link2, Plus, X } from 'lucide-react'
import { SOCIAL_PLATFORMS, type SocialAccount, type SocialPlatform } from '@shared/types'
import { cleanLine, LIMITS, rules } from '@shared/validation'
import { BrandIcon } from '../../cards/common/BrandIcon'
import { BRANDS } from '../../cards/common/brands'
import { openExternal } from '../../cards/common/actions'
import { socialLabel } from '../labels'
import { CertaintyBar } from './CertaintyBar'
import { entryKey, useCertaintyFor } from './certainty'
import { useDraft } from './useDraft'

/** Platforms whose accounts are usually identified by a phone number. */
const PHONE_PLATFORMS: readonly SocialPlatform[] = ['whatsapp', 'signal']

interface SocialsEditorProps {
  socials: SocialAccount[]
  onChange(socials: SocialAccount[]): void
}

/**
 * Only accounts that exist are listed. "Add account" opens a small form (platform, account name,
 * optional link), so the other platforms never take space on the card or in the drawer.
 */
export function SocialsEditor({ socials, onChange }: SocialsEditorProps) {
  const { t } = useTranslation()
  const bind = useCertaintyFor()
  const [adding, setAdding] = useState(false)
  const free = SOCIAL_PLATFORMS.filter((p) => !socials.some((s) => s.platform === p))

  const update = (platform: SocialPlatform, patch: Partial<SocialAccount>) =>
    onChange(socials.map((s) => (s.platform === platform ? { ...s, ...patch } : s)))

  return (
    <div className="insp-socials">
      {socials.length > 0 && (
        <ul className="insp-socials__list" role="list">
          {socials.map((account) => (
            <SocialRow
              key={account.platform}
              account={account}
              certainty={bind ? bind(entryKey('socials', account.platform)) : undefined}
              onHandle={(handle) => update(account.platform, { handle })}
              onUrl={(url) => update(account.platform, { url })}
              onRemove={() => onChange(socials.filter((s) => s.platform !== account.platform))}
            />
          ))}
        </ul>
      )}
      {adding && free.length > 0 ? (
        <AddAccount
          platforms={free}
          onCancel={() => setAdding(false)}
          onAdd={(account) => {
            onChange([...socials, account])
            setAdding(false)
          }}
        />
      ) : (
        <button
          type="button"
          className="btn btn--ghost insp-socials__add"
          onClick={() => setAdding(true)}
          disabled={free.length === 0 || socials.length >= LIMITS.socials}
        >
          <Plus size={15} aria-hidden="true" />
          {t('inspector.socials.add_account')}
        </button>
      )}
    </div>
  )
}

function AddAccount({
  platforms,
  onAdd,
  onCancel
}: {
  platforms: readonly SocialPlatform[]
  onAdd(account: SocialAccount): void
  onCancel(): void
}) {
  const { t } = useTranslation()
  const [platform, setPlatform] = useState<SocialPlatform>(platforms[0])
  const [handle, setHandle] = useState('')
  const [url, setUrl] = useState('')
  const [errors, setErrors] = useState<{ handle?: string; url?: string }>({})
  const name = socialLabel(t, platform)

  const submit = () => {
    const h = cleanLine(handle)
    const u = cleanLine(url)
    const next = {
      handle: h === '' ? 'validation.required' : h.length > 64 ? 'validation.too_long' : (rules.handle(h) ?? undefined),
      url: u === '' ? undefined : (rules.url(u) ?? undefined)
    }
    setErrors(next)
    if (next.handle || next.url) return
    onAdd({ platform, handle: h, url: u })
  }
  const onKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.nativeEvent.isComposing) return
    if (e.key === 'Enter') {
      e.preventDefault()
      submit()
    } else if (e.key === 'Escape') {
      e.preventDefault()
      e.stopPropagation()
      onCancel()
    }
  }

  return (
    <div className="insp-socials__form">
      <div className="insp-socials__formrow">
        <span
          className="insp-social__tile is-lit"
          style={{ background: BRANDS[platform].bg, color: BRANDS[platform].fg } as CSSProperties}
        >
          <BrandIcon platform={platform} size={16} accent={platform === 'tiktok'} />
        </span>
        <select
          className="select insp-select"
          value={platform}
          aria-label={t('inspector.socials.platform')}
          onChange={(e) => setPlatform(e.target.value as SocialPlatform)}
        >
          {platforms.map((p) => (
            <option key={p} value={p}>
              {socialLabel(t, p)}
            </option>
          ))}
        </select>
      </div>
      <input
        autoFocus
        className="input insp-input insp-input--ltr"
        dir="ltr"
        value={handle}
        maxLength={64}
        spellCheck={false}
        autoComplete="off"
        placeholder={
          PHONE_PLATFORMS.includes(platform)
            ? t('inspector.socials.phone_placeholder', { platform: name })
            : t('inspector.socials.handle_placeholder', { platform: name })
        }
        aria-label={t('inspector.socials.handle_label', { platform: name })}
        aria-invalid={errors.handle ? true : undefined}
        onChange={(e) => setHandle(e.target.value)}
        onKeyDown={onKey}
      />
      {errors.handle && (
        <div className="field__error" role="alert">
          {t(errors.handle)}
        </div>
      )}
      <input
        className="input insp-input insp-input--ltr"
        dir="ltr"
        type="url"
        value={url}
        maxLength={LIMITS.url}
        spellCheck={false}
        autoComplete="off"
        placeholder="https://"
        aria-label={t('inspector.socials.url_label', { platform: name })}
        aria-invalid={errors.url ? true : undefined}
        onChange={(e) => setUrl(e.target.value)}
        onKeyDown={onKey}
      />
      {errors.url && (
        <div className="field__error" role="alert">
          {t(errors.url)}
        </div>
      )}
      <div className="insp-socials__actions">
        <button type="button" className="btn btn--ghost" onClick={onCancel}>
          {t('common.cancel')}
        </button>
        <button type="button" className="btn btn--primary" onClick={submit}>
          {t('common.add')}
        </button>
      </div>
    </div>
  )
}

interface RowProps {
  account: SocialAccount
  certainty?: { value: number | undefined; onChange(v: number): void }
  onHandle(handle: string): void
  onUrl(url: string): void
  onRemove(): void
}

function SocialRow({ account, certainty, onHandle, onUrl, onRemove }: RowProps) {
  const { t } = useTranslation()
  const platform = account.platform
  const name = socialLabel(t, platform)
  const brand = BRANDS[platform]
  const lit = true
  const [showUrl, setShowUrl] = useState(false)
  const urlOpen = lit && (showUrl || !!account.url)

  const handle = useDraft({ value: account?.handle ?? '', onCommit: onHandle, validate: rules.handle, maxLength: 64, live: true, required: true })
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
        <button
          type="button"
          className="icon-btn icon-btn--sm insp-danger-hover"
          onClick={onRemove}
          aria-label={t('common.remove')}
          title={t('common.remove')}
        >
          <X size={14} />
        </button>
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
      {certainty && <CertaintyBar {...certainty} label={`${name} ${account.handle}`} compact />}
      {error && (
        <div className="field__error" role="alert">
          {t(error)}
        </div>
      )}
    </li>
  )
}
