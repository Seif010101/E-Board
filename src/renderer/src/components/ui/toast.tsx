import { create } from 'zustand'
import { X } from 'lucide-react'

export type ToastKind = 'info' | 'success' | 'error'

interface Toast {
  id: number
  kind: ToastKind
  message: string
}

interface ToastState {
  toasts: Toast[]
  push(kind: ToastKind, message: string): void
  dismiss(id: number): void
}

let seq = 0

export const useToasts = create<ToastState>((set, get) => ({
  toasts: [],
  push(kind, message) {
    const id = ++seq
    set({ toasts: [...get().toasts.slice(-4), { id, kind, message }] })
    setTimeout(() => get().dismiss(id), kind === 'error' ? 6000 : 3000)
  },
  dismiss(id) {
    set({ toasts: get().toasts.filter((t) => t.id !== id) })
  }
}))

export const toast = {
  info: (m: string) => useToasts.getState().push('info', m),
  success: (m: string) => useToasts.getState().push('success', m),
  error: (m: string) => useToasts.getState().push('error', m)
}

export function Toaster() {
  const toasts = useToasts((s) => s.toasts)
  const dismiss = useToasts((s) => s.dismiss)
  return (
    <div className="toaster" role="status" aria-live="polite">
      {toasts.map((t) => (
        <div key={t.id} className={`toast toast--${t.kind}`}>
          <span>{t.message}</span>
          <button className="icon-btn icon-btn--sm" onClick={() => dismiss(t.id)} aria-label="close">
            <X size={14} />
          </button>
        </div>
      ))}
    </div>
  )
}
