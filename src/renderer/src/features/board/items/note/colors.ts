// Sticky note paper tones per board theme. The stored value is the colour name (NoteColor);
// how it looks depends on the board: pastel paper, aged paper on cork, or neon on a terminal.

import { NOTE_COLORS, type BoardTheme, type NoteColor } from '@shared/types'
import type { Swatch } from '../../toolbar/controls/palettes'

export const NOTE_PAPER: Record<BoardTheme, Record<NoteColor, string>> = {
  normal: {
    yellow: '#fff1a6',
    pink: '#ffd5e6',
    red: '#ffc9c2',
    orange: '#ffdcb0',
    green: '#d3f3c6',
    blue: '#cde5ff',
    purple: '#e2d6ff',
    white: '#ffffff'
  },
  detective: {
    yellow: '#f3e39a',
    pink: '#eccbcd',
    red: '#e6b2a6',
    orange: '#eecb98',
    green: '#d0dfae',
    blue: '#c6d6df',
    purple: '#d6c8dd',
    white: '#f3eddd'
  },
  hacker: {
    yellow: '#ffe066',
    pink: '#ff6ec7',
    red: '#ff5263',
    orange: '#ff9f43',
    green: '#19e27a',
    blue: '#4dabf7',
    purple: '#b388ff',
    white: '#dff7ea'
  }
}

/** Ink used on the paper. Hacker notes write in their own neon colour instead. */
export const NOTE_INK: Record<Exclude<BoardTheme, 'hacker'>, string> = {
  normal: '#2b2a26',
  detective: '#1f2b47'
}

/** Swatches whose value is the colour name; display them with `notePaper(theme)`. */
export const NOTE_SWATCHES: readonly Swatch[] = NOTE_COLORS.map((c) => ({ name: c, value: c }))

export const isNoteColor = (v: string): v is NoteColor => (NOTE_COLORS as readonly string[]).includes(v)

export const notePaper =
  (theme: BoardTheme) =>
  (swatch: Swatch): string =>
    isNoteColor(swatch.value) ? NOTE_PAPER[theme][swatch.value] : NOTE_PAPER[theme].yellow
