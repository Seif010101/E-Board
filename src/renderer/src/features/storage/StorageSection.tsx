import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { HardDrive } from 'lucide-react'
import type { StorageStatus } from '@shared/api'
import { Modal } from '@renderer/components/ui/Modal'
import { toast } from '@renderer/components/ui/toast'
import { api, call, errorMessage } from '@renderer/lib/api'
import { Row, Section } from '@renderer/features/account/PageParts'
import { ButtonSpinner } from '@renderer/features/auth/FormBits'
import './storage.css'

/** Settings: keep the data on this computer, or on a USB drive that must be plugged in to use the app. */
export function StorageSection() {
  const { t } = useTranslation()
  const [status, setStatus] = useState<StorageStatus | null>(null)
  const [confirm, setConfirm] = useState<'portable' | 'local' | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    let cancelled = false
    call(api.storage.status()).then(
      (s) => !cancelled && setStatus(s),
      () => undefined
    )
    return () => {
      cancelled = true
    }
  }, [])

  if (!status) return null
  const portable = status.mode === 'portable'
  const target = portable ? 'local' : 'portable'

  const move = async () => {
    setBusy(true)
    try {
      const done = await call(api.storage.moveData({ target }))
      // On success the app restarts; a cancelled folder dialog leaves everything as it was.
      if (!done) {
        setBusy(false)
        setConfirm(null)
      }
    } catch (err) {
      setBusy(false)
      setConfirm(null)
      toast.error(errorMessage(t, err))
    }
  }

  return (
    <Section
      id="acct-set-storage"
      icon={<HardDrive size={18} />}
      title={t('storage.settings.title')}
      description={t('storage.settings.description')}
    >
      <Row labelId="acct-set-storage-now" label={t('storage.settings.now')}>
        <span className="acct-value">{portable ? t('storage.settings.portable') : t('storage.settings.local')}</span>
      </Row>
      {portable && status.drivePath && (
        <p className="acct-storage__path">
          {t('storage.settings.path')}: <bdi dir="ltr">{status.drivePath}</bdi>
        </p>
      )}
      <Row labelId="acct-set-storage-move" label={portable ? t('storage.settings.to_local') : t('storage.settings.to_drive')}>
        <button type="button" className="btn" onClick={() => setConfirm(target)}>
          {portable ? t('storage.settings.to_local') : t('storage.settings.to_drive')}
        </button>
      </Row>
      <p className="acct-storage__warning">{t('storage.settings.warning')}</p>

      {confirm && (
        <Modal
          open
          title={confirm === 'portable' ? t('storage.settings.to_drive') : t('storage.settings.to_local')}
          onClose={() => !busy && setConfirm(null)}
          footer={
            <>
              <button type="button" className="btn" onClick={() => setConfirm(null)} disabled={busy}>
                {t('common.cancel')}
              </button>
              <button type="button" className="btn btn--primary" onClick={() => void move()} disabled={busy}>
                {busy && <ButtonSpinner />}
                {busy ? t('storage.settings.working') : t('storage.settings.confirm')}
              </button>
            </>
          }
        >
          <p>{confirm === 'portable' ? t('storage.settings.to_drive_text') : t('storage.settings.to_local_text')}</p>
        </Modal>
      )}
    </Section>
  )
}
