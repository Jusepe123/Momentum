-- Move avatars out of Storage and into the profiles row as a base64 data URL.
--
-- Why: this project's Storage service does not honor access tokens issued by
-- the JWT Signing Keys system (any token carrying a `kid` — ES256 or keyed
-- HS256), so authenticated uploads are treated as anon and fail the owner
-- folder RLS check. The Data API (PostgREST) DOES honor those tokens, so we
-- store the small client-resized avatar (256x256 JPEG, ~30 KB) directly in
-- profiles.avatar_url as a `data:` URL and render it in both apps.
--
-- Server-side validation (the client also resizes/validates, but never trust
-- only the client): avatar_url must be an image data URL (jpeg/png/webp base64)
-- and ≤ 7.4 M chars — that length is the server-side enforcement of the 5 MB
-- max-per-avatar limit (a 5 MB image base64-encoded is ~7 MB of text). The
-- format check replaces the MIME-type guard the old Storage bucket provided.
alter table public.profiles drop constraint if exists profiles_avatar_url_check;
alter table public.profiles add constraint profiles_avatar_url_check
  check (
    avatar_url is null
    or (
      char_length(avatar_url) <= 7400000
      and avatar_url ~ '^data:image/(jpeg|png|webp);base64,[A-Za-z0-9+/]+=*$'
    )
  );

-- Drop the now-unused avatars write policies (Storage was abandoned for this
-- feature) to shrink the attack surface. The empty bucket row itself is left in
-- place: Postgres blocks direct DELETE on storage tables (storage.protect_delete),
-- so removing the bucket must be done via the Storage API/dashboard. With no
-- write policies and no objects it is inert.
drop policy if exists avatars_owner_insert on storage.objects;
drop policy if exists avatars_owner_update on storage.objects;
drop policy if exists avatars_owner_delete on storage.objects;
