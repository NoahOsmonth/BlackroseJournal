# Supabase Setup

1) Create a Supabase project.
2) Enable anonymous sign-ins (Authentication > Providers > Anonymous).
3) Enable Email provider (Authentication > Providers > Email).
4) Configure Auth URLs:
   - **Site URL**: your app's primary URL (keep a web URL and use redirect allowlist below).
   - **Additional Redirect URLs**: add your deep link targets, e.g.
     - `app://login`
     - `app://update-password`
   - For local Expo testing, also add the `exp://` or `http://` URL returned by
     `Linking.createURL('/update-password')`.
5) Customize email templates (Authentication > Email Templates) using the files in
   `supabase/email-templates/`:
   - Confirm signup
   - Reset password
6) Run the schema SQL in `scripts/supabase/schema.sql` (or apply `supabase/migrations/202601240001_init.sql` with CLI).
7) If PostgREST still reports missing tables, reload schema cache:
   - `NOTIFY pgrst, 'reload schema';`
8) Add env vars in `.env` (or Expo secrets):
   - EXPO_PUBLIC_SUPABASE_URL
   - EXPO_PUBLIC_SUPABASE_ANON_KEY
9) Rebuild the app so Expo picks up the new EXPO_PUBLIC values.

Notes
- RLS is enabled in the schema; keep it on for privacy.
- The app uses anonymous auth per device (no login UI) unless the user signs in with email.
- Sessions persist on device with auto-refresh (`persistSession: true`, `autoRefreshToken: true`).
- Reset password uses `redirectTo` to deep link into `app://update-password`.
