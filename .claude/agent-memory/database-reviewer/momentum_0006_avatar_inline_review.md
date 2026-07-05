---
name: momentum-0006-avatar-inline-review
description: Pre-apply findings for 0006_avatar_inline.sql (avatar moved from Storage bucket to inline base64 data URL in profiles.avatar_url)
metadata:
  type: project
---

Reviewed 2026-07-05, before apply. No CRITICAL/HIGH. Verified live DB state: `profiles_avatar_url_check` currently the 2048-char version (0005 applied, 0006 not yet), `profiles` table has 0 rows, `avatars` bucket exists with 0 objects, `storage.objects.bucket_id` FK to `storage.buckets` is plain `FOREIGN KEY ... REFERENCES storage.buckets(id)` with no `ON DELETE` action (defaults to RESTRICT) — so `delete from storage.buckets where id='avatars'` is safe now (0 objects) and would fail loudly (not corrupt data) if objects ever existed.

Findings given to user:
- MEDIUM: switching from Storage bucket (which enforced `allowed_mime_types: image/jpeg,png,webp` + `file_size_limit`) to a plain `text` column with only a length check (`<= 7400000`) drops MIME/format validation entirely. Recommend adding a regex CHECK requiring the `data:image/(jpeg|png|webp);base64,` prefix, to keep the same validation strength the old bucket had.
- LOW: no `delete from storage.objects where bucket_id = 'avatars'` before the bucket delete. Currently moot (0 objects confirmed), but would make the migration self-defensive/idempotent if applied later than reviewed.
- LOW: adding the new CHECK constraint validates all existing rows (AccessExclusiveLock during scan) — `profiles` has 0 rows now so this is free; revisit only if this pattern (drop+add CHECK) is reused on a populated table later.
- Constraint drop-then-add (`drop constraint if exists` + `add constraint` same name) is idempotent and safe to re-run; confirmed constraint name in prod matches migration's assumption (`profiles_avatar_url_check`) and the three storage policy names being dropped match exactly what 0005 created.
- 7.4M char cap (~5 MB image) via TOAST is fine for the stated access pattern (single-row `select ... where id = auth.uid()`, never scanned in list/dashboard queries) — no seq-scan or bulk-query concern.

See also [[momentum_0001_schema_review]], [[momentum_0002_replace_session_details_review]], [[momentum_0003_routines_review]] for prior Momentum migration reviews and the recurring pattern of this project catching real issues via database-reviewer before apply.
