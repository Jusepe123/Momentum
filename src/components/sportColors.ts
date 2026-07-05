import type { Sport } from '../features/sessions/sportMeta'

/** Identity color per sport — pair with SportIcon (inherits currentColor). */
export const sportColorClass: Record<Sport, string> = {
  strength: 'text-sport-strength',
  run: 'text-sport-run',
  bike: 'text-sport-bike',
}

export const sportBgClass: Record<Sport, string> = {
  strength: 'bg-sport-strength/10',
  run: 'bg-sport-run/10',
  bike: 'bg-sport-bike/10',
}
