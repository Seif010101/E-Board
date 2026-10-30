import { useEffect, useState } from 'react'
import type { StorageStatus } from '@shared/api'
import { api, call } from '@renderer/lib/api'

export type StorageState = { kind: 'loading' } | { kind: 'ready'; status: StorageStatus }

/** Asked once at start-up: the data may be on a USB drive that is not plugged in. */
export function useStorageStatus(): StorageState {
  const [state, setState] = useState<StorageState>({ kind: 'loading' })
  useEffect(() => {
    let cancelled = false
    call(api.storage.status()).then(
      (status) => !cancelled && setState({ kind: 'ready', status }),
      // If the question itself fails, carry on as with local data.
      () => !cancelled && setState({ kind: 'ready', status: { mode: 'local', available: true, drivePath: null } })
    )
    return () => {
      cancelled = true
    }
  }, [])
  return state
}
