import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { FilePlus2, RefreshCw } from 'lucide-react'
import type { BoardRecord, BoardTheme, CaseRecord, Id } from '@shared/types'
import { AppHeader } from '@renderer/components/AppHeader'
import { ConfirmDialog } from '@renderer/components/ui/Modal'
import { toast } from '@renderer/components/ui/toast'
import { ApiError, api, call, errorMessage } from '@renderer/lib/api'
import { useNav } from '@renderer/stores/nav'
import { useSettings } from '@renderer/stores/session'
import { BoardEditorModal, type BoardEditorMode } from './BoardEditorModal'
import { BOARD_GRID_ITEM, BoardTile, BoardTileSkeleton, NewBoardTile } from './BoardTile'
import { CaseEditorModal } from './CaseEditorModal'
import { CaseSummary, CaseSummarySkeleton } from './CaseSummary'
import { EmptyState } from './EmptyState'
import { useGridKeyboard, useNow, useReturnFocus, useStableCallback } from './hooks'
import { useCaseBoards, useCases } from './store'
import './cases.css'
import './CaseScreen.css'

const SKELETONS = 3

type PendingDelete = { kind: 'case'; record: CaseRecord } | { kind: 'board'; board: BoardRecord } | null

const isNotFound = (err: unknown): boolean => err instanceof ApiError && err.code === 'not_found'

/** One case: its dossier and its evidence boards. Keyed by case so no state leaks between cases. */
export function CaseScreen({ caseId }: { caseId: Id }) {
  return <CaseView key={caseId} caseId={caseId} />
}

