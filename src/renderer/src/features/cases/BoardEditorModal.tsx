import { useId, useMemo, useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import type { BoardRecord, BoardTheme, Id } from '@shared/types'
import { schemas } from '@shared/validation'
import { Field } from '@renderer/components/ui/Field'
import { Modal } from '@renderer/components/ui/Modal'
import { toast } from '@renderer/components/ui/toast'
import { api, call, errorMessage } from '@renderer/lib/api'
import { useStableCallback } from './hooks'
import { TITLE_MAX } from './meta'
import './cases.css'
import './BoardEditorModal.css'

export type BoardEditorMode =
  | { kind: 'create'; caseId: Id; theme: BoardTheme }
  | { kind: 'rename'; board: BoardRecord }

interface BoardEditorModalProps {
  mode: BoardEditorMode
  onClose(): void
  onSaved(board: BoardRecord, created: boolean): void
}

/** i18n key for the first problem with the title (the only field the investigator types). */
const titleIssue = (issues: readonly { path: PropertyKey[]; message: string }[]): string => {
  const issue = issues.find((i) => i.path[0] === 'title') ?? issues[0]
  return issue?.message.startsWith('validation.') ? issue.message : 'validation.invalid_input'
}

export function BoardEditorModal({ mode, onClose, onSaved }: BoardEditorModalProps) {
  const { t } = useTranslation()
  const uid = useId()
  const formId = `${uid}-form`
  const titleId = `${uid}-title`
  const creating = mode.kind === 'create'
  const [title, setTitle] = useState(creating ? '' : mode.board.title)
  // The theme is not asked for: new boards start in the user's default theme and it can be switched on the board.
  const theme: BoardTheme = creating ? mode.theme : mode.board.theme
  const [touched, setTouched] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [busy, setBusy] = useState(false)
  // Modal re-runs its focus effect whenever onClose changes identity, so keep it stable.
  const close = useStableCallback(onClose)

  // Validated and sanitised exactly as the main process will see it.
  const validation = useMemo((): { title: string; error: null } | { title: null; error: string } => {
    const result =
      mode.kind === 'create'
        ? schemas.boardCreate.safeParse({ caseId: mode.caseId, title, theme })
        : schemas.boardUpdate.safeParse({ id: mode.board.id, title })
    return result.success
      ? { title: result.data.title ?? '', error: null }
      : { title: null, error: titleIssue(result.error.issues) }
  }, [mode, title, theme])
  const titleError = validation.error && (submitted || touched) ? t(validation.error) : null

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (busy) return
    setSubmitted(true)
    const clean = validation.title
    if (clean === null) {
      document.getElementById(titleId)?.focus()
      return
    }
    if (mode.kind === 'rename' && clean === mode.board.title) {
      close()
      return
    }
    setBusy(true)
    try {
      const saved =
        mode.kind === 'create'
          ? await call(api.boards.create({ caseId: mode.caseId, title: clean, theme }))
          : await call(api.boards.update({ id: mode.board.id, title: clean }))
      onSaved(saved, creating)
    } catch (err) {
      setBusy(false)
      toast.error(errorMessage(t, err))
    }
  }

  return (
    <Modal
      open
      title={creating ? t('cases.boardEditor.createTitle') : t('cases.boardEditor.renameTitle')}
      onClose={close}
      width={460}
      footer={
        <>
          <button type="button" className="btn" onClick={close}>
            {t('common.cancel')}
          </button>
          <button type="submit" form={formId} className="btn btn--primary" disabled={busy}>
            {busy && <span className="spinner cases-btn-spinner" aria-hidden="true" />}
            {creating ? t('cases.boardEditor.create') : t('cases.boardEditor.save')}
          </button>
        </>
      }
    >
      <form id={formId} className="cases-board-editor" onSubmit={submit} noValidate aria-busy={busy}>
        <Field label={t('cases.boardEditor.titleLabel')} htmlFor={titleId} error={titleError}>
          <input
            id={titleId}
            className="input"
            value={title}
            maxLength={TITLE_MAX}
            placeholder={t('cases.boardEditor.titlePlaceholder')}
            autoComplete="off"
            spellCheck
            required
            aria-invalid={titleError ? true : undefined}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={() => setTouched(true)}
          />
        </Field>

      </form>
    </Modal>
  )
}
