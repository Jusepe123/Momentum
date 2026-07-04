import type { Sport } from '../features/sessions/sportMeta'

/**
 * Olympic-pictogram-style silhouettes, one per sport. They inherit
 * currentColor, so wrap them in a text-sport-* class (see sportColors.ts)
 * for identity color.
 */

const stroke = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 4,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
} as const

/** Overhead squat: barbell locked out, hips low. */
function StrengthIcon() {
  return (
    <>
      <path d="M7 13 H41" {...stroke} />
      <path d="M11 7 V19" {...stroke} />
      <path d="M37 7 V19" {...stroke} />
      <circle cx="24" cy="20" r="3.2" fill="currentColor" />
      <path d="M15 13 L21 25" {...stroke} />
      <path d="M33 13 L27 25" {...stroke} />
      <path d="M24 25 V31" {...stroke} />
      <path d="M24 31 L17 35 L19 42" {...stroke} />
      <path d="M24 31 L31 35 L29 42" {...stroke} />
    </>
  )
}

/** Mid-stride runner, arms driving. */
function RunIcon() {
  return (
    <>
      <circle cx="30" cy="8.5" r="3.2" fill="currentColor" />
      <path d="M28 14 L22 27" {...stroke} />
      <path d="M27 16 L34 19 L40 14" {...stroke} />
      <path d="M27 16 L20 20 L14 17" {...stroke} />
      <path d="M22 27 L30 32 L29 41" {...stroke} />
      <path d="M22 27 L16 33 L9 30" {...stroke} />
    </>
  )
}

/** Freestyle: extended body line, recovery arm arcing, water below. */
function SwimIcon() {
  return (
    <>
      <circle cx="32" cy="18.5" r="3.2" fill="currentColor" />
      <path d="M6 25 L42 23" {...stroke} />
      <path d="M12 24 C16 10, 28 8, 33 17" {...stroke} />
      <path d="M6 33 q4.5 -3.5 9 0 t9 0 t9 0 t9 0" {...stroke} strokeWidth={3} />
    </>
  )
}

const icons: Record<Sport, () => React.ReactElement> = {
  strength: StrengthIcon,
  run: RunIcon,
  swim: SwimIcon,
}

export function SportIcon({
  sport,
  className = 'size-6',
  title,
}: {
  sport: Sport
  className?: string
  title?: string
}) {
  const Body = icons[sport]
  return (
    <svg
      viewBox="0 0 48 48"
      className={className}
      role={title ? 'img' : undefined}
      aria-hidden={title ? undefined : true}
    >
      {title && <title>{title}</title>}
      <Body />
    </svg>
  )
}
