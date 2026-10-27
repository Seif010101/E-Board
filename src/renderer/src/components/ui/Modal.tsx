import { useEffect, useRef, type ReactNode } from 'react'
import { X } from 'lucide-react'

interface ModalProps {
  title: string
  open: boolean
  onClose(): void
  children: ReactNode
  footer?: ReactNode
  width?: number
}

/** Accessible modal dialog. Closes on Escape and backdrop click. */
export function Modal({ title, open, onClose, children, footer, width = 480 }: ModalProps) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        onClose()
      }
    }
    window.addEventListener('keydown', onKey, true)
    const first = ref.current?.querySelector<HTMLElement>('input, textarea, select, button:not(.modal__close)')
    first?.focus()
    return () => window.removeEventListener('keydown', onKey, true)
  }, [open, onClose])

  if (!open) return null
  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" role="dialog" aria-modal="true" aria-label={title} style={{ width }} ref={ref}>
        <div className="modal__header">
          <h2>{title}</h2>
          <button className="icon-btn modal__close" onClick={onClose} aria-label="close">
            <X size={18} />
          </button>
        </div>
        <div className="modal__body">{children}</div>
        {footer && <div className="modal__footer">{footer}</div>}
      </div>
    </div>
  )
}

interface ConfirmProps {
  open: boolean
  title: string
  message: string
  confirmLabel: string
  cancelLabel: string
  danger?: boolean
  onConfirm(): void
  onCancel(): void
}

export function ConfirmDialog(p: ConfirmProps) {
  return (
    <Modal
      open={p.open}
      title={p.title}
      onClose={p.onCancel}
      width={420}
      footer={
        <>
          <button className="btn" onClick={p.onCancel}>
            {p.cancelLabel}
          </button>
          <button className={`btn ${p.danger ? 'btn--danger' : 'btn--primary'}`} onClick={p.onConfirm}>
            {p.confirmLabel}
          </button>
        </>
      }
    >
      <p>{p.message}</p>
    </Modal>
  )
}
