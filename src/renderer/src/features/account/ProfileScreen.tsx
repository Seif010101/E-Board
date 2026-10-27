import { useCallback, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { CalendarDays, HardDrive, KeyRound, ShieldCheck, ShieldOff, Smartphone, Trash2, TriangleAlert, UserRound } from 'lucide-react'
import { useSession } from '@renderer/stores/session'
import { Avatar } from './Avatar'
import { ChangePasswordForm } from './ChangePasswordForm'
import { DeleteAccountDialog } from './DeleteAccountDialog'
import { DisplayNameForm } from './DisplayNameForm'
import { AccountPage, Row, Section } from './PageParts'
import { DisableTotpDialog, EnableTotpDialog } from './TwoFactorDialogs'
import './ProfileScreen.css'

type Dialog = 'enableTotp' | 'disableTotp' | 'delete' | null

const dateLocale = (language: string): string => (language === 'ar' ? 'ar-u-nu-latn' : 'en')

export function ProfileScreen() {
  const { t, i18n } = useTranslation()
  const user = useSession((s) => s.user)
  const [dialog, setDialog] = useState<Dialog>(null)
  const closeDialog = useCallback(() => setDialog(null), [])

  if (!user) return null

  const name = user.displayName || user.username
  const memberSince = new Intl.DateTimeFormat(dateLocale(i18n.language), { dateStyle: 'long' }).format(user.createdAt)
  const twofaPill = (
    <span className={`acct-pill${user.totpEnabled ? ' acct-pill--on' : ''}`}>
      {user.totpEnabled ? <ShieldCheck size={13} aria-hidden="true" /> : <ShieldOff size={13} aria-hidden="true" />}
      {user.totpEnabled ? t('account.twofa.on') : t('account.twofa.off')}
    </span>
  )

  return (
    <AccountPage id="acct-profile" title={t('account.profile.title')} subtitle={t('account.profile.subtitle')}>
      <section className="acct-prof__hero" aria-label={t('account.profile.identity')}>
        <Avatar name={name} seed={user.username} size={76} className="acct-prof__avatar" />
        <div className="acct-prof__who">
          <h2 className="acct-prof__name">{name}</h2>
          <p className="acct-prof__username" dir="ltr">
            @{user.username}
          </p>
          <div className="acct-prof__pills">
            {twofaPill}
            <span className="acct-pill">
              <CalendarDays size={13} aria-hidden="true" />
              {t('account.profile.memberSince', { date: memberSince })}
            </span>
          </div>
        </div>
      </section>

      <Section
        id="acct-prof-account"
        icon={<UserRound size={18} />}
        title={t('account.profile.accountTitle')}
        description={t('account.profile.accountText')}
      >
        <div className="acct-row acct-row--stacked">
          <DisplayNameForm user={user} />
        </div>
        <Row
          labelId="acct-prof-username"
          label={t('account.profile.username')}
          descriptionId="acct-prof-username-desc"
          description={t('account.profile.usernameText')}
        >
          <span className="acct-value acct-value--mono acct-prof__readonly" dir="ltr">
            @{user.username}
          </span>
        </Row>
        <Row
          labelId="acct-prof-storage"
          label={t('account.profile.storage')}
          descriptionId="acct-prof-storage-desc"
          description={t('account.profile.storageText')}
        >
          <span className="acct-pill acct-pill--accent">
            <HardDrive size={13} aria-hidden="true" />
            {t('account.profile.storageLocal')}
          </span>
        </Row>
      </Section>

      <Section
        id="acct-prof-password"
        icon={<KeyRound size={18} />}
        title={t('account.password.title')}
        description={t('account.password.text')}
      >
        <div className="acct-row acct-row--stacked">
          <ChangePasswordForm username={user.username} />
        </div>
      </Section>

      <Section
        id="acct-prof-twofa"
        icon={<Smartphone size={18} />}
        title={t('account.twofa.title')}
        description={t('account.twofa.text')}
        aside={twofaPill}
      >
        <Row
          labelId="acct-prof-twofa-app"
          label={t('account.twofa.app')}
          descriptionId="acct-prof-twofa-app-desc"
          description={user.totpEnabled ? t('account.twofa.enabledText') : t('account.twofa.disabledText')}
        >
          {user.totpEnabled ? (
            <button type="button" className="btn" onClick={() => setDialog('disableTotp')}>
              <ShieldOff size={15} aria-hidden="true" />
              {t('account.twofa.disable')}
            </button>
          ) : (
            <button type="button" className="btn btn--primary" onClick={() => setDialog('enableTotp')}>
              <ShieldCheck size={15} aria-hidden="true" />
              {t('account.twofa.enable')}
            </button>
          )}
        </Row>
      </Section>

      <Section
        id="acct-prof-danger"
        tone="danger"
        icon={<TriangleAlert size={18} />}
        title={t('account.delete.title')}
        description={t('account.delete.text')}
      >
        <Row
          labelId="acct-prof-delete"
          label={t('account.delete.label')}
          descriptionId="acct-prof-delete-desc"
          description={t('account.delete.rowText')}
        >
          <button type="button" className="btn acct-prof__danger-btn" onClick={() => setDialog('delete')}>
            <Trash2 size={15} aria-hidden="true" />
            {t('account.delete.open')}
          </button>
        </Row>
      </Section>

      {dialog === 'enableTotp' && <EnableTotpDialog onClose={closeDialog} />}
      {dialog === 'disableTotp' && <DisableTotpDialog onClose={closeDialog} />}
      {dialog === 'delete' && <DeleteAccountDialog onClose={closeDialog} />}
    </AccountPage>
  )
}
