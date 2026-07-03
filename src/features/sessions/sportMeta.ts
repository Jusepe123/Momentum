import type { Enums } from '../../lib/database.types'

export type Sport = Enums<'sport'>

export const SPORTS: Sport[] = ['strength', 'run', 'swim']

export const sportMeta: Record<Sport, { label: string; distanceUnit: 'km' | 'm' | null }> = {
  strength: { label: 'Strength', distanceUnit: null },
  run: { label: 'Run', distanceUnit: 'km' },
  swim: { label: 'Swim', distanceUnit: 'm' },
}
