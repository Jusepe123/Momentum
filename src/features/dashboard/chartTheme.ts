/**
 * Shared Recharts styling for the dark surface. Colors reference the same
 * tokens as index.css; text always wears ink tokens, never series colors.
 */
export const chart = {
  accent: '#f5a623',
  ink: '#e7e9ee',
  inkDim: '#9aa1ad',
  inkFaint: '#6b7280',
  line: '#262b35',
  surface: '#0f1115',
  ok: '#4ade80',
  danger: '#f0655a',
} as const

export const axisProps = {
  stroke: chart.inkFaint,
  tick: { fill: chart.inkFaint, fontSize: 11 },
  axisLine: false,
  tickLine: false,
} as const
