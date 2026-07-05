import { supabase } from '../../lib/supabase'
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
