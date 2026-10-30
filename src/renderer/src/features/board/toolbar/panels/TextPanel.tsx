import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { useShallow } from 'zustand/react/shallow'
import {
  Bold,
  Italic,
  List,
  ListOrdered,
  Pilcrow,
  TextAlignCenter,
  TextAlignEnd,
  TextAlignJustify,
  TextAlignStart,
  Underline
} from 'lucide-react'
import { TEXT_FONTS, type TextData, type TextFont } from '@shared/types'
import { board, useBoard } from '../../core/store'
import { TEXT_FONT_STACKS } from '../../items/text/format'
import { ColorSwatches } from '../controls/ColorSwatches'
import { Segmented, type SegmentOption } from '../controls/Segmented'
import { SizeField } from '../controls/SizeField'
import { useTxGesture } from '../controls/useTxGesture'
import { TEXT_COLORS } from '../controls/palettes'
import { RANGES } from '../controls/ranges'

type Format = Omit<TextData, 'text'>

const ICON = 15

/**
 * Formatting of text boxes. With text boxes selected it edits them; otherwise it sets the look of
 * the next box placed. This is the only place text is formatted.
 */
export function TextPanel() {
  const { t } = useTranslation()
  const gesture = useTxGesture()
  const defaults = useBoard((s) => s.toolOptions.text)
  // A selector returning a new array needs a shallow comparison, or it re-renders forever.
  const targets = useBoard(useShallow((s) => s.selection.filter((id) => s.items[id]?.type === 'text')))
  const first = useBoard((s) => {
    const id = s.selection.find((i) => s.items[i]?.type === 'text')
    const item = id ? s.items[id] : undefined
    return item?.type === 'text' ? item.data : undefined
  })

  // Boxes saved before these options existed lack them: fall back to the defaults.
  const f: Format = { ...defaults, ...(first ? stripText(first) : null) }
  const editing = targets.length > 0
  const set = (patch: Partial<Format>) => {
    board().setToolOptions('text', patch)
    if (!editing) return
    const s = board()
    const unlocked = targets.filter((id) => !s.items[id]?.locked)
    s.updateItems(Object.fromEntries(unlocked.map((id) => [id, { data: patch }])))
  }

  const toggle = (key: 'bold' | 'italic' | 'underline', label: string, icon: ReactNode) => (
    <button type="button" className="sc-toggle" aria-pressed={f[key]} onClick={() => set({ [key]: !f[key] })} title={label}>
      {icon}
      <span className="sc-visually-hidden">{label}</span>
    </button>
  )

  const aligns: SegmentOption<TextData['align']>[] = [
    { value: 'start', label: t('items.inspector.align_start'), icon: <TextAlignStart size={ICON} aria-hidden="true" /> },
    { value: 'center', label: t('items.inspector.align_center'), icon: <TextAlignCenter size={ICON} aria-hidden="true" /> },
    { value: 'end', label: t('items.inspector.align_end'), icon: <TextAlignEnd size={ICON} aria-hidden="true" /> },
    { value: 'justify', label: t('toolbar.text.align_justify'), icon: <TextAlignJustify size={ICON} aria-hidden="true" /> }
  ]
  const lists: SegmentOption<TextData['list']>[] = [
    { value: 'none', label: t('toolbar.text.list_none'), icon: <Pilcrow size={ICON} aria-hidden="true" /> },
    { value: 'bullet', label: t('toolbar.text.list_bullet'), icon: <List size={ICON} aria-hidden="true" /> },
    { value: 'number', label: t('toolbar.text.list_number'), icon: <ListOrdered size={ICON} aria-hidden="true" /> }
  ]
  const spacings: SegmentOption<TextData['spacing']>[] = [
    { value: 'tight', label: t('toolbar.text.spacing_tight') },
    { value: 'normal', label: t('toolbar.text.spacing_normal') },
    { value: 'loose', label: t('toolbar.text.spacing_loose') }
  ]
  const fonts: SegmentOption<TextFont>[] = TEXT_FONTS.map((value) => ({ value, label: t(`toolbar.text.font_${value}`) }))

  return (
    <div className="sc-stack">
      <div className="sc-row">
        <div className="sc-group">
          <div className="sc-label">{t('toolbar.text.style')}</div>
          <div className="sc-seg sc-seg--icons">
            {toggle('bold', t('items.inspector.bold'), <Bold size={ICON} aria-hidden="true" />)}
            {toggle('italic', t('toolbar.text.italic'), <Italic size={ICON} aria-hidden="true" />)}
            {toggle('underline', t('toolbar.text.underline'), <Underline size={ICON} aria-hidden="true" />)}
          </div>
        </div>
      </div>
      <label className="sc-group">
        <span className="sc-label">{t('toolbar.text.font')}</span>
        <select
          className="sc-select"
          value={f.font}
          onChange={(e) => set({ font: e.target.value as TextFont })}
          style={f.font !== 'default' ? { fontFamily: TEXT_FONT_STACKS[f.font] } : undefined}
        >
          {fonts.map((o) => (
            <option key={o.value} value={o.value} style={o.value !== 'default' ? { fontFamily: TEXT_FONT_STACKS[o.value] } : undefined}>
              {o.label}
            </option>
          ))}
        </select>
      </label>
      <ColorSwatches label={t('toolbar.text.color')} colors={TEXT_COLORS} value={f.color} onChange={(color) => set({ color })} allowCustom />
      <SizeField
        label={t('toolbar.text.size')}
        min={RANGES.textFont.min}
        max={RANGES.textFont.max}
        value={f.fontSize}
        onChange={(fontSize) => set({ fontSize })}
        onGestureStart={gesture.start}
        onGestureEnd={gesture.end}
        preview={
          <span
            className="sc-preview-text tb-preview-ink"
            style={{ color: f.color, fontWeight: f.bold ? 700 : 400, fontStyle: f.italic ? 'italic' : 'normal' }}
          >
            Aa
          </span>
        }
      />
      <Segmented label={t('items.inspector.align')} options={aligns} value={f.align} onChange={(align) => set({ align })} iconOnly />
      <Segmented label={t('toolbar.text.list')} options={lists} value={f.list} onChange={(list) => set({ list })} iconOnly />
      <Segmented label={t('toolbar.text.spacing')} options={spacings} value={f.spacing} onChange={(spacing) => set({ spacing })} />
      <p className="tb-fly__hint">{editing ? t('toolbar.text.hint_selected') : t('toolbar.text.hint')}</p>
    </div>
  )
}

function stripText(d: TextData): Partial<Format> {
  const { text: _text, ...rest } = d
  void _text
  // Drop options the box does not carry yet so they never override the defaults with `undefined`.
  return Object.fromEntries(Object.entries(rest).filter(([, v]) => v !== undefined)) as Partial<Format>
}
