import { useId, useState, type KeyboardEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { Clock, FolderOpen, Layers, Pencil, Tag, Trash2 } from 'lucide-react'
import type { CaseRecord, CaseStatus } from '@shared/types'
import { ActionMenu, type MenuEntry } from './ActionMenu'
import { CASE_STATUSES, cssVars, fileNumber, safeColor } from './meta'
import { PriorityMarker, RelativeTime, StatusBadge, StatusDot } from './parts'
import './cases.css'
import './CaseFolder.css'

interface CaseFolderProps {
  record: CaseRecord
  now: number
  onOpen(record: CaseRecord): void
  onEdit(record: CaseRecord): void
  onDelete(record: CaseRecord): void
  onStatus(record: CaseRecord, status: CaseStatus): void
}

/** A manila case folder in the library grid. The title button is the folder's single tab stop. */
export function CaseFolder({ record, now, onOpen, onEdit, onDelete, onStatus }: CaseFolderProps) {
  const { t } = useTranslation()
  const [menuOpen, setMenuOpen] = useState(false)
  const categoryId = useId()
  const metaId = useId()

  const entries: MenuEntry[] = [
    { kind: 'item', key: 'open', label: t('cases.menu.open'), icon: <FolderOpen size={16} />, onSelect: () => onOpen(record) },
    { kind: 'item', key: 'edit', label: t('cases.menu.edit'), icon: <Pencil size={16} />, onSelect: () => onEdit(record) },
    { kind: 'separator', key: 'sep-status' },
    { kind: 'label', key: 'status', label: t('cases.menu.status') },
    ...CASE_STATUSES.map(
      (status): MenuEntry => ({
        kind: 'radio',
        key: `status-${status}`,
        label: t(`cases.status.${status}`),
        icon: <StatusDot status={status} />,
        checked: record.status === status,
        onSelect: () => {
          if (status !== record.status) onStatus(record, status)
        }
      })
    ),
    { kind: 'separator', key: 'sep-delete' },
    {
      kind: 'item',
      key: 'delete',
      label: t('cases.menu.delete'),
      icon: <Trash2 size={16} />,
      danger: true,
      onSelect: () => onDelete(record)
    }
  ]

  const onKeyDown = (e: KeyboardEvent<HTMLButtonElement>) => {
    if (e.key === 'F2') {
      e.preventDefault()
      onEdit(record)
    } else if (e.key === 'Delete') {
      e.preventDefault()
      onDelete(record)
    } else if (e.key === 'ContextMenu' || (e.shiftKey && e.key === 'F10')) {
      e.preventDefault()
      setMenuOpen(true)
    }
  }

  return (
    <li
      className="cases-folder"
      data-status={record.status}
      style={cssVars({ '--folder': safeColor(record.color) })}
      onContextMenu={(e) => {
        e.preventDefault()
        setMenuOpen(true)
      }}
    >
      <div className="cases-folder__back" aria-hidden="true">
        <span className="cases-folder__tab">
          <span className="cases-folder__tab-label">{t('cases.fileNo', { no: fileNumber(record.id) })}</span>
        </span>
      </div>
      <div className="cases-folder__paper" aria-hidden="true" />
      <div className="cases-folder__front">
        <span className="cases-folder__stamp" aria-hidden="true">
          {t(`cases.stamp.${record.status}`)}
        </span>
        <h3 className="cases-folder__title">
          <button
            type="button"
            className="cases-folder__open"
            onClick={() => onOpen(record)}
            onKeyDown={onKeyDown}
            aria-describedby={`${categoryId} ${metaId}`}
            aria-keyshortcuts="F2 Delete Shift+F10"
            title={record.title}
          >
            <span className="cases-folder__title-text">{record.title}</span>
          </button>
        </h3>
        <p className="cases-folder__category" id={categoryId}>
          <Tag size={13} aria-hidden="true" />
          <span className="cases-folder__category-text">{record.category || t('cases.uncategorized')}</span>
        </p>
        <div className="cases-folder__meta" id={metaId}>
          <div className="cases-folder__badges">
            <StatusBadge status={record.status} />
            <PriorityMarker priority={record.priority} />
          </div>
          <div className="cases-folder__facts">
            <span className="cases-folder__fact">
              <Layers size={13} aria-hidden="true" />
              {t('cases.boardCount', { count: record.boardCount })}
            </span>
            <span className="cases-folder__fact">
              <Clock size={13} aria-hidden="true" />
              <RelativeTime ts={record.updatedAt} now={now} />
            </span>
          </div>
        </div>
      </div>
      <div className="cases-folder__menu">
        <ActionMenu
          label={t('cases.menu.label', { title: record.title })}
          entries={entries}
          open={menuOpen}
          onOpenChange={setMenuOpen}
        />
      </div>
    </li>
  )
}

/** Placeholder folder shown while the library loads. */
export function CaseFolderSkeleton() {
  return (
    <li className="cases-folder cases-folder--skeleton" aria-hidden="true">
      <div className="cases-folder__back">
        <span className="cases-folder__tab" />
      </div>
      <div className="cases-folder__front">
        <span className="cases-skel cases-skel--title" />
        <span className="cases-skel cases-skel--title cases-skel--short" />
        <span className="cases-skel" />
        <span className="cases-folder__spacer" />
        <span className="cases-skel cases-skel--pill" />
        <span className="cases-skel cases-skel--short" />
      </div>
    </li>
  )
}
