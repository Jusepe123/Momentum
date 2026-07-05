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

/** Road bike: two wheels, diamond frame, handlebars. */
function BikeIcon() {
  return (
    <>
      <circle cx="11" cy="33" r="8" {...stroke} />
      <circle cx="37" cy="33" r="8" {...stroke} />
      <path d="M11 33 L21 15 L34 15" {...stroke} />
      <path d="M21 15 L27 33 L37 33" {...stroke} />
      <path d="M11 33 L27 33" {...stroke} />
      <path d="M31 12 H38" {...stroke} />
    </>
  )
}

const icons: Record<Sport, () => React.ReactElement> = {
  strength: StrengthIcon,
  run: RunIcon,
  bike: BikeIcon,
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
