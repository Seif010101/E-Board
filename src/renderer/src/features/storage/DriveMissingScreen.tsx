import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { HardDrive } from 'lucide-react'
import { toast } from '@renderer/components/ui/toast'
import { api, call, errorMessage } from '@renderer/lib/api'
import { AuthBackdrop } from '@renderer/features/auth/AuthBackdrop'
import { ButtonSpinner } from '@renderer/features/auth/FormBits'
import { LogoMark } from '@renderer/features/auth/LogoMark'
import './storage.css'

/**
 * Shown while the USB drive holding the data is not plugged in. The app restarts by itself as soon
 * as the drive is back; nothing about the data is available meanwhile.
 */
export function DriveMissingScreen({ drivePath }: { drivePath: string | null }) {
  const { t } = useTranslation()
  const [busy, setBusy] = useState<'drive' | 'local' | null>(null)

  const run = async (kind: 'drive' | 'local') => {
    if (busy) return
    if (kind === 'local' && !window.confirm(t('storage.missing.local_confirm'))) return
    setBusy(kind)
    try {
      const changed = await call(kind === 'drive' ? api.storage.useDrive() : api.storage.useLocal())
      // On success the app restarts and this window goes away.
      if (!changed) setBusy(null)
    } catch (err) {
      setBusy(null)
      toast.error(errorMessage(t, err))
    }
  }

  return (
    <div className="drive-missing">
      <AuthBackdrop />
      <main className="drive-missing__card" role="alert">
        <LogoMark />
        <HardDrive size={40} aria-hidden="true" className="drive-missing__icon" />
        <h1>{t('storage.missing.title')}</h1>
        <p>{t('storage.missing.text')}</p>
        {drivePath && (
          <p className="drive-missing__path">
            {t('storage.missing.where')} <bdi dir="ltr">{drivePath}</bdi>
          </p>
        )}
        <div className="drive-missing__actions">
          <button type="button" className="btn btn--primary" onClick={() => void run('drive')} disabled={busy !== null}>
            {busy === 'drive' && <ButtonSpinner />}
            {t('storage.missing.choose')}
          </button>
          <button type="button" className="btn btn--ghost" onClick={() => void run('local')} disabled={busy !== null}>
            {busy === 'local' && <ButtonSpinner />}
            {t('storage.missing.local')}
          </button>
        </div>
      </main>
    </div>
  )
}
