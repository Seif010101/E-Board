import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { errorMessage } from '@renderer/lib/api'
import { toast } from '@renderer/components/ui/toast'
import { useSession } from '@renderer/stores/session'
import { lockSession } from './sessionActions'

const ACTIVITY_EVENTS = ['pointerdown', 'pointermove', 'keydown', 'wheel'] as const
/** Activity is recorded at most this often; pointermove fires far more frequently. */
const ACTIVITY_THROTTLE_MS = 1000

/**
 * Locks the app after `settings.autoLockMinutes` of inactivity and on Ctrl+L.
 * Mounted once, at the app root.
 */
export function useAutoLock(): void {
  const { t } = useTranslation()
  const active = useSession((s) => s.status === 'authenticated' && !s.locked)
  const minutes = useSession((s) => s.user?.settings.autoLockMinutes ?? 0)

  useEffect(() => {
    if (!active) return
    let locking = false
    const lock = () => {
      if (locking) return
      locking = true
      lockSession()
        .catch((err: unknown) => toast.error(errorMessage(t, err)))
        .finally(() => {
          locking = false
        })
    }

    const onShortcut = (e: KeyboardEvent) => {
      // `code` keeps the shortcut working on non-Latin keyboard layouts (e.g. Arabic).
      const isL = e.code === 'KeyL' || e.key.toLowerCase() === 'l'
      if (!isL || !e.ctrlKey || e.altKey || e.shiftKey || e.metaKey) return
      e.preventDefault()
      if (!e.repeat) lock()
    }
    window.addEventListener('keydown', onShortcut, true)

    let timer: number | undefined
    let lastActivity = Date.now()
    const limitMs = minutes * 60_000

    // Instead of re-arming a timer on every event, activity only moves a timestamp and the timer
    // re-checks it when it fires. Wall-clock time also covers sleep/hibernate, which pauses timers.
    const check = () => {
      window.clearTimeout(timer)
      const idle = Date.now() - lastActivity
      if (idle >= limitMs) lock()
      else timer = window.setTimeout(check, limitMs - idle + 50)
    }
    const onActivity = () => {
      const now = Date.now()
      if (now - lastActivity >= ACTIVITY_THROTTLE_MS) lastActivity = now
    }
    const onVisible = () => {
      if (document.visibilityState === 'visible') check()
    }

    if (minutes > 0) {
      for (const type of ACTIVITY_EVENTS) window.addEventListener(type, onActivity, { capture: true, passive: true })
      document.addEventListener('visibilitychange', onVisible)
      timer = window.setTimeout(check, limitMs)
    }

    return () => {
      window.removeEventListener('keydown', onShortcut, true)
      window.clearTimeout(timer)
      for (const type of ACTIVITY_EVENTS) window.removeEventListener(type, onActivity, { capture: true })
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [active, minutes, t])
}
