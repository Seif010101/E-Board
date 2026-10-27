import type { TFunction } from 'i18next'
import type { UserSettings } from '@shared/types'
import { toast } from '@renderer/components/ui/toast'
import { errorMessage } from '@renderer/lib/api'
import { useSession } from '@renderer/stores/session'
import { rememberDevicePrefs } from '@renderer/features/auth/sessionActions'

/** Saves a settings change immediately (optimistic in the session store); failures roll back with a toast. */
export async function saveSettings(patch: Partial<UserSettings>, t: TFunction): Promise<void> {
  try {
    await useSession.getState().updateSettings(patch)
    const settings = useSession.getState().user?.settings
    if (settings && (patch.language !== undefined || patch.appTheme !== undefined)) rememberDevicePrefs(settings)
  } catch (err) {
    toast.error(errorMessage(t, err))
  }
}
