// Registers one ipcMain handler per API channel, all funnelled through the router.

import { ipcMain, type IpcMainInvokeEvent } from 'electron'
import { API_CHANNELS, type Result } from '@shared/api'
import type { Router } from './router'

const trusted = (isTrustedSender: (event: IpcMainInvokeEvent) => boolean, event: IpcMainInvokeEvent): boolean => {
  try {
    return isTrustedSender(event)
  } catch (err) {
    // A destroyed frame or contents can make the check itself throw: fail closed.
    console.warn('IPC sender check failed', err)
    return false
  }
}

export function registerIpc(router: Router, isTrustedSender: (event: IpcMainInvokeEvent) => boolean): void {
  for (const [ns, methods] of Object.entries(API_CHANNELS)) {
    for (const method of methods) {
      const channel = `${ns}:${method}`
      // Fail fast at startup rather than leaving a renderer call hanging.
      if (!router.has(channel)) throw new Error(`No IPC handler for ${channel}`)
      ipcMain.handle(channel, (event, payload: unknown): Promise<Result<unknown>> | Result<unknown> => {
        if (!trusted(isTrustedSender, event)) {
          console.warn(`Rejected IPC ${channel} from an untrusted sender`)
          return { ok: false, error: 'not_authenticated' }
        }
        return router.dispatch(channel, payload)
      })
    }
  }
}
