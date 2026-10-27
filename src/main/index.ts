// Electron main process entry: app lifecycle, database, IPC and the media protocol.

import { join } from 'node:path'
import { app, clipboard, dialog, Menu, safeStorage, session, shell } from 'electron'
import { createBackend } from './backend'
import { openDatabase, type Database } from './db'
import { pickImageFile } from './dialogs'
import { registerIpc } from './ipc'
import { registerMediaScheme, serveMedia } from './protocol'
import { createRouter } from './router'
import { createMainWindow, getMainWindow, hardenSession, isTrustedSender } from './window'

/** Unreferenced images younger than this survive start-up cleanup (undo, pending saves). */
const ORPHAN_MEDIA_GRACE_MS = 7 * 24 * 60 * 60_000

let db: Database | null = null

function start(): void {
  Menu.setApplicationMenu(null)
  hardenSession(session.defaultSession)

  db = openDatabase(join(app.getPath('userData'), 'eboard.db'))
  const backend = createBackend({ db, cipher: safeStorage })
  try {
    backend.media.pruneOrphans(ORPHAN_MEDIA_GRACE_MS)
  } catch (err) {
    console.error('Media cleanup failed', err)
  }

  serveMedia((id) => {
    const { userId, locked } = backend.auth.state()
    return userId && !locked ? backend.media.content(userId, id) : null
  })

  const router = createRouter(backend, {
    pickImageFile: (language) => pickImageFile(getMainWindow(), language),
    openExternal: (url) => shell.openExternal(url),
    copyText: (text) => clipboard.writeText(text),
    appInfo: () => ({ version: app.getVersion(), platform: process.platform, dataPath: app.getPath('userData') })
  })
  registerIpc(router, isTrustedSender)

  createMainWindow()
}

registerMediaScheme()
app.enableSandbox()

if (!app.requestSingleInstanceLock()) {
  app.quit()
} else {
  app.setAppUserModelId('com.eboard.investigator')

  app.on('second-instance', () => {
    const win = getMainWindow()
    if (!win) return
    if (win.isMinimized()) win.restore()
    win.show()
    win.focus()
  })

  // Defence in depth for any web contents, not only the main window.
  app.on('web-contents-created', (_event, contents) => {
    contents.on('will-attach-webview', (event) => event.preventDefault())
    contents.setWindowOpenHandler(() => ({ action: 'deny' }))
  })

  app.on('window-all-closed', () => app.quit())

  app.on('will-quit', () => {
    try {
      db?.close()
    } catch (err) {
      console.error('Closing the database failed', err)
    }
    db = null
  })

  app
    .whenReady()
    .then(start)
    .catch((err: unknown) => {
      console.error('E-Board failed to start', err)
      dialog.showErrorBox('E-Board', 'E-Board could not start. Please try again.\n\nتعذّر تشغيل E-Board. يرجى المحاولة مرة أخرى.')
      app.exit(1)
    })
}
