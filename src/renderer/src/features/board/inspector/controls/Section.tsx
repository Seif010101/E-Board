import { useId, useState, type ReactNode } from 'react'
import { ChevronDown, type LucideIcon } from 'lucide-react'

const STORAGE_KEY = 'eboard.inspector.collapsed'

// Collapsed sections are a per-viewer convenience shared by every card of the same kind.
const readCollapsed = (): Set<string> => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    const parsed: unknown = raw ? JSON.parse(raw) : []
    return new Set(Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === 'string') : [])
  } catch {
    return new Set()
  }
}

const collapsed = readCollapsed()

const persist = () => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...collapsed]))
  } catch {
    /* storage unavailable: the state lasts for this session only */
  }
}

interface SectionProps {
  /** Stable id used to remember the collapsed state, e.g. "person.contact". */
  id: string
  title: string
  icon: LucideIcon
  /** Small counter badge next to the title (number of entries). */
  count?: number
  /** Controls rendered at the end of the header (e.g. an "add" button). */
  actions?: ReactNode
  children: ReactNode
}

export function Section({ id, title, icon: Icon, count, actions, children }: SectionProps) {
  const [open, setOpen] = useState(() => !collapsed.has(id))
  const bodyId = useId()

  const toggle = () => {
    const next = !open
    setOpen(next)
    if (next) collapsed.delete(id)
    else collapsed.add(id)
    persist()
  }

  return (
    <section className={`insp-section${open ? ' is-open' : ''}`}>
      <div className="insp-section__header">
        <button type="button" className="insp-section__toggle" aria-expanded={open} aria-controls={open ? bodyId : undefined} onClick={toggle}>
          <Icon size={15} className="insp-section__icon" aria-hidden="true" />
          <span className="insp-section__title">{title}</span>
          {count !== undefined && count > 0 && <span className="insp-section__count">{count}</span>}
          <ChevronDown size={15} className="insp-section__chevron" aria-hidden="true" />
        </button>
        {actions && open && <div className="insp-section__actions">{actions}</div>}
      </div>
      {open && (
        <div className="insp-section__body" id={bodyId}>
          {children}
        </div>
      )}
    </section>
  )
}

/** Two equal columns for short fields; collapses to one column in a narrow drawer. */
export function Row({ children }: { children: ReactNode }) {
  return <div className="insp-row">{children}</div>
}
