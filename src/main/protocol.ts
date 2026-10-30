// eboard-media://media/<id> — serves stored images to the renderer, only to their signed-in owner.

import { protocol } from 'electron'
import { MEDIA_SCHEME, type MediaMime } from '@shared/types'
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

/** "bytes=START-END" (one range) against a body of `size` bytes, or null when absent / unusable. */
export function parseRange(header: string | null, size: number): { start: number; end: number } | 'unsatisfiable' | null {
  const m = header ? /^bytes=(\d*)-(\d*)$/.exec(header.trim()) : null
  if (!m || (m[1] === '' && m[2] === '')) return null
  let start: number
  let end: number
  if (m[1] === '') {
    // Suffix range: the last N bytes.
    const n = Number(m[2])
    start = Math.max(0, size - n)
    end = size - 1
  } else {
    start = Number(m[1])
    end = m[2] === '' ? size - 1 : Math.min(Number(m[2]), size - 1)
  }
  if (!Number.isFinite(start) || !Number.isFinite(end) || start > end || start >= size) return 'unsatisfiable'
  return { start, end }
}

/** `lookup` returns the media for the current, unlocked user only (null otherwise). Videos are served in ranges so they can seek. */
export function serveMedia(lookup: (id: string) => { mime: MediaMime; bytes: Uint8Array } | null): void {
  protocol.handle(MEDIA_SCHEME, (request) => {
    if (request.method !== 'GET' && request.method !== 'HEAD') return notFound()
    const id = mediaIdFromUrl(request.url)
    const media = id ? lookup(id) : null
    if (!media) return notFound()
    const size = media.bytes.byteLength
    const headers: Record<string, string> = {
      'Content-Type': media.mime,
      'Accept-Ranges': 'bytes',
      'X-Content-Type-Options': 'nosniff',
      'Cache-Control': 'private, max-age=31536000, immutable'
    }
    const range = parseRange(request.headers.get('range'), size)
    if (range === 'unsatisfiable') return new Response(null, { status: 416, headers: { ...headers, 'Content-Range': `bytes */${size}` } })
    if (range) {
      const part = media.bytes.subarray(range.start, range.end + 1)
      return new Response(request.method === 'HEAD' ? null : part, {
        status: 206,
        headers: { ...headers, 'Content-Length': String(part.byteLength), 'Content-Range': `bytes ${range.start}-${range.end}/${size}` }
      })
    }
    return new Response(request.method === 'HEAD' ? null : media.bytes, {
      status: 200,
      headers: { ...headers, 'Content-Length': String(size) }
    })
  })
}
