import type { BoardTheme } from '@shared/types'

// Colour palettes offered by the toolbar flyouts and the item inspectors.
// `name` is an i18n key under toolbar.colors.*; values are #rrggbb (the only format the schemas accept).

export interface Swatch {
  name: string
  value: string
}

export const PEN_COLORS: readonly Swatch[] = [
  { name: 'red', value: '#e03131' },
  { name: 'black', value: '#1c1b19' },
  { name: 'white', value: '#ffffff' },
  { name: 'blue', value: '#1c7ed6' },
  { name: 'green', value: '#2f9e44' },
  { name: 'yellow', value: '#fcc419' },
  { name: 'orange', value: '#f76707' },
  { name: 'purple', value: '#7048e8' },
  { name: 'pink', value: '#d6336c' },
  { name: 'grey', value: '#868e96' }
]

export const HIGHLIGHTER_COLORS: readonly Swatch[] = [
  { name: 'yellow', value: '#ffd43b' },
  { name: 'green', value: '#69db7c' },
  { name: 'pink', value: '#f783ac' },
  { name: 'blue', value: '#74c0fc' },
  { name: 'orange', value: '#ffa94d' }
]

export const SHAPE_STROKES: readonly Swatch[] = PEN_COLORS

export const SHAPE_FILLS: readonly Swatch[] = [
  { name: 'white', value: '#ffffff' },
  { name: 'light_yellow', value: '#fff3bf' },
  { name: 'light_red', value: '#ffe3e3' },
  { name: 'light_orange', value: '#ffe8cc' },
  { name: 'light_green', value: '#d3f9d8' },
  { name: 'light_blue', value: '#d0ebff' },
  { name: 'light_purple', value: '#e5dbff' },
  { name: 'light_grey', value: '#e9ecef' },
  { name: 'black', value: '#1c1b19' }
]

export const TEXT_COLORS: readonly Swatch[] = [...PEN_COLORS, { name: 'neon_green', value: '#19e27a' }]

/** Default text ink per board theme: dark ink on paper and cork, phosphor green on the terminal. */
export const TEXT_INK: Record<BoardTheme, string> = {
  normal: '#1c1b19',
  detective: '#1c1b19',
  hacker: '#19e27a'
}

export const sameColor = (a: string, b: string): boolean => a.toLowerCase() === b.toLowerCase()
