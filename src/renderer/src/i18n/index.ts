// i18n bootstrap. Every feature owns `locales/en.json` + `locales/ar.json` next to its code,
// each wrapped in its own top-level key (e.g. { "auth": { ... } }). They are deep-merged here
// into a single "translation" namespace so features never edit each other's files.

import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import type { Language } from '@shared/types'

type Tree = { [k: string]: string | Tree }

const modules = import.meta.glob<Tree>('../**/locales/*.json', { eager: true, import: 'default' })

const merge = (target: Tree, source: Tree, path: string): void => {
  for (const [k, v] of Object.entries(source)) {
    const existing = target[k]
    if (typeof v === 'object' && v !== null) {
      if (existing !== undefined && typeof existing !== 'object') {
        console.warn(`[i18n] key conflict at ${path}${k}`)
      }
      target[k] = typeof existing === 'object' ? existing : {}
      merge(target[k] as Tree, v, `${path}${k}.`)
    } else {
      if (existing !== undefined && existing !== v) console.warn(`[i18n] duplicate key ${path}${k}`)
      target[k] = v
    }
  }
}

const resources: Record<Language, Tree> = { en: {}, ar: {} }
for (const [file, tree] of Object.entries(modules)) {
  const lang = file.endsWith('/ar.json') ? 'ar' : file.endsWith('/en.json') ? 'en' : null
  if (lang) merge(resources[lang], tree, '')
}

void i18n.use(initReactI18next).init({
  resources: {
    en: { translation: resources.en },
    ar: { translation: resources.ar }
  },
  lng: 'en',
  fallbackLng: 'en',
  interpolation: { escapeValue: false },
  returnNull: false
})

/** Switch UI language and document direction. */
export function applyLanguage(lang: Language): void {
  if (i18n.language !== lang) void i18n.changeLanguage(lang)
  document.documentElement.lang = lang
  document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr'
}

export default i18n
