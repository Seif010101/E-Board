import '@renderer/features/board/core/theme.css'
import '@renderer/features/board/plugins'
import { useCallback, useEffect, useRef, useState, type MouseEvent as ReactMouseEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { ArrowLeft, RotateCw, TriangleAlert } from 'lucide-react'
import type { Id } from '@shared/types'
import i18n from '@renderer/i18n'
import { api, ApiError, call, errorMessage } from '@renderer/lib/api'
import { toast } from '@renderer/components/ui/toast'
import { AppHeader, type Crumb } from '@renderer/components/AppHeader'
import { useNav } from '@renderer/stores/nav'
import { useSession } from '@renderer/stores/session'
import { Toolbar } from '@renderer/features/board/toolbar/Toolbar'
import { InspectorHost } from '@renderer/features/board/inspector/InspectorHost'
import { board, hasUnsavedChanges, useBoard } from './core/store'
import { flush, startPersistence } from './core/persistence'
import { BoardCanvas } from './canvas/BoardCanvas'
import { ContextMenu } from './canvas/ContextMenu'
import { ZoomControls } from './canvas/ZoomControls'
import { Minimap } from './canvas/Minimap'
import { ShortcutsDialog } from './canvas/ShortcutsDialog'
import { BoardActions, BoardTitleEditor, ThemeSwitcher } from './canvas/BoardChrome'
import { useCanvasUi } from './canvas/uiStore'
import { BoardSearch } from './search/BoardSearch'
import { resetSearch } from './search/searchStore'
import './BoardScreen.css'

interface Props {
  caseId: Id
  boardId: Id
}

type Phase = { kind: 'loading' } | { kind: 'ready' } | { kind: 'error'; message: string }

/**
 * The previous board's final save, when one is still running. Opening the next board waits for
 * it so the save always reads the board it belongs to.
 */
let closing: Promise<void> | null = null

/**
 * Loads the board into the store and keeps it saved while mounted. Unsaved changes whose final
 * save failed (e.g. the app locked meanwhile) are kept in memory and saved on the next visit.
 */
function useBoardSession(boardId: Id, caseId: Id, attempt: number): Phase {
  const [phase, setPhase] = useState<Phase>({ kind: 'loading' })

  useEffect(() => {
    let cancelled = false
    let stop: (() => Promise<void>) | null = null
    setPhase({ kind: 'loading' })

    const open = async () => {
      if (closing) await closing
      if (cancelled) return
      const kept = board().board
      if (kept?.id === boardId && hasUnsavedChanges()) {
        stop = startPersistence()
        void flush()
        setPhase({ kind: 'ready' })
        return
      }
      // Another board's changes are still pending: one more attempt before they are replaced.
      if (kept && hasUnsavedChanges()) await flush()
      if (cancelled) return
      try {
        const bundle = await call(api.boards.load({ id: boardId }))
        if (cancelled) return
        board().load(bundle)
        stop = startPersistence()
        setPhase({ kind: 'ready' })
      } catch (err) {
        if (cancelled) return
        if (err instanceof ApiError && err.code === 'not_found') {
          toast.error(i18n.t('board.not_found'))
          useNav.getState().go({ name: 'case', caseId })
          return
        }
        setPhase({ kind: 'error', message: errorMessage(i18n.t, err) })
      }
    }
    void open()

    return () => {
      cancelled = true
      resetSearch()
      useCanvasUi.getState().reset()
      const end = stop
      if (!end) return
      const done = end()
        .catch(() => undefined)
        .then(() => {
          const keep =
            useSession.getState().status === 'authenticated' && board().board?.id === boardId && hasUnsavedChanges()
          if (!keep && board().board?.id === boardId) board().reset()
        })
      closing = done
      void done.finally(() => {
        if (closing === done) closing = null
      })
    }
  }, [boardId, caseId, attempt])

  return phase
}

const TITLE_CRUMB = '[aria-current="page"]'

export function BoardScreen({ caseId, boardId }: Props) {
  const { t } = useTranslation()
  const [attempt, setAttempt] = useState(0)
  const phase = useBoardSession(boardId, caseId, attempt)
  const ready = phase.kind === 'ready'
  const title = useBoard((s) => (ready ? s.board?.title : undefined))
  const caseTitle = useBoard((s) => (ready ? s.caseRecord?.title : undefined))
  const theme = useBoard((s) => s.board?.theme ?? 'normal')
  const renaming = useCanvasUi((s) => s.renaming)
  const headRef = useRef<HTMLDivElement>(null)

  const goCases = () => useNav.getState().go({ name: 'cases' })
  const goCase = () => useNav.getState().go({ name: 'case', caseId })

  const crumbs: Crumb[] = [{ label: t('board.crumb_cases'), onClick: goCases }]
  if (caseTitle !== undefined) crumbs.push({ label: caseTitle, onClick: goCase })
  if (title !== undefined) crumbs.push({ label: title })

  // The board title crumb renames on double-click (AppHeader renders it as the current page).
  const onHeadDoubleClick = (e: ReactMouseEvent) => {
    if (ready && e.target instanceof Element && e.target.closest(TITLE_CRUMB)) useCanvasUi.getState().setRenaming(true)
  }
  const titleAnchor = useCallback(() => headRef.current?.querySelector(TITLE_CRUMB) ?? null, [])

  return (
    <div className="bs-screen">
      <div ref={headRef} className={`bs-head${ready ? ' is-ready' : ''}`} onDoubleClick={onHeadDoubleClick}>
        <AppHeader crumbs={crumbs} center={ready ? <ThemeSwitcher /> : undefined} actions={ready ? <BoardActions /> : undefined} />
      </div>

      {phase.kind === 'loading' && (
        <div className="bs-state" role="status" aria-live="polite">
          <div className="spinner" aria-hidden="true" />
          <span>{t('board.loading')}</span>
        </div>
      )}

      {phase.kind === 'error' && (
        <div className="bs-state" role="alert">
          <TriangleAlert className="bs-state__icon" size={28} aria-hidden="true" />
          <h2 className="bs-state__title">{t('board.load_failed')}</h2>
          <p className="bs-state__text">{phase.message}</p>
          <div className="bs-state__actions">
            <button type="button" className="btn" onClick={goCase}>
              <ArrowLeft className="bs-flip" size={16} aria-hidden="true" />
              {t('board.back_to_case')}
            </button>
            <button type="button" className="btn btn--primary" onClick={() => setAttempt((n) => n + 1)}>
              <RotateCw size={16} aria-hidden="true" />
              {t('board.retry')}
            </button>
          </div>
        </div>
      )}

      {ready && (
        <div className="board bs-board" data-board-theme={theme}>
          <BoardCanvas />
          <Toolbar />
          <InspectorHost />
          <ZoomControls />
          <Minimap />
          <BoardSearch />
          <ContextMenu />
        </div>
      )}

      {ready && renaming && <BoardTitleEditor anchor={titleAnchor} />}
      {ready && <ShortcutsDialog />}
    </div>
  )
}
