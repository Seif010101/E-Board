// Composes the pure services over one database. Shared by the Electron entry point and the tests.

import type { Database } from './db'
import type { SecretCipher } from './secrets'
import { createAuthService } from './services/auth'
import { createMediaService } from './services/media'
import { createWorkspaceService } from './services/workspace'

export interface BackendDeps {
  db: Database
  cipher: SecretCipher | null
  now?: () => number
}

export function createBackend(deps: BackendDeps) {
  return {
    auth: createAuthService(deps),
    workspace: createWorkspaceService(deps),
    media: createMediaService(deps)
  }
}

export type Backend = ReturnType<typeof createBackend>
