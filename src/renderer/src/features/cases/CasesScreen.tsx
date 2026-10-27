import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { ArrowUpDown, FolderPlus, RefreshCw, Search, X } from 'lucide-react'
import type { CaseRecord, CaseStatus } from '@shared/types'
import { AppHeader } from '@renderer/components/AppHeader'
import { ConfirmDialog } from '@renderer/components/ui/Modal'
import { toast } from '@renderer/components/ui/toast'
import { api, call, errorMessage } from '@renderer/lib/api'
import { useNav } from '@renderer/stores/nav'
import { CaseEditorModal } from './CaseEditorModal'
import { CaseFolder, CaseFolderSkeleton } from './CaseFolder'
import { EmptyState } from './EmptyState'
import { useGridKeyboard, useNow, useReturnFocus, useStableCallback } from './hooks'
import { CASE_SORTS, CASE_STATUSES, filterCases, intlLocale, searchKey, type CaseSort, type StatusFilter } from './meta'
import { StatusDot } from './parts'
import { useCases } from './store'
import './cases.css'

const SEARCH_MAX = 120
const SKELETONS = 6
const FOLDER_SELECTOR = '.cases-folder__open'

/** null = closed, { record: null } = create, { record } = edit. */
type EditorState = { record: CaseRecord | null } | null

