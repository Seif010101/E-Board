// The board toolbar: a floating dock that can be dragged to any edge of the board, holding the
// tools, with flyout panels for their options.

import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type FocusEvent as ReactFocusEvent,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent as ReactMouseEvent
} from 'react'
import { useTranslation } from 'react-i18next'
import {
  Eraser,
  GripHorizontal,
  GripVertical,
  Hand,
  Highlighter,
  IdCard,
  MousePointer2,
  Pen,
  Redo2,
  Spline,
  StickyNote,
  Type,
  Undo2
} from 'lucide-react'
import type { DockEdge } from '@shared/types'
import { toast } from '@renderer/components/ui/toast'
import { useSession, useSettings } from '@renderer/stores/session'
import { board, useBoard } from '../core/store'
import type { PlaceableId, ToolId } from '../core/types'
import { KEYS } from '../canvas/keys'
import { isEditableTarget, isModalOpen } from '../canvas/pointer'
import { NOTE_PAPER } from '../items/note/colors'
import { ShapeIcon } from '../items/shape/ShapeIcon'
import { sameColor, TEXT_INK } from './controls/palettes'
import { isVerticalEdge, motionAllowed } from './dock'
import { Flyout } from './Flyout'
import { ToolButton } from './ToolButton'
import { place } from './place'
import { useDockDrag } from './useDockDrag'
import { CardsPanel } from './panels/CardsPanel'
import { DockPanel } from './panels/DockPanel'
import { DrawPanel, type DrawTool } from './panels/DrawPanel'
import { LinkPanel } from './panels/LinkPanel'
import { NotePanel } from './panels/NotePanel'
import { ShapesPanel } from './panels/ShapesPanel'
import { TextPanel } from './panels/TextPanel'
import './controls/controls.css'
import './toolbar.css'

type FlyoutId = 'dock' | 'draw' | 'cards' | 'shapes' | 'note' | 'text' | 'link'

const FLYOUTS: readonly FlyoutId[] = ['dock', 'draw', 'cards', 'shapes', 'note', 'text', 'link']

/** Shortcuts bound by the canvas keyboard handler, shown in the tooltips. */
const TOOL_KEYS: Record<ToolId, readonly string[]> = {
  select: ['V'],
  hand: ['H'],
  pen: ['P'],
  highlighter: ['I'],
  eraser: ['E'],
  shape: ['R'],
  note: ['N'],
  text: ['T'],
  link: ['L']
}

const DRAW_TOOLS: readonly DrawTool[] = ['pen', 'highlighter', 'eraser']
const isDrawTool = (tool: ToolId): tool is DrawTool => (DRAW_TOOLS as readonly ToolId[]).includes(tool)

const DRAW_ICONS = { pen: Pen, highlighter: Highlighter, eraser: Eraser } as const

/** Tools a flyout configures: it closes when another tool is picked (shortcut, context menu…). */
const FLYOUT_TOOLS: Partial<Record<FlyoutId, readonly ToolId[]>> = {
  draw: DRAW_TOOLS,
  shapes: ['shape'],
  note: ['note'],
  text: ['text'],
  link: ['link']
}

const TITLE_KEYS: Record<FlyoutId, string> = {
  dock: 'toolbar.dock.title',
  draw: 'toolbar.draw.title',
  cards: 'toolbar.cards.title',
  shapes: 'toolbar.shapes.title',
  note: 'toolbar.note.title',
  text: 'toolbar.text.title',
  link: 'toolbar.link.title'
}

const WIDE: ReadonlySet<FlyoutId> = new Set<FlyoutId>(['cards', 'link'])

const ICON = 20

/** The dock's buttons in order. The toolbar is one tab stop; arrow keys move between buttons. */
const dockItems = (dock: HTMLElement | null): HTMLButtonElement[] =>
  Array.from(dock?.querySelectorAll<HTMLButtonElement>('[data-tb-item]') ?? [])

/** New text boxes keep a readable default ink when the board theme changes (custom colours stay). */
function useThemedTextInk(): void {
  const theme = useBoard((s) => s.board?.theme ?? 'normal')
  useEffect(() => {
    const { color } = board().toolOptions.text
    const isDefaultInk = Object.values(TEXT_INK).some((ink) => sameColor(ink, color))
    if (isDefaultInk && !sameColor(color, TEXT_INK[theme])) board().setToolOptions('text', { color: TEXT_INK[theme] })
  }, [theme])
}

