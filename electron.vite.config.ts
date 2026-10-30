import { resolve } from 'node:path'
import { defineConfig } from 'electron-vite'
import type { Plugin } from 'vite'
import react from '@vitejs/plugin-react'

const shared = resolve(__dirname, 'src/shared')

/** The dev server's HMR socket needs localhost in connect-src; the packaged app keeps 'self' only. */
const devCsp = (): Plugin => ({
  name: 'eboard-dev-csp',
  apply: 'serve',
  transformIndexHtml: (html) =>
    html.replace("connect-src 'self';", "connect-src 'self' ws://localhost:* http://localhost:*;")
})

export default defineConfig({
  main: {
    resolve: { alias: { '@shared': shared } }
  },
  preload: {
    resolve: { alias: { '@shared': shared } }
  },
  renderer: {
    resolve: {
      alias: {
        '@renderer': resolve(__dirname, 'src/renderer/src'),
        '@shared': shared
      }
    },
    plugins: [react(), devCsp()]
  }
})
