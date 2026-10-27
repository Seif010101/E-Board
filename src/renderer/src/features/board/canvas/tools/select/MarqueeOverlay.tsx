import { useMarquee } from './marquee'

export function MarqueeOverlay() {
  const rect = useMarquee((s) => s.rect)
  if (!rect) return null
  return (
    <div
      className="bc-marquee"
      style={{ width: rect.w, height: rect.h, transform: `translate(${rect.x}px, ${rect.y}px)` }}
    />
  )
}
