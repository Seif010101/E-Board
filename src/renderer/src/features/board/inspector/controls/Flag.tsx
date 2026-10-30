import { flagUrl } from '@renderer/lib/countries'

/** Country flag as an image (flag emoji do not render on Windows). */
export function Flag({ code, className = 'insp-flag' }: { code: string; className?: string }) {
  const url = flagUrl(code)
  if (!url) return <span className={`${className} ${className}--none`} aria-hidden="true" />
  return <img className={className} src={url} alt="" aria-hidden="true" draggable={false} />
}
