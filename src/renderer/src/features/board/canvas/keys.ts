// Human-readable key combinations for menus, tooltips and the shortcuts dialog.

import type { TFunction } from 'i18next'

/** Named keys are translated; anything else (letters, symbols, F-keys) is shown as-is. */
const NAMED = new Set(['mod', 'shift', 'alt', 'del', 'backspace', 'enter', 'esc', 'space', 'arrows', 'wheel', 'drag', 'click', 'middle'])

/** One key's label, e.g. 'mod' → "Ctrl". */
export const keyLabel = (t: TFunction, key: string): string => (NAMED.has(key) ? t(`board.keys.${key}`) : key)

/** e.g. ['mod', 'shift', 'Z'] → "Ctrl+Shift+Z". */
export function formatKeys(t: TFunction, keys: readonly string[]): string {
  return keys.map((k) => keyLabel(t, k)).join('+')
}

/** "Label (Ctrl+Z)" for tooltips. */
export const withKeys = (t: TFunction, label: string, keys: readonly string[]): string =>
  `${label} (${formatKeys(t, keys)})`

export const KEYS = {
  undo: ['mod', 'Z'],
  redo: ['mod', 'shift', 'Z'],
  redoAlt: ['mod', 'Y'],
  selectAll: ['mod', 'A'],
  duplicate: ['mod', 'D'],
  copy: ['mod', 'C'],
  cut: ['mod', 'X'],
  paste: ['mod', 'V'],
  delete: ['del'],
  front: [']'],
  back: ['['],
  details: ['enter'],
  escape: ['esc'],
  zoomIn: ['mod', '='],
  zoomOut: ['mod', '-'],
  zoomReset: ['mod', '0'],
  fit: ['mod', '1'],
  search: ['mod', 'F'],
  rename: ['F2'],
  shortcuts: ['?'],
  menu: ['shift', 'F10']
} as const satisfies Record<string, readonly string[]>
