// Exposes a narrow, typed API to the renderer. No Node or Electron objects leak through.
import { contextBridge, ipcRenderer } from 'electron'
import { API_CHANNELS, type EBoardApi } from '../shared/api'

const api: Record<string, Record<string, (payload?: unknown) => Promise<unknown>>> = {}
for (const [ns, methods] of Object.entries(API_CHANNELS)) {
  api[ns] = {}
  for (const method of methods) {
    api[ns][method] = (payload?: unknown) => ipcRenderer.invoke(`${ns}:${method}`, payload)
  }
}

contextBridge.exposeInMainWorld('api', api as unknown as EBoardApi)
