// Company employees: person cards on the same board plus their position. Adding an employee also
// draws an "employee" thread from the company to the person (unless such a thread already joins
// them); every multi-step change runs in one transaction so a single undo reverts all of it.

import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { useShallow } from 'zustand/react/shallow'
import { LocateFixed, PanelRightOpen, Plus, UserPlus, UserRound, Users, X } from 'lucide-react'
import { mediaUrl, type BoardItem, type CompanyEmployee, type Id, type ItemOfType } from '@shared/types'
import { cleanLine, LIMITS, rules } from '@shared/validation'
import { toast } from '@renderer/components/ui/toast'
import { board, useBoard } from '../../core/store'
import { createLink, createPerson, DEFAULT_SIZES, randomTilt } from '../../core/factories'
import { itemDisplayName } from '../../core/displayName'
import { itemRect, rectsIntersect } from '../../core/geometry'
import type { Rect } from '../../core/types'
import { locateItem, openFromInspector } from '../nav'
import { DrawerModal } from './Dialog'
import { FieldShell } from './FieldShell'
import { ItemPicker } from './ItemPicker'
import { plainText } from './inputRules'
import { inTx, linksBetween } from './links'
import { useDraft } from './useDraft'

const ROLE_MAX = 80
const PLACE_GAP = 48

const roleError = (s: string) => (s.length > ROLE_MAX ? 'validation.too_long' : plainText(s))

const latestCompany = (id: Id): ItemOfType<'company'> | null => {
  const item = board().items[id]
  return item?.type === 'company' ? item : null
}

const employeeThreads = (companyId: Id, personId: Id) => linksBetween(companyId, personId).filter((l) => l.kind === 'employee')

/** Employee entries whose person card is still on the board (deleting a card leaves its entry behind). */
export const presentEmployees = (employees: CompanyEmployee[], items: Record<Id, BoardItem>): CompanyEmployee[] =>
  employees.filter((e) => items[e.personItemId]?.type === 'person')

/** First free slot in the columns to the right of the company card. */
function spotBeside(company: ItemOfType<'company'>): Rect {
  const { w, h } = DEFAULT_SIZES.person
  const others = Object.values(board().items).filter((i) => i.type !== 'stroke')
  const pad = (r: Rect): Rect => ({ x: r.x - 16, y: r.y - 16, w: r.w + 32, h: r.h + 32 })
  for (let col = 0; col < 4; col++) {
    for (let row = 0; row < 8; row++) {
      const r = { x: company.x + company.w + PLACE_GAP + col * (w + PLACE_GAP), y: company.y + row * (h + PLACE_GAP), w, h }
      if (!others.some((o) => rectsIntersect(r, pad(itemRect(o))))) return r
    }
  }
  return { x: company.x + company.w + PLACE_GAP, y: company.y, w, h }
}

/** Adds the employee entry and, unless one already exists, the employee thread. Call inside a tx. */
function addEmployee(companyId: Id, personId: Id, role: string): boolean {
  const company = latestCompany(companyId)
  if (!company) return false
  const employees = presentEmployees(company.data.employees, board().items)
  if (employees.some((e) => e.personItemId === personId) || employees.length >= LIMITS.employees) return false
  board().updateItem<'company'>(companyId, { data: { employees: [...employees, { personItemId: personId, role }] } })
  if (employeeThreads(companyId, personId).length === 0) {
    board().addLink(createLink(company.boardId, companyId, personId, 'employee', role))
  }
  return true
}

/**
 * A new "employee" thread drawn between a company and a person also lists the person among the
 * company's employees (position = the thread label). Call inside a tx.
 */
export function enlistEmployee(a: BoardItem, b: BoardItem, role: string): void {
  const companyId = a.type === 'company' ? a.id : b.type === 'company' ? b.id : null
  const person = a.type === 'person' ? a : b.type === 'person' ? b : null
  const company = companyId ? latestCompany(companyId) : null
  if (!company || !person) return
  const employees = presentEmployees(company.data.employees, board().items)
  if (employees.some((e) => e.personItemId === person.id) || employees.length >= LIMITS.employees) return
  board().updateItem<'company'>(company.id, { data: { employees: [...employees, { personItemId: person.id, role }] } })
}