function CaseView({ caseId }: { caseId: Id }) {
  const { t } = useTranslation()
  const now = useNow()
  const { defaultBoardTheme } = useSettings()
  const record = useCases((s) => s.cases.find((c) => c.id === caseId) ?? null)
  const cachedBoards = useCaseBoards((s) => s.byCase[caseId])

  const [failed, setFailed] = useState(false)
  const [caseEditorOpen, setCaseEditorOpen] = useState(false)
  const [boardEditor, setBoardEditor] = useState<BoardEditorMode | null>(null)
  const [pendingDelete, setPendingDelete] = useState<PendingDelete>(null)
  const [deleting, setDeleting] = useState(false)
  const alive = useRef(false)
  const left = useRef(false)
  const gridRef = useRef<HTMLUListElement>(null)
  const newButtonRef = useRef<HTMLButtonElement>(null)
  const { remember, restore } = useReturnFocus()
  const onGridKeyDown = useGridKeyboard(BOARD_GRID_ITEM)

  const boards = useMemo(
    () => (cachedBoards ? [...cachedBoards].sort((a, b) => b.updatedAt - a.updatedAt || b.createdAt - a.createdAt) : null),
    [cachedBoards]
  )

  const goCases = () => useNav.getState().go({ name: 'cases' })
  const openBoard = (board: BoardRecord) => useNav.getState().go({ name: 'board', caseId, boardId: board.id })

  /** The case is gone (deleted elsewhere or never existed): explain once and return to the library. */
  const leave = useStableCallback(() => {
    if (left.current || !alive.current) return
    left.current = true
    const route = useNav.getState().route
    if (route.name !== 'case' || route.caseId !== caseId) return
    toast.error(t('cases.case.notFound'))
    goCases()
  })

  const load = useStableCallback(async () => {
    setFailed(false)
    const [cases, list] = await Promise.allSettled([useCases.getState().load(), call(api.boards.list({ caseId }))])
    if (!alive.current) return
    if (list.status === 'rejected' && isNotFound(list.reason)) return leave()
    if (list.status === 'fulfilled') useCaseBoards.getState().set(caseId, list.value)

    // boards.list proved the case exists; a library response that predates its creation needs one more read.
    if (cases.status === 'fulfilled' && !cases.value.some((c) => c.id === caseId)) {
      try {
        const fresh = await useCases.getState().load()
        if (!alive.current) return
        if (!fresh.some((c) => c.id === caseId)) return leave()
      } catch {
        if (alive.current) setFailed(true)
        return
      }
    }

    const error = cases.status === 'rejected' ? cases.reason : list.status === 'rejected' ? list.reason : null
    if (error === null) return
    const hasCase = useCases.getState().cases.some((c) => c.id === caseId)
    const hasBoards = useCaseBoards.getState().byCase[caseId] !== undefined
    // Cached data stays usable, so a toast is enough; otherwise the page explains it with a retry.
    if (hasCase && hasBoards) toast.error(errorMessage(t, error))
    else setFailed(true)
  })

  useEffect(() => {
    alive.current = true
    void load()
    return () => {
      alive.current = false
    }
  }, [load])

  const modalOpen = caseEditorOpen || boardEditor !== null || pendingDelete !== null

  const startNewBoard = useStableCallback(() => {
    remember()
    setBoardEditor({ kind: 'create', caseId, theme: defaultBoardTheme })
  })

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (modalOpen || e.defaultPrevented || !(e.ctrlKey || e.metaKey) || e.altKey || e.shiftKey) return
      if (e.key.toLowerCase() === 'n' && boards !== null) {
        e.preventDefault()
        startNewBoard()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [modalOpen, boards, startNewBoard])

  const focusFallback = () => gridRef.current?.querySelector<HTMLElement>(BOARD_GRID_ITEM) ?? newButtonRef.current

  /** Mirrors the server, which bumps the case's activity time whenever one of its boards changes. */
  const touchCase = () => {
    const current = useCases.getState().cases.find((c) => c.id === caseId)
    if (!current) return
    const list = useCaseBoards.getState().byCase[caseId]
    useCases.getState().upsert({ ...current, updatedAt: Date.now(), boardCount: list?.length ?? current.boardCount })
  }

  // ---------- Case actions ----------

  const editCase = () => {
    remember()
    setCaseEditorOpen(true)
  }

  const closeCaseEditor = useStableCallback(() => {
    setCaseEditorOpen(false)
    restore(focusFallback)
  })

  const onCaseSaved = (saved: CaseRecord) => {
    useCases.getState().upsert(saved)
    setCaseEditorOpen(false)
    toast.success(t('cases.toast.updated'))
    restore(focusFallback)
  }

  // ---------- Board actions ----------

  const renameBoard = (board: BoardRecord) => {
    remember()
    setBoardEditor({ kind: 'rename', board })
  }

  const closeBoardEditor = useStableCallback(() => {
    setBoardEditor(null)
    restore(focusFallback)
  })

  const onBoardSaved = (board: BoardRecord, created: boolean) => {
    useCaseBoards.getState().upsert(board)
    touchCase()
    setBoardEditor(null)
    if (created) {
      toast.success(t('cases.toast.boardCreated', { title: board.title }))
      openBoard(board)
    } else {
      toast.success(t('cases.toast.boardRenamed'))
      restore(focusFallback)
    }
  }

  const changeTheme = async (board: BoardRecord, theme: BoardTheme) => {
    // Optimistic: the preview switches immediately and rolls back if the save fails.
    useCaseBoards.getState().upsert({ ...board, theme })
    try {
      const saved = await call(api.boards.update({ id: board.id, theme }))
      useCaseBoards.getState().upsert(saved)
      touchCase()
      toast.success(t('cases.toast.themeChanged', { theme: t(`cases.themes.${theme}`) }))
    } catch (err) {
      const current = useCaseBoards.getState().byCase[caseId]?.find((b) => b.id === board.id)
      if (current) useCaseBoards.getState().upsert({ ...current, theme: board.theme })
      toast.error(errorMessage(t, err))
    }
  }

  // ---------- Deletion ----------

  const askDelete = (target: NonNullable<PendingDelete>) => {
    remember()
    setPendingDelete(target)
  }

  const cancelDelete = useStableCallback(() => {
    if (deleting) return
    setPendingDelete(null)
    restore(focusFallback)
  })

  const confirmDelete = useStableCallback(async () => {
    const target = pendingDelete
    if (!target || deleting) return
    setDeleting(true)
    if (target.kind === 'case') {
      try {
        await call(api.cases.remove({ id: target.record.id }))
        left.current = true
        useCases.getState().drop(target.record.id)
        toast.success(t('cases.toast.deleted', { title: target.record.title }))
        goCases()
      } catch (err) {
        toast.error(errorMessage(t, err))
        setDeleting(false)
        setPendingDelete(null)
        restore(focusFallback)
      }
      return
    }
    try {
      await call(api.boards.remove({ id: target.board.id }))
      useCaseBoards.getState().drop(caseId, target.board.id)
      touchCase()
      toast.success(t('cases.toast.boardDeleted', { title: target.board.title }))
    } catch (err) {
      toast.error(errorMessage(t, err))
    } finally {
      setDeleting(false)
      setPendingDelete(null)
      restore(focusFallback)
    }
  })

  // ---------- Render ----------

  const retry = (
    <button type="button" className="btn" onClick={() => void load()}>
      <RefreshCw size={16} aria-hidden="true" />
      {t('cases.library.retry')}
    </button>
  )

  let boardsContent: ReactNode
  if (boards === null) {
    boardsContent = failed ? (
      <EmptyState art="error" title={t('cases.case.boardsErrorTitle')} text={t('cases.case.boardsErrorText')} action={retry} />
    ) : (
      <ul className="cases-grid cases-grid--boards" aria-busy="true" aria-label={t('common.loading')}>
        {Array.from({ length: SKELETONS }, (_, i) => (
          <BoardTileSkeleton key={i} />
        ))}
      </ul>
    )
  } else if (boards.length === 0) {
    boardsContent = (
      <EmptyState
        art="boards"
        title={t('cases.case.emptyTitle')}
        text={t('cases.case.emptyText')}
        action={
          <button type="button" className="btn btn--primary" onClick={startNewBoard}>
            <FilePlus2 size={16} aria-hidden="true" />
            {t('cases.case.emptyCta')}
          </button>
        }
      />
    )
  } else {
    boardsContent = (
      <ul
        ref={gridRef}
        className="cases-grid cases-grid--boards"
        aria-label={t('cases.case.gridLabel')}
        onKeyDown={onGridKeyDown}
      >
        {boards.map((board) => (
          <BoardTile
            key={board.id}
            board={board}
            now={now}
            onOpen={openBoard}
            onRename={renameBoard}
            onTheme={(b, theme) => void changeTheme(b, theme)}
            onDelete={(b) => askDelete({ kind: 'board', board: b })}
          />
        ))}
        <NewBoardTile onCreate={startNewBoard} />
      </ul>
    )
  }

  let content: ReactNode
  if (record === null && failed) {
    content = (
      <EmptyState
        art="error"
        title={t('cases.case.errorTitle')}
        text={t('cases.case.errorText')}
        action={
          <>
            {retry}
            <button type="button" className="btn btn--ghost" onClick={goCases}>
              {t('cases.case.backToLibrary')}
            </button>
          </>
        }
      />
    )
  } else {
    content = (
      <div className="cases-case">
        <aside className="cases-case__aside" aria-label={t('cases.case.summaryLabel')}>
          {record ? (
            <CaseSummary
              record={record}
              boardCount={boards?.length ?? record.boardCount}
              now={now}
              onEdit={editCase}
              onDelete={() => askDelete({ kind: 'case', record })}
            />
          ) : (
            <CaseSummarySkeleton />
          )}
        </aside>

        <section className="cases-case__boards" aria-labelledby="cases-boards-title">
          <div className="cases-boards__head">
            <div className="cases-boards__heading">
              <p className="cases-eyebrow">{t('cases.case.boardsEyebrow')}</p>
              <div className="cases-boards__title-row">
                <h2 id="cases-boards-title" className="cases-boards__title">
                  {t('cases.case.boardsTitle')}
                </h2>
                {boards !== null && boards.length > 0 && (
                  <span className="cases-boards__count" aria-hidden="true">
                    {boards.length}
                  </span>
                )}
              </div>
              <p className="cases-boards__sub">{t('cases.case.boardsSubtitle')}</p>
            </div>
            {boards !== null && boards.length > 0 && (
              <button
                ref={newButtonRef}
                type="button"
                className="btn btn--primary cases-boards__new"
                onClick={startNewBoard}
                aria-keyshortcuts="Control+N"
                title={t('cases.case.newBoardShortcut')}
              >
                <FilePlus2 size={17} aria-hidden="true" />
                {t('cases.case.newBoard')}
              </button>
            )}
          </div>
          {boardsContent}
        </section>
      </div>
    )
  }

  return (
    <div className="cases-page">
      <AppHeader
        crumbs={[{ label: t('cases.library.crumb'), onClick: goCases }, { label: record?.title ?? t('common.loading') }]}
      />
      <main className="cases-scroll">
        <div className="cases-container cases-container--case">{content}</div>
      </main>

      {caseEditorOpen && record && <CaseEditorModal record={record} onClose={closeCaseEditor} onSaved={onCaseSaved} />}

      {boardEditor && <BoardEditorModal mode={boardEditor} onClose={closeBoardEditor} onSaved={onBoardSaved} />}

      <ConfirmDialog
        open={pendingDelete !== null}
        title={pendingDelete?.kind === 'board' ? t('cases.confirm.deleteBoardTitle') : t('cases.confirm.deleteCaseTitle')}
        message={
          pendingDelete?.kind === 'board'
            ? t('cases.confirm.deleteBoardText', { title: pendingDelete.board.title, count: pendingDelete.board.itemCount })
            : t('cases.confirm.deleteCaseText', {
                title: pendingDelete?.record.title ?? '',
                count: boards?.length ?? pendingDelete?.record.boardCount ?? 0
              })
        }
        confirmLabel={
          deleting
            ? t('cases.confirm.deleting')
            : pendingDelete?.kind === 'board'
              ? t('cases.confirm.deleteBoard')
              : t('cases.confirm.deleteCase')
        }
        cancelLabel={t('common.cancel')}
        danger
        onConfirm={() => void confirmDelete()}
        onCancel={cancelDelete}
      />
    </div>
  )
}