export function Toolbar() {
  const { t, i18n } = useTranslation()
  const { toolbarEdge: edge, animations } = useSettings()
  const tool = useBoard((s) => s.tool)
  const theme = useBoard((s) => s.board?.theme ?? 'normal')
  const canUndo = useBoard((s) => s.canUndo)
  const canRedo = useBoard((s) => s.canRedo)
  const penColor = useBoard((s) => s.toolOptions.pen.color)
  const highlighterColor = useBoard((s) => s.toolOptions.highlighter.color)
  const shapeKind = useBoard((s) => s.toolOptions.shape.kind)
  const noteColor = useBoard((s) => s.toolOptions.note.color)
  const drawerOpen = useBoard((s) => s.inspector !== null)
  useThemedTextInk()

  const uid = useId()
  const zoneRef = useRef<HTMLDivElement>(null)
  const dockRef = useRef<HTMLDivElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const anchors = useRef<Partial<Record<FlyoutId, HTMLElement | null>>>({})
  /** Button the user last focused in the dock (the toolbar's tab stop). */
  const tabStop = useRef<HTMLButtonElement | null>(null)

  const [open, setOpen] = useState<FlyoutId | null>(null)
  const [keyboardOpened, setKeyboardOpened] = useState(false)
  const [lastDraw, setLastDraw] = useState<DrawTool>('pen')
  const drawTool: DrawTool = isDrawTool(tool) ? tool : lastDraw

  useEffect(() => {
    if (isDrawTool(tool)) setLastDraw(tool)
  }, [tool])

  // A flyout configuring one tool closes when another tool is picked.
  useEffect(() => {
    const tools = open ? FLYOUT_TOOLS[open] : undefined
    if (tools && !tools.includes(tool)) setOpen(null)
  }, [open, tool])

  // ---------------------------------------------------------------------------
  // Docking

  const persistEdge = useCallback(
    (next: DockEdge) => {
      const session = useSession.getState()
      if (!session.user || session.user.settings.toolbarEdge === next) return
      session.updateSettings({ toolbarEdge: next }).catch(() => toast.error(t('toolbar.edge_failed')))
    },
    [t]
  )

  const drag = useDockDrag({
    dock: dockRef,
    zone: zoneRef,
    edge,
    animations,
    onStart: () => setOpen(null),
    onDrop: persistEdge
  })

  const chooseEdge = (next: DockEdge) => {
    if (next === edge) return
    drag.glideFromHere()
    persistEdge(next)
  }

  // ---------------------------------------------------------------------------
  // Flyouts

  const anchorRefs = useMemo(() => {
    const refs = {} as Record<FlyoutId, (el: HTMLElement | null) => void>
    for (const id of FLYOUTS) {
      refs[id] = (el) => {
        anchors.current[id] = el
      }
    }
    return refs
  }, [])
  const anchorOf = useCallback(() => (open ? (anchors.current[open] ?? null) : null), [open])
  const zoneOf = useCallback(() => zoneRef.current, [])

  /** Opens a flyout, or closes it when it is already open. Keyboard activation moves focus into it. */
  const toggle = (id: FlyoutId, e: ReactMouseEvent) => {
    setKeyboardOpened(e.detail === 0)
    setOpen((current) => (current === id ? null : id))
  }

  // Close on a press outside the panel and its button, and on Escape.
  useEffect(() => {
    if (!open) return
    const onPointerDown = (e: PointerEvent) => {
      const target = e.target
      if (!(target instanceof Node)) return
      if (panelRef.current?.contains(target) || anchors.current[open]?.contains(target)) return
      setOpen(null)
    }
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || e.defaultPrevented || isModalOpen()) return
      e.preventDefault()
      e.stopPropagation()
      const hadFocus = !!panelRef.current?.contains(document.activeElement)
      setOpen(null)
      if (hadFocus) anchors.current[open]?.focus({ preventScroll: true })
    }
    window.addEventListener('pointerdown', onPointerDown, true)
    window.addEventListener('keydown', onKeyDown, true)
    return () => {
      window.removeEventListener('pointerdown', onPointerDown, true)
      window.removeEventListener('keydown', onKeyDown, true)
    }
  }, [open])

  // Tabbing away from the toolbar and its panel closes the panel.
  const onZoneBlur = (e: ReactFocusEvent<HTMLDivElement>) => {
    const next = e.relatedTarget
    if (open && next instanceof Node && !e.currentTarget.contains(next)) setOpen(null)
  }

  // ---------------------------------------------------------------------------
  // Roving focus (WAI-ARIA toolbar pattern)

  useLayoutEffect(() => {
    const items = dockItems(dockRef.current)
    const enabled = items.filter((b) => !b.disabled)
    // Until the user focuses a button, the active tool is the toolbar's tab stop.
    const stop =
      tabStop.current && enabled.includes(tabStop.current)
        ? tabStop.current
        : (enabled.find((b) => b.getAttribute('aria-pressed') === 'true') ?? enabled[0] ?? null)
    for (const b of items) b.tabIndex = b === stop ? 0 : -1
  })

  const onDockFocus = (e: ReactFocusEvent<HTMLDivElement>) => {
    const target = e.target
    if (!(target instanceof HTMLButtonElement) || !target.hasAttribute('data-tb-item') || tabStop.current === target) return
    tabStop.current = target
    for (const b of dockItems(dockRef.current)) b.tabIndex = b === target ? 0 : -1
  }

  // A mouse click does not pull focus into the dock, so Space (temporary pan) and the other board
  // keys keep working instead of re-activating the clicked button. A text being edited still loses
  // focus, which commits it before the button acts.
  const onDockMouseDown = (e: ReactMouseEvent<HTMLDivElement>) => {
    if (isEditableTarget(document.activeElement)) return
    if (e.target instanceof Element && e.target.closest('[data-tb-item]')) e.preventDefault()
  }

  const onDockKeyDown = (e: ReactKeyboardEvent<HTMLDivElement>) => {
    const items = dockItems(dockRef.current).filter((b) => !b.disabled)
    const i = items.indexOf(document.activeElement as HTMLButtonElement)
    if (i < 0) return
    // A horizontal dock runs in the reading direction; a vertical one top to bottom.
    const rtl = !isVerticalEdge(edge) && getComputedStyle(e.currentTarget).direction === 'rtl'
    let next: number
    switch (e.key) {
      case 'ArrowDown':
        next = i + 1
        break
      case 'ArrowUp':
        next = i - 1
        break
      case 'ArrowRight':
        next = rtl ? i - 1 : i + 1
        break
      case 'ArrowLeft':
        next = rtl ? i + 1 : i - 1
        break
      case 'Home':
        next = 0
        break
      case 'End':
        next = items.length - 1
        break
      default:
        return
    }
    e.preventDefault()
    items[(next + items.length) % items.length].focus()
  }

  // ---------------------------------------------------------------------------
  // Actions

  const pickTool = (next: ToolId) => {
    board().setTool(next)
    setOpen(null)
  }

  /** Buttons whose tool has options: activate the tool and toggle its panel. */
  const toolWithPanel = (next: ToolId, id: FlyoutId) => (e: ReactMouseEvent) => {
    board().setTool(next)
    toggle(id, e)
  }

  const onDraw = (e: ReactMouseEvent) => {
    if (!isDrawTool(board().tool)) board().setTool(lastDraw)
    toggle('draw', e)
  }

  const onGripClick = (e: ReactMouseEvent) => {
    if (drag.consumeDragClick()) return
    toggle('dock', e)
  }

  const onPlace = (id: PlaceableId) => {
    setOpen(null)
    place(id)
  }

  // ---------------------------------------------------------------------------

  const vertical = isVerticalEdge(edge)
  const drawerSide = drawerOpen ? (i18n.dir() === 'rtl' ? 'left' : 'right') : undefined
  const flyout = (id: FlyoutId) => ({ id: `${uid}-${id}`, open: open === id })
  const DrawIcon = DRAW_ICONS[drawTool]
  const drawLabel = t('toolbar.tool.draw_current', { tool: t(`toolbar.tool.${drawTool}`) })
  const drawSwatch = drawTool === 'pen' ? penColor : drawTool === 'highlighter' ? highlighterColor : undefined
  const preview = drag.preview

  return (
    <div className="tb-root" data-motion={motionAllowed(animations) ? undefined : 'off'}>
      <div ref={zoneRef} className="tb-zone" data-drawer={drawerSide} onBlur={onZoneBlur}>
        {preview && (
          <>
            <div className={`tb-drop tb-drop--${preview.target}`} aria-hidden="true" />
            <div
              className={`tb-ghost tb-ghost--${preview.target}`}
              style={{ width: preview.w, height: preview.h }}
              aria-hidden="true"
            />
          </>
        )}

        <div
          ref={dockRef}
          className={`tb-dock tb-dock--${edge}${preview ? ' is-dragging' : ''}`}
          role="toolbar"
          aria-label={t('toolbar.label')}
          aria-orientation={vertical ? 'vertical' : 'horizontal'}
          onKeyDown={onDockKeyDown}
          onFocus={onDockFocus}
          onMouseDown={onDockMouseDown}
        >
          <button
            ref={anchorRefs.dock}
            type="button"
            className="tb-grip"
            data-tb-item=""
            aria-label={t('toolbar.grip')}
            aria-haspopup="dialog"
            aria-expanded={open === 'dock'}
            aria-controls={open === 'dock' ? `${uid}-dock` : undefined}
            onClick={onGripClick}
            {...drag.grip}
          >
            {vertical ? <GripHorizontal size={18} aria-hidden="true" /> : <GripVertical size={18} aria-hidden="true" />}
            <span className="tb-tip" aria-hidden="true">
              <span>{t('toolbar.grip')}</span>
            </span>
          </button>

          <ToolButton
            label={t('toolbar.tool.select')}
            icon={<MousePointer2 size={ICON} aria-hidden="true" />}
            keys={TOOL_KEYS.select}
            pressed={tool === 'select'}
            onClick={() => pickTool('select')}
          />
          <ToolButton
            label={t('toolbar.tool.hand')}
            icon={<Hand size={ICON} aria-hidden="true" />}
            keys={TOOL_KEYS.hand}
            pressed={tool === 'hand'}
            onClick={() => pickTool('hand')}
          />

          <span className="tb-sep" aria-hidden="true" />

          <ToolButton
            label={drawLabel}
            icon={<DrawIcon size={ICON} aria-hidden="true" />}
            keys={TOOL_KEYS[drawTool]}
            pressed={isDrawTool(tool)}
            flyout={flyout('draw')}
            swatch={drawSwatch}
            onClick={onDraw}
            buttonRef={anchorRefs.draw}
          />
          <ToolButton
            label={t('toolbar.tool.cards')}
            icon={<IdCard size={ICON} aria-hidden="true" />}
            flyout={flyout('cards')}
            onClick={(e) => toggle('cards', e)}
            buttonRef={anchorRefs.cards}
          />
          <ToolButton
            label={t('toolbar.tool.shapes')}
            icon={<ShapeIcon kind={shapeKind} size={ICON} />}
            keys={TOOL_KEYS.shape}
            pressed={tool === 'shape'}
            flyout={flyout('shapes')}
            onClick={toolWithPanel('shape', 'shapes')}
            buttonRef={anchorRefs.shapes}
          />
          <ToolButton
            label={t('toolbar.tool.note')}
            icon={<StickyNote size={ICON} aria-hidden="true" />}
            keys={TOOL_KEYS.note}
            pressed={tool === 'note'}
            flyout={flyout('note')}
            swatch={NOTE_PAPER[theme][noteColor]}
            onClick={toolWithPanel('note', 'note')}
            buttonRef={anchorRefs.note}
          />
          <ToolButton
            label={t('toolbar.tool.text')}
            icon={<Type size={ICON} aria-hidden="true" />}
            keys={TOOL_KEYS.text}
            pressed={tool === 'text'}
            flyout={flyout('text')}
            onClick={toolWithPanel('text', 'text')}
            buttonRef={anchorRefs.text}
          />
          <ToolButton
            label={t('toolbar.tool.link')}
            icon={<Spline size={ICON} aria-hidden="true" />}
            keys={TOOL_KEYS.link}
            pressed={tool === 'link'}
            flyout={flyout('link')}
            onClick={toolWithPanel('link', 'link')}
            buttonRef={anchorRefs.link}
          />

          <span className="tb-sep" aria-hidden="true" />

          <ToolButton
            label={t('toolbar.tool.undo')}
            icon={<Undo2 size={ICON} aria-hidden="true" />}
            keys={KEYS.undo}
            disabled={!canUndo}
            onClick={() => board().undo()}
          />
          <ToolButton
            label={t('toolbar.tool.redo')}
            icon={<Redo2 size={ICON} aria-hidden="true" />}
            keys={KEYS.redo}
            disabled={!canRedo}
            onClick={() => board().redo()}
          />
        </div>

        {open && (
          <Flyout
            key={open}
            id={`${uid}-${open}`}
            title={t(TITLE_KEYS[open])}
            anchor={anchorOf}
            root={zoneOf}
            edge={edge}
            wide={WIDE.has(open)}
            autoFocus={keyboardOpened}
            panelRef={panelRef}
          >
            {open === 'dock' && <DockPanel edge={edge} onChange={chooseEdge} />}
            {open === 'draw' && <DrawPanel tool={drawTool} />}
            {open === 'cards' && <CardsPanel onPick={onPlace} />}
            {open === 'shapes' && <ShapesPanel />}
            {open === 'note' && <NotePanel />}
            {open === 'text' && <TextPanel />}
            {open === 'link' && <LinkPanel />}
          </Flyout>
        )}
      </div>
    </div>
  )
}
