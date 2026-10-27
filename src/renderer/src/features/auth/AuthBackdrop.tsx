import { useId } from 'react'
import './AuthBackdrop.css'

type Pt = readonly [number, number]

// Decorative evidence-board constellation, in a 1600×1000 viewBox scaled to cover the window.
const PINS: readonly Pt[] = [
  [140, 170],
  [390, 90],
  [610, 250],
  [300, 430],
  [110, 660],
  [480, 600],
  [760, 760],
  [930, 150],
  [1150, 330],
  [1420, 130],
  [1320, 600],
  [1050, 840],
  [1520, 870],
  [820, 470],
  [240, 900]
]

const STRINGS: readonly Pt[] = [
  [0, 1],
  [1, 2],
  [0, 3],
  [3, 2],
  [3, 4],
  [3, 5],
  [5, 6],
  [2, 13],
  [13, 7],
  [7, 8],
  [8, 9],
  [8, 10],
  [10, 11],
  [10, 12],
  [13, 5],
  [6, 11],
  [4, 14],
  [1, 7],
  [13, 8]
]

interface PinnedCard {
  pin: number
  kind: 'photo' | 'note'
  rotate: number
}

const CARDS: readonly PinnedCard[] = [
  { pin: 1, kind: 'photo', rotate: -5 },
  { pin: 5, kind: 'note', rotate: 4 },
  { pin: 8, kind: 'photo', rotate: 6 },
  { pin: 12, kind: 'note', rotate: -3 },
  { pin: 4, kind: 'photo', rotate: 3 },
  { pin: 9, kind: 'note', rotate: -4 }
]

/** A string sagging slightly under its own weight between two pins. */
const stringPath = ([ax, ay]: Pt, [bx, by]: Pt): string => {
  const sag = Math.hypot(bx - ax, by - ay) * 0.07
  return `M${ax} ${ay} Q ${(ax + bx) / 2} ${(ay + by) / 2 + sag} ${bx} ${by}`
}

function Card({ card }: { card: PinnedCard }) {
  const [x, y] = PINS[card.pin]
  const photo = card.kind === 'photo'
  const w = photo ? 66 : 96
  const h = photo ? 80 : 62
  return (
    <g transform={`rotate(${card.rotate} ${x} ${y}) translate(${x - w / 2} ${y - 10})`}>
      <rect className="auth-bd__card" width={w} height={h} rx="2" />
      {photo ? (
        <>
          <rect className="auth-bd__photo" x="6" y="6" width={w - 12} height={h - 24} />
          <circle className="auth-bd__ink" cx={w / 2} cy="34" r="9" />
          <path className="auth-bd__ink" d={`M${w / 2 - 17} ${h - 18} q 17 -26 34 0 z`} />
        </>
      ) : (
        [18, 30, 42].map((ly) => (
          <rect key={ly} className="auth-bd__line" x="10" y={ly} width={ly === 42 ? w - 44 : w - 20} height="3" rx="1.5" />
        ))
      )}
    </g>
  )
}

/** Full-window decorative backdrop shared by the sign-in and lock screens. */
export function AuthBackdrop() {
  const uid = useId()
  const grain = `${uid}-grain`
  const pin = `${uid}-pin`

  return (
    <div className="auth-bd" aria-hidden="true">
      <svg className="auth-bd__grain" width="100%" height="100%" focusable="false">
        <filter id={grain}>
          <feTurbulence type="fractalNoise" baseFrequency="0.8" numOctaves="3" stitchTiles="stitch" />
          <feColorMatrix type="saturate" values="0" />
        </filter>
        <rect width="100%" height="100%" filter={`url(#${grain})`} />
      </svg>
      <svg className="auth-bd__web" viewBox="0 0 1600 1000" preserveAspectRatio="xMidYMid slice" focusable="false">
        <defs>
          <radialGradient id={pin} cx="35%" cy="30%" r="75%">
            <stop offset="0" stopColor="#ff9b9b" />
            <stop offset="0.45" stopColor="#d62a31" />
            <stop offset="1" stopColor="#6e0c10" />
          </radialGradient>
        </defs>
        {CARDS.map((c) => (
          <Card key={c.pin} card={c} />
        ))}
        {STRINGS.map(([a, b], i) => {
          const d = stringPath(PINS[a], PINS[b])
          const start = 200 + i * 110
          return (
            <g key={`${a}-${b}`}>
              <path className="auth-bd__string" d={d} pathLength={1} style={{ animationDelay: `${start}ms` }} />
              {/* The yarn texture fades in once the strand is fully drawn. */}
              <path className="auth-bd__twist" d={d} style={{ animationDelay: `${start + 1500}ms` }} />
            </g>
          )
        })}
        {PINS.map(([x, y]) => (
          <g key={`${x}-${y}`} className="auth-bd__pin">
            <ellipse cx={x + 4} cy={y + 6} rx="7" ry="3" className="auth-bd__pin-shadow" />
            <circle cx={x} cy={y} r="7.5" fill={`url(#${pin})`} />
            <circle cx={x - 2.5} cy={y - 2.8} r="2.2" fill="#fff" opacity="0.55" />
          </g>
        ))}
      </svg>
    </div>
  )
}
