// Native dialogs.

import { dialog, type BrowserWindow, type OpenDialogOptions } from 'electron'
import type { Language } from '@shared/types'

const IMAGES_LABEL: Record<Language, string> = { en: 'Images', ar: 'الصور' }

/** PNG/JPEG file picker; resolves to the chosen path or null when cancelled. */
export async function pickImageFile(parent: BrowserWindow | null, language: Language): Promise<string | null> {
  const options: OpenDialogOptions = {
    properties: ['openFile'],
    filters: [{ name: IMAGES_LABEL[language], extensions: ['png', 'jpg', 'jpeg'] }]
  }
  const result = parent ? await dialog.showOpenDialog(parent, options) : await dialog.showOpenDialog(options)
  return result.canceled || result.filePaths.length === 0 ? null : result.filePaths[0]
}
