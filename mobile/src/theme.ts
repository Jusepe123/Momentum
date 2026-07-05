/**
 * Momentum light editorial palette — mirrors the web tokens in src/index.css @theme.
 * Keep in sync by eye, not by import: this app has no build-time coupling to the web.
 */
export const colors = {
  surface: '#f7f7f5', // warm off-white page
  panel: '#ffffff', // cards
  paper: '#f4f4ef', // brand artwork paper color (sampled from the hero PNG)
  line: '#e8e6e1', // hairline borders (redesign token)
  ink: '#1a1a18', // near-black text
  inkDim: '#6b675f', // secondary body text (subtitles, hints)
  inkFaint: '#8a867d', // labels, eyebrows, meta
  muted: '#a8a49b', // input placeholders — one step lighter than labels
  accent: '#d97706', // amber — data/brand only, used sparingly
  run: '#0d9488', // per-sport identity hue (teal) — kept for existing references
  danger: '#dc2626',
} as const

/**
 * Per-sport identity hues — mirrors the web tokens
 * --color-sport-{strength,run,swim→bike} (CVD-checked). Used only for that
 * sport's own identity (icon, status pill, FGS notification color).
 */
export const sportColor = {
  strength: '#d97706', // amber
  run: '#0d9488', // teal
  bike: '#2563eb', // blue
} as const

export type Sport = keyof typeof sportColor

export const fonts = {
  /** Big numerals + heavy emphasis (recorder hero digits) */
  display: 'SpaceGrotesk_700Bold',
  /** Headings, wordmark, card titles — the redesign's default heading weight */
  displaySemi: 'SpaceGrotesk_600SemiBold',
  displayMedium: 'SpaceGrotesk_500Medium',
  text: 'Inter_400Regular',
  textSemi: 'Inter_600SemiBold',
} as const
