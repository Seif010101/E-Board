// Shared look-up tables for the formatting options of text boxes.

import type { TextFont, TextSpacing } from '@shared/types'

/** The default font (the board's own title face) is not listed: it comes from the theme. */
export const TEXT_FONT_STACKS: Record<Exclude<TextFont, 'default'>, string> = {
  sans: "'Segoe UI', system-ui, -apple-system, 'Noto Sans Arabic', Roboto, Arial, sans-serif",
  serif: "Georgia, 'Times New Roman', 'Noto Naskh Arabic', serif",
  mono: "Consolas, 'Courier New', ui-monospace, monospace",
  hand: "'Segoe Print', 'Bradley Hand', 'Comic Sans MS', 'Noto Kufi Arabic', cursive"
}

export const TEXT_SPACING_VALUES: Record<TextSpacing, number> = { tight: 1.1, normal: 1.3, loose: 1.7 }