export function EmployeesEditor({ company }: { company: ItemOfType<'company'> }) {
  const { t } = useTranslation()
  const [adding, setAdding] = useState(false)
  const [removing, setRemoving] = useState<Id | null>(null)
  const employees = company.data.employees
  // Primitive values only, so dragging cards around does not re-render the list.
  const names = useBoard(
    useShallow((s) =>
      employees.map((e) => {
        const p = s.items[e.personItemId]
        return p?.type === 'person' ? itemDisplayName(p, t) : null
      })
    )
  )
  const photos = useBoard(
    useShallow((s) =>
      employees.map((e) => {
        const p = s.items[e.personItemId]
        return p?.type === 'person' ? p.data.photoMediaId : null
      })
    )
  )

  const setRole = (personId: Id, role: string) =>
    inTx(() => {
      const current = latestCompany(company.id)
      if (!current) return
      const previous = current.data.employees.find((e) => e.personItemId === personId)?.role ?? ''
      board().updateItem<'company'>(company.id, {
        data: { employees: current.data.employees.map((e) => (e.personItemId === personId ? { ...e, role } : e)) }
      })
      // Keep the thread's hover label in step with the position, unless it was renamed by hand.
      for (const link of employeeThreads(company.id, personId)) {
        if (link.label === previous) board().updateLink(link.id, { label: role })
      }
    })

  const remove = (personId: Id, alsoThreads: boolean) => {
    inTx(() => {
      const current = latestCompany(company.id)
      if (!current) return
      board().updateItem<'company'>(company.id, {
        data: { employees: current.data.employees.filter((e) => e.personItemId !== personId) }
      })
      if (alsoThreads) board().removeLinks(employeeThreads(company.id, personId).map((l) => l.id))
    })
    setRemoving(null)
  }

  const requestRemove = (personId: Id) => {
    if (employeeThreads(company.id, personId).length > 0) setRemoving(personId)
    else remove(personId, false)
  }

  const removingIndex = removing ? employees.findIndex((e) => e.personItemId === removing) : -1
  const removingName = removingIndex >= 0 ? (names[removingIndex] ?? '') : ''
  const present = names.filter((n) => n !== null).length
  const full = present >= LIMITS.employees

  return (
    <div className="insp-emps">
      {present === 0 && !adding && <p className="insp-empty">{t('inspector.employees.empty')}</p>}
      {present > 0 && (
        <ul className="insp-emps__list" role="list">
          {employees.map((e, i) =>
            names[i] === null ? null : (
              <EmployeeRow
                key={e.personItemId}
                name={names[i] ?? ''}
                photo={photos[i] ?? null}
                role={e.role}
                onRole={(role) => setRole(e.personItemId, role)}
                onOpen={() => openFromInspector({ kind: 'item', id: e.personItemId })}
                onLocate={() => locateItem(e.personItemId)}
                onRemove={() => requestRemove(e.personItemId)}
              />
            )
          )}
        </ul>
      )}
      {adding ? (
        <AddEmployee company={company} onDone={() => setAdding(false)} />
      ) : full ? (
        <div className="field__hint">{t('inspector.limit_reached', { max: LIMITS.employees })}</div>
      ) : (
        <button type="button" className="insp-addbtn" onClick={() => setAdding(true)}>
          <Plus size={15} aria-hidden="true" />
          {t('inspector.employees.add')}
        </button>
      )}
      {removing && (
        <DrawerModal
          open
          title={t('inspector.employees.remove_title')}
          onClose={() => setRemoving(null)}
          width={440}
          footer={
            <>
              <button type="button" className="btn" onClick={() => setRemoving(null)}>
                {t('common.cancel')}
              </button>
              <button type="button" className="btn" onClick={() => remove(removing, false)}>
                {t('inspector.employees.keep_thread')}
              </button>
              <button type="button" className="btn btn--danger" onClick={() => remove(removing, true)}>
                {t('inspector.employees.remove_thread')}
              </button>
            </>
          }
        >
          <p>{t('inspector.employees.remove_message', { name: removingName })}</p>
        </DrawerModal>
      )}
    </div>
  )
}

interface RowProps {
  name: string
  photo: Id | null
  role: string
  onRole(role: string): void
  onOpen(): void
  onLocate(): void
  onRemove(): void
}

