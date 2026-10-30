// Electron main process entry: app lifecycle, database, IPC and the media protocol.

import { app, clipboard, dialog, Menu, safeStorage, session, shell } from 'electron'
import { createBackend } from './backend'
import { openDatabase, type Database } from './db'
import { pickAlbumFiles, pickFolder, pickImageFile } from './dialogs'
import { registerIpc } from './ipc'
import { registerMediaScheme, serveMedia } from './protocol'
import { createRouter, createWaitingRouter } from './router'
import { createStorageService } from './services/storage'
import { createDriveCipher, dataDirOf, dbPathOf, isDriveAvailable, readStorageConfig, watchDrive } from './storage'
import { createMainWindow, getMainWindow, hardenSession, isTrustedSender } from './window'

/** Unreferenced images younger than this survive start-up cleanup (undo, pending saves). */
const ORPHAN_MEDIA_GRACE_MS = 7 * 24 * 60 * 60_000

let db: Database | null = null

/** Restarts the app so nothing from the previous run stays in memory. */
function restart(): void {
  // The new process must be able to take the single-instance lock while this one is still exiting.
  app.releaseSingleInstanceLock()
  app.relaunch()
  app.exit(0)
}

function start(): void {
  Menu.setApplicationMenu(null)
  hardenSession(session.defaultSession)

  const userData = app.getPath('userData')
  const config = readStorageConfig(userData)
  const portable = config.mode === 'portable'
  const common = {
    config,
    userData,
    osCipher: safeStorage,
    pickFolder: () => pickFolder(getMainWindow()),
    restart
  }

  // The drive holding the data is not plugged in: there is no database, only a waiting screen.
  // The app restarts by itself the moment the drive comes back.
  if (!isDriveAvailable(config)) {
    const waiting = createStorageService({ ...common, db: null, closeDb: () => {} })
    registerIpc(createWaitingRouter(waiting), isTrustedSender)
    createMainWindow()
    const timer = setInterval(() => {
      if (isDriveAvailable(config)) {
        clearInterval(timer)
        restart()
      }
    }, 1000)
    return
  }

  const dataDir = dataDirOf(config, userData)
  db = openDatabase(dbPathOf(dataDir), { removable: portable })
  const closeDb = (): void => {
    try {
      db?.close()
    } catch (err) {
      console.error('Closing the database failed', err)
    }
    db = null
  }
  const backend = createBackend({
    db,
    cipher: portable ? createDriveCipher(dataDir) : safeStorage,
    storage: createStorageService({ ...common, db, closeDb })
  })
  try {
    backend.media.pruneOrphans(ORPHAN_MEDIA_GRACE_MS)
  } catch (err) {
    console.error('Media cleanup failed', err)
  }

  // Pulling the drive out ends everything at once: the database is closed and the app restarts to
  // its "insert your drive" screen, so no account stays signed in and no data stays on screen.
  if (portable) watchDrive(config, () => { closeDb(); restart() })

  serveMedia((id) => {
    const { userId, locked } = backend.auth.state()
    return userId && !locked ? backend.media.content(userId, id) : null
  })

  const router = createRouter(backend, {
    pickImageFile: (language) => pickImageFile(getMainWindow(), language),
    pickAlbumFiles: (language) => pickAlbumFiles(getMainWindow(), language),
    openExternal: (url) => shell.openExternal(url),
    copyText: (text) => clipboard.writeText(text),
    appInfo: () => ({ version: app.getVersion(), platform: process.platform, dataPath: portable ? dataDir : userData })
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
