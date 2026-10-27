// Cork board texture for the detective theme.
//
// Two seamless feTurbulence tiles are layered: a fine grain tile (granules and pits) and a much
// larger, unrelated-size mottling tile (broad light/dark patches). Because the two periods do not
// line up, the combined pattern never shows an obvious repeating grid.
// Re-running the filters on every zoom frame would be expensive, so each tile is rasterised once
// into a bitmap and the canvas only rescales the images.

/** Grain tile edge in world px. */
export const CORK_TILE = 512
/** Mottling tile edge in world px (deliberately not a multiple of CORK_TILE). */
export const CORK_MOTTLE_TILE = 1418

type Rgb = [r: number, g: number, b: number]

/**
 * One noise layer: turbulence → flat colour whose alpha is a thresholded noise channel.
 * `alpha` is the last colour-matrix row ("kR kG kB kA offset").
 */
const layer = (id: string, freq: number, octaves: number, seed: number, [r, g, b]: Rgb, alpha: string) =>
  `<filter id='${id}' x='0' y='0' width='100%' height='100%' color-interpolation-filters='sRGB'>` +
  `<feTurbulence type='fractalNoise' baseFrequency='${freq}' numOctaves='${octaves}' seed='${seed}' stitchTiles='stitch'/>` +
  `<feColorMatrix type='matrix' values='0 0 0 0 ${r} 0 0 0 0 ${g} 0 0 0 0 ${b} ${alpha}'/>` +
  `</filter><rect width='100%' height='100%' filter='url(%23${id})'/>`

const svg = (size: number, body: string) =>
  `<svg xmlns='http://www.w3.org/2000/svg' width='${size}' height='${size}' viewBox='0 0 ${size} ${size}'>${body}</svg>`

const GRAIN_SVG = svg(
  CORK_TILE,
  `<rect width='100%' height='100%' fill='%23926339'/>` +
    // gentle mid-scale unevenness so the grain itself is not flat
    layer('v', 0.035, 2, 23, [0.42, 0.25, 0.11], '0.9 0 0 0 -0.38') +
    // pits: sparse larger dark specks
    layer('p', 0.16, 1, 5, [0.19, 0.1, 0.04], '7 0 0 0 -4.75') +
    // fine dark granules
    layer('d', 0.72, 2, 3, [0.22, 0.12, 0.05], '5 0 0 0 -2.95') +
    // fine light granules
    layer('g', 0.9, 2, 11, [0.88, 0.69, 0.45], '0 5 0 0 -3.2')
)

const MOTTLE_SVG = svg(
  CORK_MOTTLE_TILE,
  // broad darker / lighter patches on a transparent tile, laid over the grain
  layer('m', 0.0042, 3, 7, [0.27, 0.15, 0.06], '1.1 0 0 0 -0.47') +
    layer('l', 0.0061, 2, 19, [0.8, 0.58, 0.34], '0 -0.9 0 0 0.36')
)

const svgUrl = (s: string) => `url("data:image/svg+xml,${s}")`

/** Rasterise an SVG tile to a blob URL at `scale` (falls back to the SVG itself). */
const rasterise = (source: string, size: number, scale: number): Promise<string> =>
  new Promise<string>((resolve) => {
    const img = new Image()
    img.decoding = 'async'
    img.onload = () => {
      try {
        const px = Math.round(size * scale)
        const canvas = document.createElement('canvas')
        canvas.width = px
        canvas.height = px
        const ctx = canvas.getContext('2d')
        if (!ctx) return resolve(svgUrl(source))
        ctx.drawImage(img, 0, 0, px, px)
        canvas.toBlob((blob) => resolve(blob ? `url("${URL.createObjectURL(blob)}")` : svgUrl(source)), 'image/png')
      } catch {
        resolve(svgUrl(source))
      }
    }
    img.onerror = () => resolve(svgUrl(source))
    img.src = `data:image/svg+xml,${source}`
  })

let cached: Promise<string> | null = null

/**
 * CSS background-image value for the cork: "url(mottle), url(grain)" — paired with
 * background-size "var(--bc-cork-m) var(--bc-cork-m), var(--bc-cork) var(--bc-cork)".
 * Rasterised once per session.
 */
export function corkTextureUrl(): Promise<string> {
  cached ??= Promise.all([
    // The mottling is smooth, so a half-resolution bitmap is indistinguishable and much smaller.
    rasterise(MOTTLE_SVG, CORK_MOTTLE_TILE, 0.5),
    rasterise(GRAIN_SVG, CORK_TILE, 2)
  ]).then(([mottle, grain]) => `${mottle}, ${grain}`)
  return cached
}
