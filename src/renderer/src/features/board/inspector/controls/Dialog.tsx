// Dialogs opened from the drawer are portalled to <body>: the drawer is a positioned, animated
// panel, and a fixed-position modal inside it would be clipped to (and move with) the drawer.

import { useCallback, useRef, type ComponentProps } from 'react'
import { createPortal } from 'react-dom'
import { ConfirmDialog, Modal } from '@renderer/components/ui/Modal'

/**
 * Stable identity for a callback that always runs its latest version. Modal re-runs its focus
 * effect whenever onClose changes identity, which would steal focus on every parent render.
 */
export function useStableCallback<A extends unknown[]>(fn: (...args: A) => void): (...args: A) => void {
  const ref = useRef(fn)
  ref.current = fn
  return useCallback((...args: A) => ref.current(...args), [])
}

export function DrawerModal(props: ComponentProps<typeof Modal>) {
  const onClose = useStableCallback(props.onClose)
  if (!props.open) return null
  return createPortal(<Modal {...props} onClose={onClose} />, document.body)
}

export function DrawerConfirm(props: ComponentProps<typeof ConfirmDialog>) {
  const onCancel = useStableCallback(props.onCancel)
  if (!props.open) return null
  return createPortal(<ConfirmDialog {...props} onCancel={onCancel} />, document.body)
}
