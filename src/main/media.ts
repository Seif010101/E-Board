// Image validation by content, never by name alone: PNG (IHDR) and baseline/progressive JPEG (SOFn).
// Everything else (SVG, GIF, WebP, renamed documents, truncated files) is rejected.

import type { ImageMime } from '@shared/types'

export const MAX_IMAGE_BYTES = 15 * 1024 * 1024
export const MAX_IMAGE_SIDE = 16384

const ALLOWED_EXTENSIONS = ['.png', '.jpg', '.jpeg']

export interface ImageInfo {
  mime: ImageMime
  width: number
  height: number
}

export type ImageCheck = { ok: true; info: ImageInfo } | { ok: false; error: 'invalid_file' | 'file_too_large' }

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]

const startsWith = (bytes: Uint8Array, sig: readonly number[]): boolean =>
  bytes.length >= sig.length && sig.every((b, i) => bytes[i] === b)

const u32 = (b: Uint8Array, o: number): number => ((b[o] << 24) | (b[o + 1] << 16) | (b[o + 2] << 8) | b[o + 3]) >>> 0
const u16 = (b: Uint8Array, o: number): number => (b[o] << 8) | b[o + 1]
const ascii = (b: Uint8Array, o: number, n: number): string => String.fromCharCode(...b.subarray(o, o + n))

export const hasAllowedExtension = (name: string): boolean => {
  const lower = name.trim().toLowerCase()
  return ALLOWED_EXTENSIONS.some((ext) => lower.endsWith(ext) && lower.length > ext.length)
}

/** PNG: signature, IHDR first, then a well-formed chunk chain ending in IEND. */
export function parsePng(b: Uint8Array): { width: number; height: number } | null {
  if (!startsWith(b, PNG_SIGNATURE) || b.length < 8 + 25 + 12) return null
  if (u32(b, 8) !== 13 || ascii(b, 12, 4) !== 'IHDR') return null
  const width = u32(b, 16)
  const height = u32(b, 20)
  let offset = 8
  let sawData = false
  while (offset + 12 <= b.length) {
    const len = u32(b, offset)
    const type = ascii(b, offset + 4, 4)
    if (!/^[A-Za-z]{4}$/.test(type)) return null
    const next = offset + 12 + len
    if (next > b.length) return null
    if (type === 'IDAT') sawData = true
    if (type === 'IEND') return sawData ? { width, height } : null
    offset = next
  }
  return null
}

const isSof = (m: number): boolean =>
  m >= 0xc0 && m <= 0xcf && m !== 0xc4 && m !== 0xc8 && m !== 0xcc

/** JPEG: SOI, then marker segments up to the first SOFn frame header. */
export function parseJpeg(b: Uint8Array): { width: number; height: number } | null {
  if (b.length < 4 || b[0] !== 0xff || b[1] !== 0xd8 || b[2] !== 0xff) return null
  let offset = 2
  while (offset < b.length) {
    if (b[offset] !== 0xff) return null
    // Any number of 0xFF fill bytes may precede a marker.
    while (offset < b.length && b[offset] === 0xff) offset++
    if (offset >= b.length) return null
    const marker = b[offset++]
    // Standalone markers carry no length.
    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) continue
    // End of image or start of scan before any frame header: not a usable image.
    if (marker === 0xd9 || marker === 0xda || marker === 0xd8 || marker === 0x00) return null
    if (offset + 2 > b.length) return null
    const len = u16(b, offset)
    if (len < 2 || offset + len > b.length) return null
    if (isSof(marker)) {
      if (len < 8) return null
      return { height: u16(b, offset + 3), width: u16(b, offset + 5) }
    }
    offset += len
  }
  return null
}

/** Validates file name + bytes. The MIME type always comes from the content. */
export function inspectImage(name: string, bytes: Uint8Array): ImageCheck {
  if (bytes.length > MAX_IMAGE_BYTES) return { ok: false, error: 'file_too_large' }
  if (bytes.length === 0 || !hasAllowedExtension(name)) return { ok: false, error: 'invalid_file' }
  let mime: ImageMime
  let dims: { width: number; height: number } | null
  if (startsWith(bytes, PNG_SIGNATURE)) {
    mime = 'image/png'
    dims = parsePng(bytes)
  } else if (startsWith(bytes, [0xff, 0xd8, 0xff])) {
    mime = 'image/jpeg'
    dims = parseJpeg(bytes)
  } else {
    return { ok: false, error: 'invalid_file' }
  }
  if (!dims) return { ok: false, error: 'invalid_file' }
  const { width, height } = dims
  if (width < 1 || height < 1 || width > MAX_IMAGE_SIDE || height > MAX_IMAGE_SIDE) {
    return { ok: false, error: 'invalid_file' }
  }
  return { ok: true, info: { mime, width, height } }
}
