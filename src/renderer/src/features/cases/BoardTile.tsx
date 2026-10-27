import { useId, useState, type KeyboardEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { Clock, Layers, PencilLine, Plus, SquareArrowOutUpRight, Trash2 } from 'lucide-react'
import type { BoardRecord, BoardTheme } from '@shared/types'
import { ActionMenu, type MenuEntry } from './ActionMenu'
import { BOARD_THEMES } from './meta'
import { RelativeTime, ThemeSwatch } from './parts'
import { ThemePreview } from './ThemePreview'
import './cases.css'
import './BoardTile.css'

/** Marks the focusable element of each tile for grid arrow-key navigation. */
export const BOARD_GRID_ITEM = '[data-grid-item]'

interface BoardTileProps {
  board: BoardRecord
  now: number
  onOpen(board: BoardRecord): void
  onRename(board: BoardRecord): void
  onTheme(board: BoardRecord, theme: BoardTheme): void
  onDelete(board: BoardRecord): void
}

/** An evidence board drawn as a sheet with a dog-eared corner and a live theme preview. */
export function BoardTile({ board, now, onOpen, onRename, onTheme, onDelete }: BoardTileProps) {
  const { t } = useTranslation()
  const [menuOpen, setMenuOpen] = useState(false)
  const metaId = useId()

  const entries: MenuEntry[] = [
    {
      kind: 'item',
      key: 'open',
      label: t('cases.board.open'),
      icon: <SquareArrowOutUpRight size={16} />,
      onSelect: () => onOpen(board)
    },
    { kind: 'item', key: 'rename', label: t('cases.board.rename'), icon: <PencilLine size={16} />, onSelect: () => onRename(board) },
    { kind: 'separator', key: 'sep-theme' },
    { kind: 'label', key: 'theme', label: t('cases.board.theme') },
    ...BOARD_THEMES.map(
      (theme): MenuEntry => ({
        kind: 'radio',
        key: `theme-${theme}`,
        label: t(`cases.themes.${theme}`),
        icon: <ThemeSwatch theme={theme} />,
        checked: board.theme === theme,
        onSelect: () => {
          if (theme !== board.theme) onTheme(board, theme)
        }
      })
    ),
    { kind: 'separator', key: 'sep-delete' },
    {
      kind: 'item',
      key: 'delete',
      label: t('cases.board.delete'),
      icon: <Trash2 size={16} />,
      danger: true,
      onSelect: () => onDelete(board)
    }
  ]

  const onKeyDown = (e: KeyboardEvent<HTMLButtonElement>) => {
    if (e.key === 'F2') {
      e.preventDefault()
      onRename(board)
    } else if (e.key === 'Delete') {
      e.preventDefault()
      onDelete(board)
    } else if (e.key === 'ContextMenu' || (e.shiftKey && e.key === 'F10')) {
      e.preventDefault()
      setMenuOpen(true)
    }
  }

  return (
    <li
      className="cases-board"
      data-theme={board.theme}
      onContextMenu={(e) => {
        e.preventDefault()
        setMenuOpen(true)
      }}
    >
      <div className="cases-board__sheet">
        <ThemePreview theme={board.theme} className="cases-board__preview" />
        <div className="cases-board__body">
          <h3 className="cases-board__title">
            <button
              type="button"
              className="cases-board__open"
              data-grid-item=""
              onClick={() => onOpen(board)}
              onKeyDown={onKeyDown}
              aria-describedby={metaId}
              aria-keyshortcuts="F2 Delete Shift+F10"
              title={board.title}
            >
              <span className="cases-board__title-text">{board.title}</span>
            </button>
          </h3>
          <div className="cases-board__menu">
            <ActionMenu
              label={t('cases.board.menuLabel', { title: board.title })}
              entries={entries}
              open={menuOpen}
              onOpenChange={setMenuOpen}
            />
          </div>
          <div className="cases-board__meta" id={metaId}>
            <span className="cases-board__theme">
              <ThemeSwatch theme={board.theme} />
              {t(`cases.themes.${board.theme}`)}
            </span>
            <span className="cases-board__facts">
              <span className="cases-board__fact">
                <Layers size={13} aria-hidden="true" />
                {t('cases.board.itemCount', { count: board.itemCount })}
              </span>
              <span className="cases-board__fact">
                <Clock size={13} aria-hidden="true" />
                <RelativeTime ts={board.updatedAt} now={now} />
              </span>
            </span>
          </div>
        </div>
      </div>
    </li>
  )
}

/** Dashed "new sheet" tile closing the grid. */
export function NewBoardTile({ onCreate }: { onCreate(): void }) {
  const { t } = useTranslation()
  return (
    <li className="cases-board cases-board--new">
      <button type="button" className="cases-board__new" data-grid-item="" onClick={onCreate}>
        <span className="cases-board__new-icon" aria-hidden="true">
          <Plus size={22} />
        </span>
        <span className="cases-board__new-label">{t('cases.case.newBoard')}</span>
        <span className="cases-board__new-hint">{t('cases.case.newBoardHint')}</span>
      </button>
    </li>
  )
}

export function BoardTileSkeleton() {
  return (
    <li className="cases-board cases-board--skeleton" aria-hidden="true">
      <div className="cases-board__sheet">
        <span className="cases-board__preview cases-board__preview--skeleton" />
        <div className="cases-board__body">
          <span className="cases-skel cases-skel--title" />
          <span className="cases-skel cases-skel--short" />
        </div>
      </div>
    </li>
  )
}
