import { resolve } from 'node:path'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  resolve: {
    alias: { '@shared': resolve(__dirname, 'src/shared') }
  },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    // scrypt (N = 2^15) makes auth flows take a few hundred ms each.
    testTimeout: 30_000,
    hookTimeout: 30_000
  }
})
