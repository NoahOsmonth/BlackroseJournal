# AI control-plane live probe

`npm run test:control-plane-live` is an opt-in Playwright and HTTP probe for a running admin app, gateway, Supabase Auth, provider, and Hindsight deployment. Without `CONTROL_PLANE_LIVE=1`, it exits successfully with a precise skip message and performs no network requests.

The probe uses the real admin login form to create a uniquely prefixed provider, discover the configured upstream model, publish it for chat, assign it as the flash route, and withdraw it through the admin UI. An authenticated Supabase Realtime subscription must observe the catalog revisions caused by publish and withdrawal. It also proves managed chat and flash through the gateway, and performs a provider-only direct request as an upstream health sanity check; that raw request is not evidence of app BYOK behavior. Two authenticated users' raw Hindsight recall is retained as a gateway isolation check.

Set `CONTROL_PLANE_APP_LIVE=1` and `CONTROL_PLANE_APP_URL` to add the real app phase. This phase logs both disposable users into the actual Expo web app, proves a managed reply used the gateway, configures BYOK through the Settings UI, proves a BYOK reply used the provider directly, disables BYOK, finishes entries through the real journal UI, and records verbatim assistant replies. It then observes the app's own `/v1/memory/recall` request and the managed chat request carrying `## Relevant long-term context`; no recall context is manually injected. The same browser signs out A, signs in B, checks that A's marker is absent from B's recall response/request/UI, retains and recalls B's marker, and reloads Settings while Supabase requests are blocked to prove offline reopen of B's account.

The app phase clears only the two explicitly approved disposable Hindsight accounts before and after the run. Its raw recall readiness check only waits for the app's finished-entry retain to settle; it is labeled separately from app recall evidence. The exact app replies are written to `probes/artifacts/control-plane-app-<run-id>.json`. If a process is killed, use the printed run id to clean only that run's resources.

Use only disposable test accounts. The probe clears the complete Hindsight banks derived by the gateway for User A and User B before and after the run. It never accepts or sends a bank identifier, and it refuses to run this clearing step without the explicit destructive-test acknowledgement.

```bash
export CONTROL_PLANE_LIVE=1
export CONTROL_PLANE_APP_LIVE=1
export CONTROL_PLANE_ALLOW_CLEAR_TEST_USERS=1
export CONTROL_PLANE_GATEWAY_URL=http://127.0.0.1:8787
export CONTROL_PLANE_ADMIN_URL=http://127.0.0.1:8081
export CONTROL_PLANE_APP_URL=http://127.0.0.1:19006
export CONTROL_PLANE_SUPABASE_URL=http://127.0.0.1:54321
export CONTROL_PLANE_SUPABASE_ANON_KEY=...
export CONTROL_PLANE_ADMIN_EMAIL=admin+blackrose-e2e@example.test
export CONTROL_PLANE_ADMIN_PASSWORD=...
export CONTROL_PLANE_USER_A_EMAIL=user-a+blackrose-e2e@example.test
export CONTROL_PLANE_USER_A_PASSWORD=...
export CONTROL_PLANE_USER_B_EMAIL=user-b+blackrose-e2e@example.test
export CONTROL_PLANE_USER_B_PASSWORD=...
export CONTROL_PLANE_PROVIDER_BASE_URL=https://openrouter.ai/api/v1
export CONTROL_PLANE_PROVIDER_API_KEY=...
export CONTROL_PLANE_PROVIDER_MODEL_ID=dots-studio/dots-3-note-preview:free
npm run test:control-plane-live
```

Optional variables:

- `CONTROL_PLANE_RUN_ID` makes a reproducible resource suffix; it must contain only letters, digits, and hyphens.
- `CONTROL_PLANE_ARTIFACT_DIR` changes the evidence output directory. The default is the gitignored `probes/artifacts/` directory.

The admin frontend must already point at the same gateway and Supabase project through its build-time environment. The gateway must have its control schema, credential-encryption key ring, memory-bank HMAC key, and Hindsight endpoint configured. The configured provider must expose OpenAI-compatible `/models` and `/chat/completions` routes because the probe intentionally covers the OpenAI-compatible add/discover case.

Cleanup is fail-safe and narrow: catalog/provider archival checks the exact `blackrose-e2e-<run-id>-` ownership prefix, while the two disposable memory accounts are cleared only after the explicit acknowledgement. If a process is killed before `finally` runs, use the run id printed in the artifact name to locate and archive only that run's provider/catalog rows.
