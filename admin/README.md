# Blackrose Admin

This is a separately built web application for the Blackrose AI control plane. It authenticates
with Supabase, then sends the current access token only to the gateway's `/v1/admin/*` APIs.
Provider credentials are write-only: after a save the UI receives and displays only the safe
label, key version, update time, and last four characters returned by the gateway.

## Configuration

Set these public build variables before starting or exporting the application:

```bash
EXPO_PUBLIC_AGENT_BASE_URL=http://localhost:8787
EXPO_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-local-anon-key
```

The same values may be injected before the application bundle through
`window.__BLACKROSE_ADMIN_CONFIG__`; `config.example.js` documents that runtime shape. The
Supabase anonymous key is a public client credential. Provider API keys and gateway master keys
must never be placed in this configuration.

## Commands

Run from `admin/` with the repository dependencies installed:

```bash
npm run typecheck
npm test
npm run lint
npm run build
```

The build emits a static Expo web export in `admin/dist/`. Deploy it separately from the mobile
application and allow its origin in the gateway CORS configuration.
