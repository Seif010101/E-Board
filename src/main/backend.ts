// Composes the pure services over one database. Shared by the Electron entry point and the tests.

import type { Database } from './db'
import type { SecretCipher } from './secrets'
import { createAuthService } from './services/auth'
import { createMediaService } from './services/media'
import type { StorageService } from './services/storage'
import { createWorkspaceService } from './services/workspace'

export interface BackendDeps {
  db: Database
  cipher: SecretCipher | null
  now?: () => number
  /** Switching between local and removable-drive storage; absent where it makes no sense (tests). */
  storage?: StorageService | null
}

export function createBackend(deps: BackendDeps) {
  return {
    auth: createAuthService(deps),
    workspace: createWorkspaceService(deps),
    media: createMediaService(deps),
    storage: deps.storage ?? null
  }
}

export type Backend = ReturnType<typeof createBackend>
