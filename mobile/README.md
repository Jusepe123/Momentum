# Momentum Mobile — Android run recorder

Records runs (GPS distance + time, screen off included) and uploads each one
as an ordinary Momentum session (`sessions` + `cardio_details`) with one tap.
Same Supabase project and account as the web app — the dashboard picks runs up
with no web changes.

## Install on your phone

Builds come from EAS (`eas build:list` or https://expo.dev/accounts/jose_cisternas/projects/momentum-mobile/builds):

- **preview** profile → standalone APK. Download the `.apk` on the phone,
  open it, allow "install unknown apps". This is the one to actually run with.
- **development** profile → dev-client APK for development: needs
  `npx expo start` on the PC and both devices on the same network.

## First run checklist (on the phone)

1. Sign in with your Momentum email/password.
2. Tap **Start run** → grant location → on the follow-up screen choose
   **"Allow all the time"** (background recording needs it) → allow
   notifications (Android 13+).
3. One-time: Settings → Apps → Momentum → Battery → **Unrestricted**
   (the app prompts you once about this).
4. Check the teal "Momentum — recording run" notification appears; lock the
   phone, pocket it, walk 10 min — distance must keep accumulating.
5. Finish → pick an effort → Upload → the run appears on the web dashboard
   with today's date.

Worth testing once: force-stop the app mid-run and reopen it — the run
resurrects from its snapshot. And finish a run in airplane mode — it lands in
the pending queue; "Upload saved runs" appears on the start screen.

## Field calibration

Run a route of known length. If the recorded distance is off by more than
~3%, tune `DEFAULT_FILTER` in `src/lib/geo/distance.ts` (accuracy gate 25 m,
jitter gate 5 m, teleport gate 12.5 m/s). Tests pin the *semantics*; the
thresholds are calibration. Rebuild the preview APK after tuning.

## Development

```bash
npm install
npm run typecheck   # tsc --noEmit
npm test            # vitest (pure geo/format modules run in Node)
npx expo start      # dev server for the dev-client build / Expo Go*
```

*Expo Go can exercise sign-in and foreground tracking, but background GPS
requires a dev build — that's an OS-level restriction, not a config flag.

`.env` holds `EXPO_PUBLIC_SUPABASE_URL` / `EXPO_PUBLIC_SUPABASE_ANON_KEY`
(git-ignored; same values as the web `.env.local`, and committed for cloud
builds in `eas.json` env blocks — the anon key is publishable by design).

## Architecture notes (the invariants)

- `index.ts` imports `src/tracking/locationTask.ts` **first** so the
  background task exists in headless launches.
- The run's calendar date is captured at **start** (`todayLocalISO()`), never
  at upload — a retried upload the next morning must not shift the ACWR bucket.
- Upload is idempotent: `sessions.id` is a client UUID minted at finish and
  kept in the persisted snapshot; retries treat unique violations as success.
- Pause never stops the foreground service (Android 12+ can't reliably
  restart it from the background); ingest just discards points while paused.
- Never write `unified_load` — DB-generated column.
