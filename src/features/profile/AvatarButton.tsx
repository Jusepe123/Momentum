import { useRef, type ChangeEvent } from 'react'
import { useAuth } from '../auth/AuthProvider'
import { Spinner } from '../../components/ui'
import { avatarSrc, useProfile, useUpdateAvatar } from './hooks'

/**
 * Nav profile avatar. Shows the user's photo (or their email initial as a
 * fallback, mirroring the mobile Home header); clicking it opens the file
 * picker and uploads the chosen image as the new photo.
 */
export function AvatarButton() {
  const { session } = useAuth()
  const { data: profile } = useProfile()
  const updateAvatar = useUpdateAvatar()
  const inputRef = useRef<HTMLInputElement>(null)

  const initial = (session?.user.email?.trim()?.[0] ?? '·').toUpperCase()
  const src = avatarSrc(profile)
  const busy = updateAvatar.isPending

  function onFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = '' // let the user re-pick the same file after an error
    if (file) updateAvatar.mutate(file)
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => !busy && inputRef.current?.click()}
        disabled={busy}
        aria-label={src ? 'Change profile photo' : 'Add a profile photo'}
        title="Update profile photo"
        className="relative block size-9 overflow-hidden rounded-full border border-line bg-accent/10 transition-shadow duration-200 hover:ring-2 hover:ring-accent/30 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 disabled:cursor-default"
      >
        {src ? (
          <img src={src} alt="" className="size-full object-cover" />
        ) : (
          <span className="flex size-full items-center justify-center font-display text-sm font-semibold text-accent">
            {initial}
          </span>
        )}
        {busy && (
          <span className="absolute inset-0 flex items-center justify-center bg-panel/70">
            <Spinner />
          </span>
        )}
      </button>

      {updateAvatar.isError && (
        <span
          role="alert"
          className="absolute right-0 top-full z-10 mt-1 w-max max-w-56 rounded-md border border-danger/30 bg-panel px-2 py-1 text-xs text-danger shadow-sm"
        >
          {updateAvatar.error instanceof Error
            ? updateAvatar.error.message
            : 'Upload failed — try again.'}
        </span>
      )}

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        onChange={onFile}
        className="hidden"
      />
    </div>
  )
}
