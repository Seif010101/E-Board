import type { CSSProperties } from 'react'
import { useTranslation } from 'react-i18next'
import { useTxGesture } from '../../toolbar/controls/useTxGesture'
import type { CertaintyBinding } from './certainty'

const STEP = 5

interface Props extends CertaintyBinding {
  /** Slimmer variant for rows inside lists. */
  compact?: boolean
  /** Names the rated value for assistive tech. */
  label?: string
}

/**
 * A small battery-style meter under a field: how much the investigator trusts this value.
 * Drag (or use the arrow keys) to rate; the number beside it is the percentage.
 */
export function CertaintyBar({ value, onChange, compact, label }: Props) {
  const { t } = useTranslation()
  const gesture = useTxGesture()
  const rated = value !== undefined
  const v = value ?? 0
  const style = { '--cb-v': v, '--cb-hue': Math.round(v * 1.15) } as CSSProperties
  return (
    <div className={`cb${compact ? ' cb--compact' : ''}${rated ? '' : ' is-unrated'}`} style={style}>
      <input
        className="cb__range"
        type="range"
        min={0}
        max={100}
        step={STEP}
        value={v}
        // One drag is one undo step.
        onPointerDown={gesture.start}
        onChange={(e) => onChange(Math.round(Number(e.target.value)))}
        aria-label={label ? t('inspector.certainty_for', { name: label }) : t('inspector.certainty')}
        aria-valuetext={rated ? `${v}%` : t('inspector.certainty_unrated')}
        title={t('inspector.certainty_hint')}
      />
      <span className="cb__value" aria-hidden="true">
        {rated ? `${v}%` : '—'}
      </span>
    </div>
  )
}
