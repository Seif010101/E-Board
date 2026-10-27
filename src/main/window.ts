// The single application window and its navigation / permission hardening.

import { existsSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { app, BrowserWindow, type IpcMainInvokeEvent, type Session } from 'electron'

const INDEX_HTML = join(__dirname, '../renderer/index.html')

/** The dev server URL, honoured only in unpackaged builds so the env var cannot redirect a release. */
const devServerUrl = (): string | null => (!app.isPackaged && process.env.ELECTRON_RENDERER_URL) || null

const samePath = (a: string, b: string): boolean =>
  process.platform === 'win32' ? resolve(a).toLowerCase() === resolve(b).toLowerCase() : resolve(a) === resolve(b)

/** True for the renderer's own document (dev server origin, or the bundled index.html). */
export function isAppUrl(url: string): boolean {
  try {
    const u = new URL(url)
    const dev = devServerUrl()
    if (dev) return u.origin === new URL(dev).origin
    return u.protocol === 'file:' && samePath(fileURLToPath(u), INDEX_HTML)
  } catch {
    return false
  }
}

let mainWindow: BrowserWindow | null = null

export const getMainWindow = (): BrowserWindow | null => mainWindow

/** IPC is accepted only from the top frame of our window while it shows the app document. */
export function isTrustedSender(event: IpcMainInvokeEvent): boolean {
  const frame = event.senderFrame
  if (!mainWindow || mainWindow.isDestroyed() || event.sender !== mainWindow.webContents) return false
  if (!frame || frame.parent !== null) return false
  return isAppUrl(frame.url)
}

const ALLOWED_PERMISSIONS = new Set(['clipboard-sanitized-write'])

export function hardenSession(ses: Session): void {
  ses.setPermissionRequestHandler((_wc, permission, callback) => callback(ALLOWED_PERMISSIONS.has(permission)))
  ses.setPermissionCheckHandler((_wc, permission) => ALLOWED_PERMISSIONS.has(permission))
  ses.setDevicePermissionHandler(() => false)
}

export function createMainWindow(): BrowserWindow {
  const icon = join(app.getAppPath(), 'build', 'icon.png')
  const win = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1024,
    minHeight: 680,
    show: false,
    title: 'E-Board',
    backgroundColor: '#0f1115',
    ...(existsSync(icon) ? { icon } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
      nodeIntegrationInWorker: false,
      webSecurity: true,
      allowRunningInsecureContent: false,
      webviewTag: false,
      spellcheck: false,
      devTools: !app.isPackaged
    }
  })
  mainWindow = win

  win.once('ready-to-show', () => win.show())
  win.on('closed', () => {
    if (mainWindow === win) mainWindow = null
  })

  const wc = win.webContents
  // Blocks link clicks, location changes and Chromium's "open the dropped file" navigation alike.
  const guard = (event: { preventDefault(): void }, url: string) => {
    if (!isAppUrl(url)) event.preventDefault()
  }
  wc.on('will-navigate', (event) => guard(event, event.url))
  wc.on('will-frame-navigate', (event) => guard(event, event.url))
  wc.on('will-redirect', (event) => guard(event, event.url))
  wc.setWindowOpenHandler(() => ({ action: 'deny' }))
  wc.on('will-attach-webview', (event) => event.preventDefault())
  wc.on('render-process-gone', (_event, details) => console.error('Renderer process gone:', details.reason))
  if (!app.isPackaged) {
    wc.on('before-input-event', (_event, input) => {
      if (input.type === 'keyDown' && input.key === 'F12') wc.toggleDevTools()
    })
  }

  const dev = devServerUrl()
  if (dev) void win.loadURL(dev)
  else void win.loadFile(INDEX_HTML)
  return win
}
