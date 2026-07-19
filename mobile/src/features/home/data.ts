import { supabase } from '../../lib/supabase'
import { todayLocalISO } from '../../lib/dates'
import { weekStartISO } from '../../lib/weekStart'
import type { Tables } from '../../lib/database.types'

export type Profile = Pick<Tables<'profiles'>, 'avatar_url' | 'updated_at'>

/** The signed-in user's profile (just the avatar today), or null if they've
 *  never set one on the web. Mobile is display-only — it never writes this. */
export async function fetchProfile(): Promise<Profile | null> {
  const { data: auth } = await supabase.auth.getUser()
  if (!auth.user) return null
  const { data, error } = await supabase
    .from('profiles')
    .select('avatar_url, updated_at')
    .eq('id', auth.user.id)
    .maybeSingle()
  if (error) throw error
  return data
}

/** Avatar image source, or null when the user has no photo. avatar_url is a
 *  self-contained `data:` URL (set on the web), which RN's Image renders
 *  directly — no cache-busting needed since the value changes with the image. */
export function avatarUri(profile: Profile | null): string | null {
  return profile?.avatar_url ?? null
}

export interface WeekDistance {
  runKm: number
  bikeKm: number
}

/** Run and bike km logged since Monday (local calendar week, matching the web
 *  "Distance this week" card). RLS scopes the query to the signed-in user. */
export async function fetchWeekDistance(): Promise<WeekDistance> {
  const { data, error } = await supabase
    .from('sessions')
    .select('sport, cardio_details(distance_m)')
    .in('sport', ['run', 'bike'])
    .gte('date', weekStartISO(todayLocalISO()))
  if (error) throw error
  let runM = 0
  let bikeM = 0
  for (const row of data) {
    const m = row.cardio_details?.distance_m ?? 0
    if (row.sport === 'run') runM += m
    else bikeM += m
  }
  return { runKm: runM / 1000, bikeKm: bikeM / 1000 }
}
