// Slider ranges shared by the toolbar flyouts and the item inspectors (all within the item schemas).

export interface Range {
  min: number
  max: number
}

export const RANGES = {
  pen: { min: 1, max: 24 },
  highlighter: { min: 8, max: 40 },
  /** Eraser diameter in screen px. */
  eraser: { min: 8, max: 80 },
  shapeStroke: { min: 1, max: 16 },
  textFont: { min: 8, max: 120 },
  noteFont: { min: 10, max: 72 }
} as const satisfies Record<string, Range>