function EmployeeRow({ name, photo, role, onRole, onOpen, onLocate, onRemove }: RowProps) {
  const { t } = useTranslation()
  const [broken, setBroken] = useState(false)
  const d = useDraft({ value: role, onCommit: onRole, validate: roleError, maxLength: ROLE_MAX })
  return (
    <li className={`insp-emp${d.errorKey ? ' is-invalid' : ''}`}>
      <div className="insp-emp__main">
        <button
          type="button"
          className="insp-emp__who"
          onClick={onOpen}
          aria-label={t('inspector.employees.open_aria', { name })}
          title={t('inspector.employees.open')}
        >
          <span className="insp-emp__avatar" aria-hidden="true">
            {photo && !broken ? (
              <img src={mediaUrl(photo)} alt="" draggable={false} onError={() => setBroken(true)} />
            ) : (
              <UserRound size={16} />
            )}
          </span>
          <span className="insp-emp__name">{name}</span>
          <PanelRightOpen size={13} className="insp-emp__open insp-flip" aria-hidden="true" />
        </button>
        <button
          type="button"
          className="icon-btn icon-btn--sm"
          onClick={onLocate}
          aria-label={t('inspector.locate_aria', { name })}
          title={t('inspector.locate')}
        >
          <LocateFixed size={14} />
        </button>
        <button
          type="button"
          className="icon-btn icon-btn--sm insp-danger-hover"
          onClick={onRemove}
          aria-label={t('inspector.employees.remove_aria', { name })}
          title={t('common.remove')}
        >
          <X size={14} />
        </button>
      </div>
      <input
        className="insp-emp__role"
        value={d.value}
        maxLength={ROLE_MAX}
        placeholder={t('inspector.employees.role_placeholder')}
        aria-label={t('inspector.employees.role_aria', { name })}
        aria-invalid={d.errorKey ? true : undefined}
        autoComplete="off"
        onChange={(e) => d.change(e.target.value)}
        onBlur={() => d.commit()}
        onKeyDown={d.keyDown}
      />
      {d.errorKey && (
        <div className="field__error" role="alert">
          {t(d.errorKey)}
        </div>
      )}
    </li>
  )
}

type Mode = 'link' | 'create'

