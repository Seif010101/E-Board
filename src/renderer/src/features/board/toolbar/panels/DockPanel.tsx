import { useTranslation } from 'react-i18next'
import { PanelBottom, PanelLeft, PanelRight, PanelTop } from 'lucide-react'
import type { DockEdge } from '@shared/types'
import { ChoiceTiles } from './Choices'

interface DockPanelProps {
  edge: DockEdge
  onChange(edge: DockEdge): void
}

/** Keyboard-friendly alternative to dragging the dock: pick the edge it sits on. */
export function DockPanel({ edge, onChange }: DockPanelProps) {
  const { t } = useTranslation()
  return (
    <div className="sc-stack">
      <ChoiceTiles<DockEdge>
        label={t('toolbar.dock.edge')}
        hideLabel
        choices={[
          { value: 'top', label: t('toolbar.dock.top'), icon: <PanelTop size={18} aria-hidden="true" /> },
          { value: 'bottom', label: t('toolbar.dock.bottom'), icon: <PanelBottom size={18} aria-hidden="true" /> },
          { value: 'left', label: t('toolbar.dock.left'), icon: <PanelLeft size={18} aria-hidden="true" /> },
          { value: 'right', label: t('toolbar.dock.right'), icon: <PanelRight size={18} aria-hidden="true" /> }
        ]}
        value={edge}
        onChange={onChange}
      />
      <p className="tb-fly__hint">{t('toolbar.grip_hint')}</p>
    </div>
  )
}
