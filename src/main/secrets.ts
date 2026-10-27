// At-rest protection for small secrets (TOTP seeds). Electron's safeStorage (DPAPI on Windows) is
// injected so this module stays testable without Electron.

/** The subset of Electron's `safeStorage` we rely on. */
export interface SecretCipher {
  isEncryptionAvailable(): boolean
  encryptString(plainText: string): Buffer
  decryptString(encrypted: Buffer): string
}

const SEALED = 'ss:'
const PLAIN = 'pt:'

export interface SecretBox {
  seal(plain: string): string
  open(stored: string): string
}

export function createSecretBox(cipher: SecretCipher | null): SecretBox {
  const available = (): boolean => {
    try {
      return !!cipher && cipher.isEncryptionAvailable()
    } catch {
      return false
    }
  }
  return {
    seal(plain) {
      if (cipher && available()) return SEALED + cipher.encryptString(plain).toString('base64')
      return PLAIN + plain
    },
    open(stored) {
      if (stored.startsWith(PLAIN)) return stored.slice(PLAIN.length)
      if (stored.startsWith(SEALED)) {
        if (!cipher || !available()) throw new Error('OS secret storage is unavailable')
        return cipher.decryptString(Buffer.from(stored.slice(SEALED.length), 'base64'))
      }
      throw new Error('Unknown secret encoding')
    }
  }
}
