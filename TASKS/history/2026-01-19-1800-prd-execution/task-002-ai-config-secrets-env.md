# Task 002: Remove hardcoded AI secrets + configure env

## Problem
`services/ai.ts` currently contains a hardcoded API key and model/base URL constants. A real API key also appears in `.env`.

This is risky:
- secrets can be accidentally committed
- configuration differs across web/native
- debugging is harder when config is duplicated

## Impact
- Security risk (leaked API key)
- Hard-to-reproduce behavior across platforms

## Proposed Fix
- Remove the hardcoded API key from `services/ai.ts`.
- Source config from a single, platform-safe place:
  - recommended for Expo: use an `app.config.(js|ts)` that reads `process.env.NANO_GPT_API_KEY` and exposes it via `expo.extra`, then read it via `expo-constants`.
- Add a safe example file (e.g. `.env.example`) and ensure `.env` is not committed.
- Add a clear runtime error when the key is missing (no cryptic fetch failures).
- Rotate the compromised key (manual step; document in PROGRESS).

## Acceptance Criteria
- No API keys are hardcoded in source (`services/ai.ts`).
- App can load the API key on both web and native using the same mechanism.
- If the key is missing, the app shows/logs a clear configuration error (and does not crash).
- Repo contains `.env.example` with placeholders.
- Tests cover:
  - missing-key behavior (friendly error)

## References
- Expo config via `app.config.*` and `expo-constants` (executor should confirm exact API for current Expo SDK)

## Subtasks
1. Implement config loading:
   - introduce `app.config.(js|ts)` or extend existing config so env vars reach the app.
   - update `services/ai.ts` to read from config.
2. Add `.env.example` and ensure `.env` is gitignored.
3. Update docs (README) with setup instructions.
4. Add tests for missing-key behavior.

## Verification
### Unit tests
- `npm test -- --runInBand --testPathPattern=ai`

### Manual (required)
- With `NANO_GPT_API_KEY` set: chat works on mobile + web.
- Without it: app emits a clear configuration error.
