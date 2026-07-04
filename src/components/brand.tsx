import { useState } from 'react'

/**
 * Brand mark. Drop a square image at public/brand/logo.png (transparent
 * background, ~512px) and it replaces the built-in SVG on the next reload —
 * no code change needed. Until then the SVG below renders.
 */
export function LogoMark({ className = 'size-9' }: { className?: string }) {
  const [hasCustom, setHasCustom] = useState(true)
  if (hasCustom) {
    return (
      <img
        src="/brand/logo.png"
        alt=""
        aria-hidden
        onError={() => setHasCustom(false)}
        className={`${className} object-contain`}
      />
    )
  }
  return (
    <svg viewBox="0 0 48 48" className={className} aria-hidden="true">
      <rect x="2" y="2" width="44" height="44" rx="12" fill="#1a1a18" />
      <path
        d="M11 33 V17 L21 28 L31 17 V33"
        fill="none"
        stroke="#ffffff"
        strokeWidth="4.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="38.5" cy="33" r="3" fill="#d97706" />
    </svg>
  )
}

/** Logo mark + wordmark, used in the app nav. */
export function Logo({ markClass = 'size-8' }: { markClass?: string }) {
  return (
    <span className="inline-flex items-center gap-2.5">
      <LogoMark className={markClass} />
      <span className="font-display text-lg font-bold tracking-tight">
        Momentum<span className="text-accent">.</span>
      </span>
    </span>
  )
}

/**
 * Optional decorative image slot: renders nothing until a file exists at the
 * given public path (e.g. /brand/dashboard-hero.png), then shows it on reload.
 */
export function BrandImage({
  src,
  alt = '',
  className = '',
}: {
  src: string
  alt?: string
  className?: string
}) {
  const [ok, setOk] = useState(true)
  if (!ok) return null
  return (
    <img src={src} alt={alt} loading="lazy" onError={() => setOk(false)} className={className} />
  )
}
