// Device-local UI preferences used before sign-in (language/theme of the auth screens).
// Once signed in, the user's stored settings take over.

import { create } from 'zustand'
import type { AppTheme, Language } from '@shared/types'

const KEY = 'eboard.prefs'

interface Prefs {
  language: Language
  appTheme: AppTheme
}

const read = (): Prefs => {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? '{}') as Partial<Prefs>
    return {
      language: raw.language === 'ar' ? 'ar' : 'en',
      appTheme: raw.appTheme === 'light' ? 'light' : 'dark'
    }
  } catch {
    return { language: 'en', appTheme: 'dark' }
  }
}

interface PrefsState extends Prefs {
  set(patch: Partial<Prefs>): void
}

export const usePrefs = create<PrefsState>((set, get) => ({
  ...read(),
  set(patch) {
    set(patch)
    try {
      localStorage.setItem(KEY, JSON.stringify({ language: get().language, appTheme: get().appTheme }))
    } catch {
      /* storage unavailable: preference lasts for this session only */
    }
  }
}))
