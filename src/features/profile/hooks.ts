import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import type { Tables } from '../../lib/database.types'
import { resizeAvatarToDataUrl } from './image'

export type Profile = Pick<Tables<'profiles'>, 'avatar_url' | 'updated_at'>

/** The current user's profile row, or null if they've never saved one. The
 *  AuthProvider clears the whole query cache on user switch, so this key can't
 *  leak across accounts. */
export function useProfile() {
  return useQuery({
    queryKey: ['profile'],
    queryFn: async (): Promise<Profile | null> => {
      const { data: auth } = await supabase.auth.getUser()
      if (!auth.user) return null
      const { data, error } = await supabase
        .from('profiles')
        .select('avatar_url, updated_at')
        .eq('id', auth.user.id)
        .maybeSingle()
      if (error) throw error
      return data
    },
  })
}

/**
 * Resize the picked image to a small square JPEG and store it inline on the
 * profile row as a `data:` URL (Storage is bypassed — this project's Storage
 * service rejects JWT-signing-keys tokens; the Data API honors them). The
 * resize helper enforces the 5 MB / image-type limits. Invalidates useProfile.
 */
export function useUpdateAvatar() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (file: File): Promise<void> => {
      const { data: auth } = await supabase.auth.getUser()
      if (!auth.user) throw new Error('You are signed out — sign in and try again.')

      const dataUrl = await resizeAvatarToDataUrl(file)
      const { error } = await supabase
        .from('profiles')
        .upsert({ id: auth.user.id, avatar_url: dataUrl })
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['profile'] }),
  })
}

/**
 * The avatar image source, or null when the user has no photo. avatar_url is a
 * self-contained `data:` URL, so it needs no cache-busting — the value changes
 * whenever the image does.
 */
export function avatarSrc(profile: Profile | null | undefined): string | null {
  return profile?.avatar_url ?? null
}
