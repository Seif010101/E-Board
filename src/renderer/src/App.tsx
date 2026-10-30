import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { applyLanguage } from '@renderer/i18n'
import { useSession } from '@renderer/stores/session'
import { useNav } from '@renderer/stores/nav'
import { usePrefs } from '@renderer/stores/prefs'
import { Toaster } from '@renderer/components/ui/toast'
import { AuthScreen } from '@renderer/features/auth/AuthScreen'
import { LockScreen } from '@renderer/features/auth/LockScreen'
import { useAutoLock } from '@renderer/features/auth/useAutoLock'
import { ProfileScreen } from '@renderer/features/account/ProfileScreen'
import { SettingsScreen } from '@renderer/features/account/SettingsScreen'
import { CasesScreen } from '@renderer/features/cases/CasesScreen'
import { CaseScreen } from '@renderer/features/cases/CaseScreen'
import { BoardScreen } from '@renderer/features/board/BoardScreen'
import { DriveMissingScreen } from '@renderer/features/storage/DriveMissingScreen'
import { useStorageStatus } from '@renderer/features/storage/useStorageStatus'

export function App() {
  const { t } = useTranslation()
  const status = useSession((s) => s.status)
  const locked = useSession((s) => s.locked)
  const userSettings = useSession((s) => s.user?.settings)
  const userId = useSession((s) => s.user?.id)
  const prefs = usePrefs()
  const route = useNav((s) => s.route)
  const storage = useStorageStatus()

  useEffect(() => {
    void useSession.getState().refresh()
  }, [])

  // A different user (or sign-out) always starts at the cases list.
  useEffect(() => {
    useNav.getState().reset()
  }, [userId])

  const language = userSettings?.language ?? prefs.language
  const appTheme = userSettings?.appTheme ?? prefs.appTheme

  useEffect(() => {
    applyLanguage(language)
  }, [language])

  useEffect(() => {
    document.documentElement.dataset.theme = appTheme
  }, [appTheme])

  useAutoLock()

  let screen: React.ReactNode
  if (storage.kind === 'ready' && !storage.status.available) {
    // The data is on a USB drive that is not plugged in: nothing else is shown.
    screen = <DriveMissingScreen drivePath={storage.status.drivePath} />
  } else if (status === 'loading' || storage.kind === 'loading') {
    screen = (
      <div className="splash" aria-label={t('common.loading')}>
        <div className="spinner" />
      </div>
    )
  } else if (status === 'anonymous') {
    screen = <AuthScreen />
  } else if (locked) {
    screen = <LockScreen />
  } else {
    switch (route.name) {
      case 'cases':
        screen = <CasesScreen />
        break
      case 'case':
        screen = <CaseScreen caseId={route.caseId} />
        break
      case 'board':
        screen = <BoardScreen key={route.boardId} caseId={route.caseId} boardId={route.boardId} />
        break
      case 'profile':
        screen = <ProfileScreen />
        break
      case 'settings':
        screen = <SettingsScreen />
        break
    }
  }

  return (
    <>
      {screen}
      <Toaster />
    </>
  )
}
