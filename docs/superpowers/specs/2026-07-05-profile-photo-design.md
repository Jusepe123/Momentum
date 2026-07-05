# Profile photo — design

**Date:** 2026-07-05
**Status:** Approved

## Goal

Let a user set a profile photo on the **web** app (click a profile icon → pick an
image → it uploads and replaces the current photo), and **display** that photo in
the **mobile** app's Home header. Mobile is display-only.

## Data model

New `profiles` table (migration `0005_profiles.sql`), one row per user:

| column       | type          | notes                                             |
|--------------|---------------|---------------------------------------------------|
| `id`         | uuid PK       | `references auth.users(id) on delete cascade`     |
| `avatar_url` | text (null)   | full public URL of the current photo              |
| `updated_at` | timestamptz   | `not null default now()` — drives cache-busting   |

No `display_name` yet (YAGNI); the table name leaves room for later.

Rows are created lazily by an **upsert** on first avatar save (no signup trigger
needed — the only writer is the avatar upload). Reads use `maybeSingle()` so a
missing row is `null`, not an error.

## Storage

Supabase Storage bucket **`avatars`** (public). One image per user at a **fixed
path**: `avatars/{user_id}/avatar.jpg`, uploaded with `upsert: true`.

- Fixed path ⇒ no orphaned files on replace.
- Same URL after replace ⇒ CDN/browser cache would show the old image, so both
  apps render `${avatar_url}?v=${Date.parse(updated_at)}` to bust the cache.
- Client always transcodes to JPEG, so the extension is stable.

## Web — upload

Location: `src/features/auth/ProtectedLayout.tsx` nav bar, right side. "Sign out"
stays; a circular **avatar button** sits next to it.

- Shows the photo if set, else the email's first initial (mirrors mobile's
  fallback).
- Click → hidden `<input type="file" accept="image/*">`. On pick:
  1. Load the file into an `Image`.
  2. Center-crop + resize to **256×256 on a `<canvas>`**, export **JPEG ~0.85**
     (~15–30 KB). No external libraries.
  3. Upload to `avatars/{uid}/avatar.jpg` (`upsert: true`).
  4. **Upsert** the `profiles` row: `avatar_url` = public URL, `updated_at = now`.
- A small spinner overlays the avatar while uploading; errors surface inline.
- Data access: a React Query `useProfile()` hook + `useUpdateAvatar()` mutation
  that invalidates it. Lives in `src/features/profile/hooks.ts`.

## Mobile — display only

Location: `mobile/src/features/home/HomeScreen.tsx` (replaces the existing
initials placeholder at the header avatar).

- `mobile/src/features/home/data.ts` → `fetchProfile()` returns `{ avatar_url }`.
- Fetch on mount; render `<Image source={{ uri: avatarUrlWithCacheBust }}>` in the
  existing 34px circle; **fall back to the initial** when null or while loading.
- No upload path on mobile.

## Security / RLS

Migration goes through the **database-reviewer** agent before it is applied
(project rule), and `get_advisors` is checked after applying.

- `profiles` RLS (own row only, using the app's existing `(select auth.uid())`
  idiom):
  - `select` where `id = (select auth.uid())`
  - `insert` with check `id = (select auth.uid())`
  - `update` using/with check `id = (select auth.uid())`
  - No `anon` grants.
- Storage policies on the `avatars` bucket:
  - **public read** (bucket is public);
  - `insert`/`update`/`delete` only within the user's own folder:
    `(storage.foldername(name))[1] = (select auth.uid())::text`.
- Public-read is standard for avatars; the path is unguessable and it is the
  user's own photo.

## Types

Regenerate both `src/lib/database.types.ts` and `mobile/src/lib/database.types.ts`
via MCP `generate_typescript_types` after the migration.

## Testing / verification

- **Web:** `npm run build` + `npx vitest run`. Manually upload a photo and confirm
  it renders and survives a reload.
- **Mobile:** `npm run typecheck` + `npm test`. Confirm the photo shows in the Home
  header and falls back to the initial when absent.

## Out of scope (YAGNI)

- Remove-photo button (replace-only for now).
- Display name / broader profile fields.
- Uploading a photo from mobile.
- Showing avatars of other users (app is single-user/self-view).

## No new dependencies

Web uses native File/canvas APIs; mobile uses RN `Image`.
