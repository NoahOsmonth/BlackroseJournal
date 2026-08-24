# AI control-plane live probe

`npm run test:control-plane-live` is an opt-in Playwright and HTTP probe for a running admin app, gateway, Supabase Auth, provider, and Hindsight deployment. Without `CONTROL_PLANE_LIVE=1`, it exits successfully with a precise skip message and performs no network requests.

The probe uses the real admin login form to create a uniquely prefixed provider, discover the configured upstream model, publish it for chat, assign it as the flash route, and withdraw it through the admin UI. An authenticated Supabase Realtime subscription must observe the catalog revisions caused by publish and withdrawal. It then proves managed chat and flash through the gateway, a direct OpenAI-compatible BYOK request to the provider host, and two authenticated users' isolated Hindsight recall. Each user's raw recall is injected as the app-equivalent `## Relevant long-term context` for a managed chat question; the exact replies are recorded and must contain only that user's marker. The artifact labels this as harness-injected recall context rather than claiming the mobile hook was driven.

The live harness deliberately does not drive the mobile account-switch or offline-reopen UI. Those boundaries stay deterministic in `__tests__/services/account/accountBoundOperations.test.ts`, `__tests__/services/ai/managedTransport.test.ts`, `__tests__/services/ai/managedStreamErrors.test.ts`, `__tests__/services/ai/managedCatalog.test.ts`, and `__tests__/services/auth/authBootstrap.test.ts`. The live evidence complements those named suites; it does not replace them.

Use only disposable test accounts. The probe clears the complete Hindsight banks derived by the gateway for User A and User B before and after the run. It never accepts or sends a bank identifier, and it refuses to run this clearing step without the explicit destructive-test acknowledgement.

```bash
export CONTROL_PLANE_LIVE=1
export CONTROL_PLANE_ALLOW_CLEAR_TEST_USERS=1
export CONTROL_PLANE_GATEWAY_URL=http://127.0.0.1:8787
export CONTROL_PLANE_ADMIN_URL=http://127.0.0.1:8081
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
