/**
 * Momentum light editorial palette — mirrors the web tokens in src/index.css @theme.
 * Keep in sync by eye, not by import: this app has no build-time coupling to the web.
 */
export const colors = {
  surface: '#f7f7f5', // warm off-white page
  panel: '#ffffff', // cards
  line: '#e6e5e1', // hairline borders
  ink: '#1a1a18', // near-black text
  inkDim: '#6f6e69',
  inkFaint: '#a3a29b',
  accent: '#d97706', // amber — data/brand only, used sparingly
  run: '#0d9488', // per-sport identity hue (teal)
  danger: '#dc2626',
} as const

export const fonts = {
  /** Numerals + headings (matches web font-display) */
  display: 'SpaceGrotesk_700Bold',
  displayMedium: 'SpaceGrotesk_500Medium',
  text: 'Inter_400Regular',
  textSemi: 'Inter_600SemiBold',
} as const