export function CasesScreen() {
  const { t, i18n } = useTranslation()
  const locale = intlLocale(i18n.language)
  const cases = useCases((s) => s.cases)
  const status = useCases((s) => s.status)
  const query = useCases((s) => s.query)
  const statusFilter = useCases((s) => s.statusFilter)
  const sort = useCases((s) => s.sort)
  const now = useNow()

  const [editor, setEditor] = useState<EditorState>(null)
  const [pendingDelete, setPendingDelete] = useState<CaseRecord | null>(null)
  const [deleting, setDeleting] = useState(false)
  const searchRef = useRef<HTMLInputElement>(null)
  const gridRef = useRef<HTMLUListElement>(null)
  const newButtonRef = useRef<HTMLButtonElement>(null)
  const { remember, restore } = useReturnFocus()
  const onGridKeyDown = useGridKeyboard(FOLDER_SELECTOR)

  const load = useStableCallback(() => {
    useCases
      .getState()
      .load()
      .catch((err: unknown) => {
        // With cached folders on screen a toast is enough; otherwise the error state explains it.
        if (useCases.getState().status === 'ready') toast.error(errorMessage(t, err))
      })
  })

  useEffect(() => {
    load()
  }, [load])

  const modalOpen = editor !== null || pendingDelete !== null

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (modalOpen || e.defaultPrevented || !(e.ctrlKey || e.metaKey) || e.altKey || e.shiftKey) return
      const key = e.key.toLowerCase()
      if (key === 'f' && searchRef.current) {
        e.preventDefault()
        searchRef.current.focus()
        searchRef.current.select()
      } else if (key === 'n') {
        e.preventDefault()
        remember()
        setEditor({ record: null })
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [modalOpen, remember])

  // Status counts follow the search text so the filter shows what each choice would reveal.
  const counts = useMemo(() => {
    const matching = filterCases(cases, query, 'all', 'updated', locale)
    const byStatus: Record<StatusFilter, number> = { all: matching.length, open: 0, active: 0, closed: 0, archived: 0 }
    for (const c of matching) byStatus[c.status]++
    return byStatus
  }, [cases, query, locale])

  const visible = useMemo(
    () => filterCases(cases, query, statusFilter, sort, locale),
    [cases, query, statusFilter, sort, locale]
  )

  const inProgress = useMemo(() => cases.filter((c) => c.status === 'open' || c.status === 'active').length, [cases])
  const filtering = searchKey(query).trim() !== '' || statusFilter !== 'all'
  const showSkeleton = cases.length === 0 && (status === 'idle' || status === 'loading')

  const store = useCases.getState()
  const focusFallback = () => gridRef.current?.querySelector<HTMLElement>(FOLDER_SELECTOR) ?? newButtonRef.current

  const openCase = (record: CaseRecord) => useNav.getState().go({ name: 'case', caseId: record.id })

  const openEditor = (record: CaseRecord | null) => {
    remember()
    setEditor({ record })
  }

  const closeEditor = useStableCallback(() => {
    setEditor(null)
    restore(focusFallback)
  })

  const onSaved = (record: CaseRecord, created: boolean) => {
    store.upsert(record)
    setEditor(null)
    if (created) {
      toast.success(t('cases.toast.created', { title: record.title }))
      openCase(record)
    } else {
      toast.success(t('cases.toast.updated'))
      restore(focusFallback)
    }
  }

  const changeStatus = async (record: CaseRecord, next: CaseStatus) => {
    // Optimistic: the folder re-inks immediately and rolls back if the save fails.
    store.upsert({ ...record, status: next })
    try {
      const saved = await call(api.cases.update({ id: record.id, status: next }))
      useCases.getState().upsert(saved)
      toast.success(t('cases.toast.statusChanged', { status: t(`cases.status.${next}`) }))
    } catch (err) {
      const current = useCases.getState().cases.find((c) => c.id === record.id)
      if (current) useCases.getState().upsert({ ...current, status: record.status })
      toast.error(errorMessage(t, err))
    }
  }

  const askDelete = (record: CaseRecord) => {
    remember()
    setPendingDelete(record)
  }

  const cancelDelete = useStableCallback(() => {
    if (deleting) return
    setPendingDelete(null)
    restore(focusFallback)
  })

  const confirmDelete = useStableCallback(async () => {
    const record = pendingDelete
    if (!record || deleting) return
    setDeleting(true)
    try {
      await call(api.cases.remove({ id: record.id }))
      useCases.getState().drop(record.id)
      toast.success(t('cases.toast.deleted', { title: record.title }))
    } catch (err) {
      toast.error(errorMessage(t, err))
    } finally {
      setDeleting(false)
      setPendingDelete(null)
      restore(focusFallback)
    }
  })

  const clearFilters = () => {
    store.setQuery('')
    store.setStatusFilter('all')
    searchRef.current?.focus()
  }

  let content: ReactNode
  if (showSkeleton) {
    content = (
      <ul className="cases-grid" aria-busy="true" aria-label={t('common.loading')}>
        {Array.from({ length: SKELETONS }, (_, i) => (
          <CaseFolderSkeleton key={i} />
        ))}
      </ul>
    )
  } else if (cases.length === 0 && status === 'error') {
    content = (
      <EmptyState
        art="error"
        title={t('cases.library.errorTitle')}
        text={t('cases.library.errorText')}
        action={
          <button type="button" className="btn" onClick={load}>
            <RefreshCw size={16} aria-hidden="true" />
            {t('cases.library.retry')}
          </button>
        }
      />
    )
  } else if (cases.length === 0) {
    content = (
      <EmptyState
        art="cases"
        title={t('cases.library.emptyTitle')}
        text={t('cases.library.emptyText')}
        action={
          <button type="button" className="btn btn--primary" onClick={() => openEditor(null)}>
            <FolderPlus size={16} aria-hidden="true" />
            {t('cases.library.emptyCta')}
          </button>
        }
      />
    )
  } else if (visible.length === 0) {
    content = (
      <EmptyState
        art="search"
        title={t('cases.library.noResultsTitle')}
        text={t('cases.library.noResultsText')}
        action={
          <button type="button" className="btn" onClick={clearFilters}>
            <X size={16} aria-hidden="true" />
            {t('cases.library.clearFilters')}
          </button>
        }
      />
    )
  } else {
    content = (
      <ul
        ref={gridRef}
        className="cases-grid"
        aria-label={t('cases.library.gridLabel')}
        onKeyDown={onGridKeyDown}
      >
        {visible.map((record) => (
          <CaseFolder
            key={record.id}
            record={record}
            now={now}
            onOpen={openCase}
            onEdit={openEditor}
            onDelete={askDelete}
            onStatus={(r, s) => void changeStatus(r, s)}
          />
        ))}
      </ul>
    )
  }

  return (
    <div className="cases-page">
      <AppHeader crumbs={[{ label: t('cases.library.crumb') }]} />
      <main className="cases-scroll">
        <div className="cases-container">
          <section className="cases-hero" aria-labelledby="cases-library-title">
            <div className="cases-hero__text">
              <p className="cases-eyebrow">{t('cases.library.eyebrow')}</p>
              <h1 id="cases-library-title" className="cases-hero__title">
                {t('cases.library.title')}
              </h1>
              <p className="cases-hero__sub">
                {cases.length > 0
                  ? `${t('cases.library.total', { count: cases.length })} · ${t('cases.library.inProgress', { count: inProgress })}`
                  : t('cases.library.subtitle')}
              </p>
            </div>
            <button
              ref={newButtonRef}
              type="button"
              className="btn btn--primary cases-hero__new"
              onClick={() => openEditor(null)}
              aria-keyshortcuts="Control+N"
              title={t('cases.library.newHint')}
            >
              <FolderPlus size={17} aria-hidden="true" />
              {t('cases.library.new')}
            </button>
          </section>

          {cases.length > 0 && (
            <div className="cases-toolbar" role="search">
              <div className="cases-search">
                <Search className="cases-search__icon" size={16} aria-hidden="true" />
                <input
                  ref={searchRef}
                  type="search"
                  className="input cases-search__input"
                  value={query}
                  maxLength={SEARCH_MAX}
                  placeholder={t('cases.library.searchPlaceholder')}
                  aria-label={t('cases.library.searchLabel')}
                  aria-keyshortcuts="Control+F"
                  autoComplete="off"
                  spellCheck={false}
                  onChange={(e) => store.setQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Escape' && query !== '') {
                      e.preventDefault()
                      store.setQuery('')
                    } else if (e.key === 'ArrowDown' || (e.key === 'Enter' && visible.length > 0)) {
                      const first = gridRef.current?.querySelector<HTMLElement>(FOLDER_SELECTOR)
                      if (first) {
                        e.preventDefault()
                        first.focus()
                      }
                    }
                  }}
                />
                {query !== '' && (
                  <button
                    type="button"
                    className="icon-btn icon-btn--sm cases-search__clear"
                    aria-label={t('cases.library.clearSearch')}
                    title={t('cases.library.clearSearch')}
                    onClick={() => {
                      store.setQuery('')
                      searchRef.current?.focus()
                    }}
                  >
                    <X size={15} aria-hidden="true" />
                  </button>
                )}
              </div>

              <div className="cases-segmented" role="group" aria-label={t('cases.library.statusFilter')}>
                {(['all', ...CASE_STATUSES] as const).map((value) => (
                  <button
                    key={value}
                    type="button"
                    className="cases-segmented__btn"
                    aria-pressed={statusFilter === value}
                    onClick={() => store.setStatusFilter(value)}
                  >
                    {value !== 'all' && <StatusDot status={value} />}
                    {value === 'all' ? t('cases.library.allStatuses') : t(`cases.status.${value}`)}
                    <span className="cases-segmented__count">{counts[value]}</span>
                  </button>
                ))}
              </div>

              <label className="cases-sort">
                <ArrowUpDown className="cases-sort__icon" size={15} aria-hidden="true" />
                <span className="cases-sr">{t('cases.library.sortLabel')}</span>
                <select
                  className="select cases-sort__select"
                  value={sort}
                  onChange={(e) => store.setSort(e.target.value as CaseSort)}
                >
                  {CASE_SORTS.map((value) => (
                    <option key={value} value={value}>
                      {t(`cases.sort.${value}`)}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          )}

          {cases.length > 0 && filtering && visible.length > 0 && (
            <p className="cases-results-note" role="status">
              {t('cases.library.showing', { count: visible.length, total: cases.length })}
            </p>
          )}

          {content}
        </div>
      </main>

      {editor && <CaseEditorModal record={editor.record} onClose={closeEditor} onSaved={onSaved} />}

      <ConfirmDialog
        open={pendingDelete !== null}
        title={t('cases.confirm.deleteCaseTitle')}
        message={t('cases.confirm.deleteCaseText', {
          title: pendingDelete?.title ?? '',
          count: pendingDelete?.boardCount ?? 0
        })}
        confirmLabel={deleting ? t('cases.confirm.deleting') : t('cases.confirm.deleteCase')}
        cancelLabel={t('common.cancel')}
        danger
        onConfirm={() => void confirmDelete()}
        onCancel={cancelDelete}
      />
    </div>
  )
}
