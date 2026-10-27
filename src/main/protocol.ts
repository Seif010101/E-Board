// eboard-media://media/<id> — serves stored images to the renderer, only to their signed-in owner.

import { protocol } from 'electron'
import { MEDIA_SCHEME, type ImageMime } from '@shared/types'
import { PATTERNS } from '@shared/validation'

/** Must run before the app is ready. */
export function registerMediaScheme(): void {
  protocol.registerSchemesAsPrivileged([
    { scheme: MEDIA_SCHEME, privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true } }
  ])
}

const notFound = (): Response =>
  new Response('Not found', {
    status: 404,
    headers: { 'Content-Type': 'text/plain; charset=utf-8', 'X-Content-Type-Options': 'nosniff', 'Cache-Control': 'no-store' }
  })

/** Extracts and validates the media id from a request URL, or null. */
export function mediaIdFromUrl(raw: string): string | null {
  try {
    const url = new URL(raw)
    if (url.protocol !== `${MEDIA_SCHEME}:` || url.host !== 'media') return null
    const id = decodeURIComponent(url.pathname.replace(/^\//, ''))
    return PATTERNS.id.test(id) ? id : null
  } catch {
    return null
  }
}

/** `lookup` returns the media for the current, unlocked user only (null otherwise). */
export function serveMedia(lookup: (id: string) => { mime: ImageMime; bytes: Uint8Array } | null): void {
  protocol.handle(MEDIA_SCHEME, (request) => {
    if (request.method !== 'GET' && request.method !== 'HEAD') return notFound()
    const id = mediaIdFromUrl(request.url)
    const media = id ? lookup(id) : null
    if (!media) return notFound()
    return new Response(request.method === 'HEAD' ? null : media.bytes, {
      status: 200,
      headers: {
        'Content-Type': media.mime,
        'Content-Length': String(media.bytes.byteLength),
        'X-Content-Type-Options': 'nosniff',
        'Cache-Control': 'private, max-age=31536000, immutable'
      }
    })
  })
}