function AddEmployee({ company, onDone }: { company: ItemOfType<'company'>; onDone(): void }) {
  const { t } = useTranslation()
  const ids = useId()
  const panelRef = useRef<HTMLDivElement>(null)
  const candidates = useBoard(
    useShallow((s) =>
      Object.values(s.items).filter(
        (i): i is ItemOfType<'person'> =>
          i.type === 'person' && !company.data.employees.some((e) => e.personItemId === i.id)
      )
    )
  )
  const [mode, setMode] = useState<Mode>(() => (candidates.length > 0 ? 'link' : 'create'))
  const [personId, setPersonId] = useState<Id | null>(null)
  const [name, setName] = useState('')
  const [role, setRole] = useState('')
  const [submitted, setSubmitted] = useState(false)

  // Focus the first field once when the panel opens (not on every mode switch).
  useEffect(() => {
    panelRef.current?.querySelector<HTMLInputElement>('input')?.focus()
  }, [])

  const cleanName = cleanLine(name)
  const cleanRole = cleanLine(role)
  const nameError =
    cleanName === ''
      ? submitted
        ? 'validation.required'
        : null
      : cleanName.length > LIMITS.name
        ? 'validation.too_long'
        : rules.personName(cleanName)
  const roleMsg = roleError(cleanRole)
  const pickMissing = submitted && mode === 'link' && !personId

  const submit = () => {
    setSubmitted(true)
    if (roleMsg) return
    if (mode === 'link') {
      if (!personId) return
      if (inTx(() => addEmployee(company.id, personId, cleanRole))) {
        const person = board().items[personId]
        if (person) toast.success(t('inspector.employees.linked', { name: itemDisplayName(person, t) }))
        onDone()
      }
      return
    }
    if (cleanName === '' || nameError) return
    const current = latestCompany(company.id)
    if (!current) return
    const spot = spotBeside(current)
    const detective = board().board?.theme === 'detective'
    const person = createPerson(
      { boardId: current.boardId, z: board().nextZ(), x: spot.x, y: spot.y, rotation: detective ? randomTilt() : 0 },
      { fullName: cleanName }
    )
    inTx(() => {
      board().addItems([person])
      addEmployee(current.id, person.id, cleanRole)
    })
    toast.success(t('inspector.employees.created', { name: cleanName }))
    onDone()
  }

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Escape' && !e.defaultPrevented) {
      e.preventDefault()
      e.stopPropagation()
      onDone()
    }
  }

  const onEnter = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.nativeEvent.isComposing) {
      e.preventDefault()
      submit()
    }
  }

  const modes: { id: Mode; icon: typeof Users; label: string }[] = [
    { id: 'link', icon: Users, label: t('inspector.employees.mode_link') },
    { id: 'create', icon: UserPlus, label: t('inspector.employees.mode_create') }
  ]

  return (
    <div className="insp-subpanel" role="group" aria-labelledby={`${ids}-title`} onKeyDown={onKeyDown} ref={panelRef}>
      <div className="insp-subpanel__title" id={`${ids}-title`}>
        {t('inspector.employees.add')}
      </div>
      <div className="insp-seg" role="radiogroup" aria-label={t('inspector.employees.mode')}>
        {modes.map(({ id, icon: Icon, label }) => (
          <button
            key={id}
            type="button"
            role="radio"
            aria-checked={mode === id}
            className={`insp-seg__btn${mode === id ? ' is-active' : ''}`}
            tabIndex={mode === id ? 0 : -1}
            onClick={() => {
              setMode(id)
              setSubmitted(false)
            }}
            onKeyDown={(e) => {
              if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) {
                e.preventDefault()
                const next: Mode = mode === 'link' ? 'create' : 'link'
                setMode(next)
                setSubmitted(false)
                e.currentTarget.parentElement?.querySelectorAll<HTMLElement>('[role="radio"]')[next === 'link' ? 0 : 1]?.focus()
              }
            }}
          >
            <Icon size={14} aria-hidden="true" />
            {label}
          </button>
        ))}
      </div>

      {mode === 'link' ? (
        <>
          <ItemPicker
            items={candidates}
            selectedId={personId}
            onSelect={(id) => {
              setPersonId(id)
              setSubmitted(false)
            }}
            label={t('inspector.employees.pick_label')}
            placeholder={t('inspector.employees.search')}
            emptyText={candidates.length === 0 ? t('inspector.employees.no_people') : t('inspector.no_matches')}
          />
          {pickMissing && (
            <div className="field__error" role="alert">
              {t('inspector.employees.pick_person')}
            </div>
          )}
        </>
      ) : (
        <FieldShell
          label={t('inspector.person.full_name')}
          htmlFor={`${ids}-name`}
          required
          error={nameError ? t(nameError) : null}
          hint={t('inspector.employees.create_hint')}
          messageId={`${ids}-name-msg`}
        >
          <input
            id={`${ids}-name`}
            className="input"
            value={name}
            maxLength={LIMITS.name}
            placeholder={t('inspector.person.full_name_placeholder')}
            autoComplete="off"
            aria-required
            aria-invalid={nameError ? true : undefined}
            aria-describedby={`${ids}-name-msg`}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={onEnter}
          />
        </FieldShell>
      )}

      <FieldShell
        label={t('inspector.employees.role')}
        htmlFor={`${ids}-role`}
        error={roleMsg ? t(roleMsg) : null}
        messageId={`${ids}-role-msg`}
      >
        <input
          id={`${ids}-role`}
          className="input"
          value={role}
          maxLength={ROLE_MAX}
          placeholder={t('inspector.employees.role_placeholder')}
          autoComplete="off"
          aria-invalid={roleMsg ? true : undefined}
          aria-describedby={roleMsg ? `${ids}-role-msg` : undefined}
          onChange={(e) => setRole(e.target.value)}
          onKeyDown={onEnter}
        />
      </FieldShell>

      <div className="insp-subpanel__actions">
        <button type="button" className="btn btn--sm btn--ghost" onClick={onDone}>
          {t('common.cancel')}
        </button>
        <button type="button" className="btn btn--sm btn--primary" onClick={submit} disabled={mode === 'link' && candidates.length === 0}>
          {mode === 'link' ? t('inspector.employees.link') : t('inspector.employees.create')}
        </button>
      </div>
    </div>
  )
}
