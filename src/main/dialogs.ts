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

const ALBUM_LABEL: Record<Language, string> = { en: 'Photos and videos', ar: 'الصور والفيديوهات' }

/** Photo / video picker for albums (several files); an empty list when cancelled. */
export async function pickAlbumFiles(parent: BrowserWindow | null, language: Language): Promise<string[]> {
  const options: OpenDialogOptions = {
    properties: ['openFile', 'multiSelections'],
    filters: [{ name: ALBUM_LABEL[language], extensions: ['png', 'jpg', 'jpeg', 'mp4', 'm4v', 'webm'] }]
  }
  const result = parent ? await dialog.showOpenDialog(parent, options) : await dialog.showOpenDialog(options)
  return result.canceled ? [] : result.filePaths
}

/** Folder picker (a USB drive or a folder on it); null when cancelled. */
export async function pickFolder(parent: BrowserWindow | null): Promise<string | null> {
  const options: OpenDialogOptions = { properties: ['openDirectory', 'createDirectory'] }
  const result = parent ? await dialog.showOpenDialog(parent, options) : await dialog.showOpenDialog(options)
  return result.canceled || result.filePaths.length === 0 ? null : result.filePaths[0]
}
