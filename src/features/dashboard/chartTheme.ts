/**
 * Shared Recharts styling for the light surface. Colors reference the same
 * tokens as index.css; text always wears ink tokens, never series colors.
 */
export const chart = {
  accent: '#d97706',
  ink: '#1a1a18',
  inkDim: '#6f6e69',
  inkFaint: '#a3a29c',
  line: '#e6e5e1',
  surface: '#ffffff',
  ok: '#15803d',
  danger: '#dc2626',
} as const

export const axisProps = {
  stroke: chart.inkFaint,
  tick: { fill: chart.inkDim, fontSize: 11 },
  axisLine: false,
  tickLine: false,
} as const
