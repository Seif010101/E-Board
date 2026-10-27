/** Placeholder portrait: a round head above a half-circle body, coloured by the board theme. */
export function DefaultAvatar() {
  return (
    <svg className="cd-avatar" viewBox="0 0 100 100" preserveAspectRatio="xMidYMax slice" aria-hidden="true" focusable="false">
      <rect className="cd-avatar__bg" width="100" height="100" />
      <circle className="cd-avatar__fg" cx="50" cy="39" r="17" />
      <path className="cd-avatar__fg" d="M14 100a36 36 0 0 1 72 0z" />
    </svg>
  )
}
