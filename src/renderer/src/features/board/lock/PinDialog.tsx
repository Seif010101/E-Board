import { useEffect, useId, useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { Modal } from '@renderer/components/ui/Modal'
import { Field } from '@renderer/components/ui/Field'
import { toast } from '@renderer/components/ui/toast'
import { errorMessage } from '@renderer/lib/api'
import { closePinRequest, runPinRequest, usePinRequest } from './pinStore'

const PIN = /^\d{4,8}$/
const digits = (raw: string): string => raw.replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x660)).replace(/\D/g, '').slice(0, 8)

/** Asks for the PIN to lock items with, or to unlock PIN-locked ones. */
export function PinDialog() {
  const { t } = useTranslation()
  const request = usePinRequest((s) => s.request)
  const uid = useId()
  const [pin, setPin] = useState('')
  const [again, setAgain] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    setPin('')
    setAgain('')
    setError(null)
    setBusy(false)
  }, [request])

  if (!request) return null
  const locking = request.mode === 'lock'

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (busy) return
    if (!PIN.test(pin)) return setError(t('board.pin.format'))
    if (locking && pin !== again) return setError(t('board.pin.mismatch'))
    setBusy(true)
    try {
      await runPinRequest(request, pin)
      closePinRequest()
      toast.success(t(locking ? 'board.pin.locked' : 'board.pin.unlocked', { count: request.ids.length }))
    } catch (err) {
      setBusy(false)
      setPin('')
      setError(errorMessage(t, err))
    }
  }

  return (
    <Modal
      open
      title={locking ? t('board.pin.lock_title') : t('board.pin.unlock_title')}
      onClose={closePinRequest}
      width={400}
      footer={
        <>
          <button type="button" className="btn" onClick={closePinRequest}>
            {t('common.cancel')}
          </button>
          <button type="submit" form={`${uid}-form`} className="btn btn--primary" disabled={busy}>
            {locking ? t('board.pin.lock') : t('board.pin.unlock')}
          </button>
        </>
      }
    >
      <form id={`${uid}-form`} onSubmit={submit} noValidate aria-busy={busy} className="pin-form">
        <p className="pin-form__text">{locking ? t('board.pin.lock_text') : t('board.pin.unlock_text')}</p>
        <Field label={t('board.pin.pin')} htmlFor={`${uid}-pin`} error={error}>
          <input
            id={`${uid}-pin`}
            className="input pin-form__input"
            type="password"
            inputMode="numeric"
            autoComplete="off"
            autoFocus
            maxLength={8}
            value={pin}
            aria-invalid={error ? true : undefined}
            onChange={(e) => {
              setPin(digits(e.target.value))
              setError(null)
            }}
          />
        </Field>
        {locking && (
          <Field label={t('board.pin.again')} htmlFor={`${uid}-again`}>
            <input
              id={`${uid}-again`}
              className="input pin-form__input"
              type="password"
              inputMode="numeric"
              autoComplete="off"
              maxLength={8}
              value={again}
              onChange={(e) => {
                setAgain(digits(e.target.value))
                setError(null)
              }}
            />
          </Field>
        )}
        {locking && <p className="pin-form__hint">{t('board.pin.warning')}</p>}
      </form>
    </Modal>
  )
}
