import { Fragment, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import type { TFunction } from 'i18next'
import { Modal } from '@renderer/components/ui/Modal'
import { useCanvasUi } from './uiStore'
import { keyLabel, KEYS } from './keys'
import './ShortcutsDialog.css'

/** One shortcut; several key combos are alternatives. */
interface Shortcut {
  label: string
  combos: (readonly string[])[]
}

interface Group {
  title: string
  rows: Shortcut[]
}

const TOOL_ROWS: [tool: string, key: string][] = [
  ['select', 'V'],
  ['hand', 'H'],
  ['pen', 'P'],
  ['highlighter', 'I'],
  ['eraser', 'E'],
  ['shape', 'R'],
  ['note', 'N'],
  ['text', 'T'],
  ['link', 'L']
]

function groups(t: TFunction): Group[] {
  const s = (key: string) => t(`board.shortcuts.${key}`)
  return [
    {
      title: s('group.tools'),
      rows: TOOL_ROWS.map(([tool, key]) => ({ label: t(`board.shortcuts.tool.${tool}`), combos: [[key]] }))
    },
    {
      title: s('group.edit'),
      rows: [
        { label: s('undo'), combos: [KEYS.undo] },
        { label: s('redo'), combos: [KEYS.redo, KEYS.redoAlt] },
        { label: s('select_all'), combos: [KEYS.selectAll] },
        { label: s('multi_select'), combos: [['shift', 'click']] },
        { label: s('duplicate'), combos: [KEYS.duplicate, ['alt', 'drag']] },
        { label: s('copy'), combos: [KEYS.copy] },
        { label: s('cut'), combos: [KEYS.cut] },
        { label: s('paste'), combos: [KEYS.paste] },
        { label: s('delete'), combos: [KEYS.delete, ['backspace']] },
        { label: s('nudge'), combos: [['arrows'], ['shift', 'arrows']] },
        { label: s('front'), combos: [KEYS.front] },
        { label: s('back'), combos: [KEYS.back] },
        { label: s('details'), combos: [KEYS.details] },
        { label: s('escape'), combos: [KEYS.escape] }
      ]
    },
    {
      title: s('group.view'),
      rows: [
        { label: s('pan'), combos: [['space', 'drag'], ['middle']] },
        { label: s('zoom_wheel'), combos: [['mod', 'wheel']] },
        { label: s('zoom_in'), combos: [KEYS.zoomIn] },
        { label: s('zoom_out'), combos: [KEYS.zoomOut] },
        { label: s('zoom_reset'), combos: [KEYS.zoomReset] },
        { label: s('fit'), combos: [KEYS.fit] }
      ]
    },
    {
      title: s('group.board'),
      rows: [
        { label: s('search'), combos: [KEYS.search] },
        { label: s('rename'), combos: [KEYS.rename] },
        { label: s('menu'), combos: [KEYS.menu] },
        { label: s('shortcuts'), combos: [KEYS.shortcuts] }
      ]
    }
  ]
}

function Combo({ keys }: { keys: readonly string[] }) {
  const { t } = useTranslation()
  return (
    <span className="bsk-combo" dir="ltr">
      {keys.map((k, i) => (
        <Fragment key={k}>
          {i > 0 && <span className="bsk-plus">+</span>}
          <kbd className="bsk-key">{keyLabel(t, k)}</kbd>
        </Fragment>
      ))}
    </span>
  )
}

/** Reference of every board shortcut (opened with "?" or from the context menu). */
export function ShortcutsDialog() {
  const { t } = useTranslation()
  const open = useCanvasUi((s) => s.shortcutsOpen)
  const close = useCallback(() => useCanvasUi.getState().setShortcutsOpen(false), [])

  return (
    <Modal open={open} onClose={close} title={t('board.shortcuts.title')} width={760}>
      <div className="bsk-grid">
        {groups(t).map((g) => (
          <section key={g.title} className="bsk-group" aria-label={g.title}>
            <h3 className="bsk-title">{g.title}</h3>
            <dl className="bsk-list">
              {g.rows.map((row) => (
                <div key={row.label} className="bsk-row">
                  <dt className="bsk-label">{row.label}</dt>
                  <dd className="bsk-keys">
                    {row.combos.map((c, i) => (
                      <Fragment key={c.join('+')}>
                        {i > 0 && <span className="bsk-or">{t('board.shortcuts.or')}</span>}
                        <Combo keys={c} />
                      </Fragment>
                    ))}
                  </dd>
                </div>
              ))}
            </dl>
          </section>
        ))}
      </div>
    </Modal>
  )
}
