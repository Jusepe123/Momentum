-- User profiles: currently just a profile photo. One row per auth user,
-- created lazily by the web app's avatar upload (upsert) — the only writer.
-- Mobile reads it to show the same photo in its Home header. The image file
-- lives in the public `avatars` Storage bucket at a fixed per-user path
-- (avatars/{user_id}/avatar.jpg); avatar_url stores its full public URL and
-- updated_at drives client-side cache-busting after a replace.

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  avatar_url text check (avatar_url is null or char_length(avatar_url) <= 2048),
  updated_at timestamptz not null default now()
);

-- Keep updated_at authoritative (default now() covers insert; this covers the
-- replace path) so the client can cache-bust the fixed public URL reliably.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end $$;

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- Least privilege: mirror the other tables — no anonymous access, DML only.
-- No delete grant: a profile row is never removed by the app (photo is cleared
-- by setting avatar_url null, and the row cascades away with the auth user).
revoke all on public.profiles from anon, authenticated;
grant select, insert, update on public.profiles to authenticated;

alter table public.profiles enable row level security;

-- Own row only, using the project's (select auth.uid()) idiom.
create policy profiles_select on public.profiles
  for select to authenticated
  using (id = (select auth.uid()));

create policy profiles_insert on public.profiles
  for insert to authenticated
  with check (id = (select auth.uid()));

create policy profiles_update on public.profiles
  for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- Storage: public `avatars` bucket. A public bucket already serves its objects
-- via their public URL with no SELECT policy — and both apps only ever render
-- the stored public `avatar_url` — so we add NO read policy (one would just
-- expose bucket-wide .list()/.download() enumeration for no benefit). Size and
-- MIME are capped so a compromised/authenticated client can't dump large or
-- non-image files into a public, trusted-domain bucket. Writes below are
-- confined to the caller's own {user_id} folder.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'avatars',
  'avatars',
  true,
  5242880, -- 5 MB (the client uploads a ~30 KB resized JPEG; this only caps abuse)
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do nothing;

create policy avatars_owner_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy avatars_owner_update on storage.objects
  for update to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  )
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy avatars_owner_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );
