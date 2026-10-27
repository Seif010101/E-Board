import { useTranslation } from 'react-i18next'
import { passwordStrength } from '@shared/validation'
import './authUi.css'

const LEVELS = ['tooWeak', 'weak', 'fair', 'good', 'strong'] as const

/** 4-step password strength bar for new passwords. */
export function StrengthMeter({ password }: { password: string }) {
  const { t } = useTranslation()
  const score = passwordStrength(password)
  const label = t(`auth.strength.${LEVELS[score]}`)

  return (
    <div
      className={`auth-meter auth-meter--${score}${password ? '' : ' is-empty'}`}
      role="meter"
      aria-label={t('auth.strength.label')}
      aria-valuemin={0}
      aria-valuemax={4}
      aria-valuenow={score}
      aria-valuetext={label}
    >
      <div className="auth-meter__bars" aria-hidden="true">
        {[1, 2, 3, 4].map((i) => (
          <span key={i} className={`auth-meter__bar${i <= score ? ' is-on' : ''}`} />
        ))}
      </div>
      <span className="auth-meter__label">{password ? label : t('auth.strength.empty')}</span>
    </div>
  )
}
