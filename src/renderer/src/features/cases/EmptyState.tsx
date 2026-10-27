import type { ReactNode } from 'react'
import './EmptyState.css'

type Art = 'cases' | 'boards' | 'search' | 'error'

interface EmptyStateProps {
  art: Art
  title: string
  text: string
  action?: ReactNode
}

export function EmptyState({ art, title, text, action }: EmptyStateProps) {
  return (
    <div className="cases-state" role="status">
      <div className="cases-state__art">{ART[art]}</div>
      <h2 className="cases-state__title">{title}</h2>
      <p className="cases-state__text">{text}</p>
      {action && <div className="cases-state__action">{action}</div>}
    </div>
  )
}

const svgProps = {
  width: 240,
  height: 170,
  viewBox: '0 0 240 170',
  'aria-hidden': true,
  focusable: false
} as const

/** Empty manila folder pinned to a board, string sagging behind it, magnifier in front. */
const CasesArt = (
  <svg {...svgProps}>
    <rect className="cases-art__board" x="18" y="12" width="204" height="138" rx="18" />
    <path className="cases-art__string" d="M38 38 Q 120 80 202 32" />
    <path
      className="cases-art__folder-back"
      d="M60 52 h40 l8 10 h72 a6 6 0 0 1 6 6 v62 a6 6 0 0 1 -6 6 H60 a6 6 0 0 1 -6 -6 V58 a6 6 0 0 1 6 -6 z"
    />
    <g transform="rotate(-3 118 80)">
      <rect className="cases-art__paper" x="66" y="60" width="106" height="44" rx="2" />
      <path className="cases-art__rule" d="M76 70 H150 M76 77 H138" />
    </g>
    <rect className="cases-art__folder-front" x="54" y="84" width="132" height="54" rx="6" />
    <g transform="rotate(-8 150 104)">
      <rect className="cases-art__stamp" x="128" y="97" width="44" height="14" rx="2" />
      <path className="cases-art__stamp-line" d="M134 104 H166" />
    </g>
    <circle className="cases-art__pin-shadow" cx="40" cy="40" r="5.5" />
    <circle className="cases-art__pin" cx="38" cy="38" r="5.5" />
    <circle className="cases-art__pin-shadow" cx="204" cy="34" r="5.5" />
    <circle className="cases-art__pin" cx="202" cy="32" r="5.5" />
    <circle className="cases-art__lens" cx="186" cy="116" r="17" />
    <path className="cases-art__handle" d="M198.5 128.5 L212 142" />
  </svg>
)

/** A blank evidence sheet with two cards joined by a red thread and a "+" badge. */
const BoardsArt = (
  <svg {...svgProps}>
    <path className="cases-art__sheet" d="M46 22 h132 l16 16 v104 a6 6 0 0 1 -6 6 H46 a6 6 0 0 1 -6 -6 V28 a6 6 0 0 1 6 -6 z" />
    <path className="cases-art__fold" d="M178 22 v12 a4 4 0 0 0 4 4 h12 z" />
    <rect className="cases-art__card" x="62" y="44" width="46" height="54" rx="4" />
    <circle className="cases-art__avatar" cx="85" cy="62" r="9" />
    <path className="cases-art__rule" d="M72 82 H98 M75 89 H95" />
    <rect className="cases-art__card" x="128" y="82" width="48" height="48" rx="4" />
    <rect className="cases-art__avatar" x="138" y="91" width="16" height="16" rx="2" />
    <path className="cases-art__rule" d="M138 115 H166 M138 122 H158" />
    <path className="cases-art__string" d="M85 47 Q 112 100 152 85" />
    <circle className="cases-art__pin" cx="85" cy="47" r="4.5" />
    <circle className="cases-art__pin" cx="152" cy="85" r="4.5" />
    <circle className="cases-art__badge" cx="190" cy="138" r="15" />
    <path className="cases-art__badge-plus" d="M190 131 V145 M183 138 H197" />
  </svg>
)

/** Magnifier over an empty sheet: nothing matched. */
const SearchArt = (
  <svg {...svgProps}>
    <rect className="cases-art__board" x="18" y="12" width="204" height="138" rx="18" />
    <g transform="rotate(-4 108 84)">
      <rect className="cases-art__paper" x="64" y="38" width="88" height="96" rx="3" />
      <path className="cases-art__rule" d="M76 56 H140 M76 66 H128 M76 76 H136 M76 86 H118" />
    </g>
    <circle className="cases-art__lens" cx="150" cy="96" r="24" />
    <path className="cases-art__handle" d="M167.5 113.5 L188 134" />
    <path className="cases-art__cross" d="M141 87 L159 105 M159 87 L141 105" />
  </svg>
)

/** A torn red string between two pins: the library failed to load. */
const ErrorArt = (
  <svg {...svgProps}>
    <rect className="cases-art__board" x="18" y="12" width="204" height="138" rx="18" />
    <path className="cases-art__string" d="M56 54 Q 82 92 108 86" />
    <path className="cases-art__string" d="M132 92 Q 160 96 184 58" />
    <circle className="cases-art__pin-shadow" cx="58" cy="56" r="6" />
    <circle className="cases-art__pin" cx="56" cy="54" r="6" />
    <circle className="cases-art__pin-shadow" cx="186" cy="60" r="6" />
    <circle className="cases-art__pin" cx="184" cy="58" r="6" />
    <path className="cases-art__spark" d="M120 72 v10 M120 98 v10 M106 90 h-8 M134 90 h8" />
  </svg>
)

const ART: Record<Art, ReactNode> = {
  cases: CasesArt,
  boards: BoardsArt,
  search: SearchArt,
  error: ErrorArt
}
