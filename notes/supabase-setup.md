# Supabase Setup

1) Create a Supabase project.
2) Enable anonymous sign-ins (Authentication > Providers > Anonymous).
3) Run the schema SQL in `scripts/supabase/schema.sql`.
4) Add env vars in `.env` (or Expo secrets):
   - EXPO_PUBLIC_SUPABASE_URL
   - EXPO_PUBLIC_SUPABASE_ANON_KEY
5) Rebuild the app so Expo picks up the new EXPO_PUBLIC values.

Notes
- RLS is enabled in the schema; keep it on for privacy.
- The app uses anonymous auth per device (no login UI).
- Local AsyncStorage remains the source of truth; Supabase is a backup + sync target.
