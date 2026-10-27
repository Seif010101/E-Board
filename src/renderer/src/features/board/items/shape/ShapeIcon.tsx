import type { ShapeKind } from '@shared/types'

const PATHS: Record<ShapeKind, string> = {
  rect: 'M3.5 5.5h17v13h-17z',
  roundRect: 'M7.5 5.5h9a4 4 0 0 1 4 4v5a4 4 0 0 1-4 4h-9a4 4 0 0 1-4-4v-5a4 4 0 0 1 4-4z',
  ellipse: 'M3.5 12a8.5 6.5 0 1 0 17 0a8.5 6.5 0 1 0-17 0',
  triangle: 'M12 4.5l8.5 15h-17z',
  diamond: 'M12 3.5l8.5 8.5-8.5 8.5-8.5-8.5z',
  line: 'M5 19L19 5',
  arrow: 'M5 19L18 6M10.5 5.5H18.5V13.5'
}

/** Line-art icon of a shape kind, drawn like the lucide icons around it. */
export function ShapeIcon({ kind, size = 18 }: { kind: ShapeKind; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={PATHS[kind]} />
    </svg>
  )
}
