import { useId } from 'react'

/** E-Board mark: a red push pin holding two strands of investigation string. */
export function LogoMark({ size = 48 }: { size?: number }) {
  const uid = useId()
  const head = `${uid}-head`
  const strand = 'M30 30 C 40 46, 50 34, 61 54'
  const strand2 = 'M27 31 C 18 42, 11 36, 3 50'

  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true" focusable="false">
      <defs>
        <radialGradient id={head} cx="36%" cy="30%" r="72%">
          <stop offset="0" stopColor="#ff9b9b" />
          <stop offset="0.42" stopColor="#d62a31" />
          <stop offset="1" stopColor="#6e0c10" />
        </radialGradient>
      </defs>
      {[strand, strand2].map((d) => (
        <g key={d} fill="none" strokeLinecap="round">
          <path d={d} stroke="#b3151b" strokeWidth="2.6" />
          <path d={d} stroke="#5a080b" strokeWidth="2.6" strokeDasharray="1.1 2.4" opacity="0.6" />
        </g>
      ))}
      <ellipse cx="33" cy="38" rx="7.5" ry="2.4" fill="#000" opacity="0.28" />
      <path d="M28.5 27 L 33.5 38" stroke="#c9ccd2" strokeWidth="2" strokeLinecap="round" />
      <circle cx="27" cy="22" r="11.5" fill={`url(#${head})`} />
      <ellipse cx="23" cy="17.5" rx="3.8" ry="2.6" fill="#fff" opacity="0.55" transform="rotate(-25 23 17.5)" />
    </svg>
  )
}
