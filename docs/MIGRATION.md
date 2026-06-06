# Migration Runbook: NANO_GPT_* → AI_DEFAULT_*

The backend AI config is moving from provider-specific names to neutral ones. This runbook covers what changes, why we did it, and how to upgrade. The legacy `NANO_GPT_*` names keep working through **2026-09-01** thanks to a backward-compat shim. After that date, a CI guard in `scripts/check-legacy-shim.js` fails the build until the shim is removed.

## Variable mapping

The four names below are the only ones that change. Defaults are unchanged, so most projects can rename in place.

| Legacy name                | New name                   | Default (if unset)        |
| -------------------------- | -------------------------- | ------------------------- |
| `NANO_GPT_API_KEY`         | `AI_DEFAULT_API_KEY`       | (required, no default)    |
| `NANO_GPT_API_BASE_URL`    | `AI_DEFAULT_API_BASE_URL`  | `https://nano-gpt.com/api/v1` |
| `NANO_GPT_MODEL`           | `AI_DEFAULT_MODEL`         | `moonshotai/kimi-k2.5:thinking` |
| `NANO_GPT_FLASH_MODEL`     | `AI_DEFAULT_FLASH_MODEL`   | `moonshotai/kimi-k2.5`    |

The new names are provider-neutral. The shim maps the old ones to the new ones when the new ones are absent. If you set both, the new names win, no exceptions.

## Why we moved

The old names locked the backend to one vendor, even though the underlying API is OpenAI-compatible and works against NanoGPT, OpenRouter, Together, Groq, and several others. Renaming lets us add profiles (default, fast, etc.) without breaking the env contract, and it sets us up for v2 where Anthropic-native and Ollama-native adapters land. The shim exists so existing Railway deployments and local `.env` files keep booting through the deprecation window without a forced cutover.

## Upgrade checklist

1. Rename the four `NANO_GPT_*` entries in `backend/.env` to the matching `AI_DEFAULT_*` names. Keep the values the same.
2. Update any local shell exports, `direnv` files, or CI secrets that use the old names.
3. Search the repo for any remaining references: `grep -r NANO_GPT_ --include='*.ts' --include='*.tsx' --include='*.env*' .` Should return nothing in your code paths. (The shim source itself still mentions the old names; that's expected.)
4. Restart the backend and hit `/health`. You should see `"config": { "valid": true, ... }`. If validation fails, the error names the missing field.
5. Trigger one chat round-trip and one insights call (entry reflection or haiku) to confirm end-to-end behavior.
6. (Optional) Remove the `NANO_GPT_*` section from `.env.example` files and the READMEs. The CI guard is a fail-fast, not a silent break, so the project still builds with the old names present until 2026-09-01.
7. After 2026-09-01, the CI guard in `scripts/check-legacy-shim.js` fails the build. Delete `backend/src/config/aiShim.ts` and the `NANO_GPT_*` section from `.env.example` to make it pass.

## FAQ

**Will my existing Railway deployment break?**
No. The shim reads `NANO_GPT_API_KEY` if `AI_DEFAULT_API_KEY` is absent, so the old env vars keep working. The earliest forced cutover is 2026-09-01.

**What happens if I set both old and new vars for the same field?**
The new one wins. The shim only fills in gaps. We did this on purpose, so you can migrate one var at a time without surprise behavior.

**How do I know the shim is actually being used?**
Boot the backend once with `NANO_GPT_API_KEY` set and no `AI_DEFAULT_API_KEY`. You'll see a one-time `console.warn` pointing to this doc. If you don't see it, the shim was never reached, which usually means the new names are already in place.

**Do the defaults change?**
No. `AI_DEFAULT_MODEL` and `AI_DEFAULT_FLASH_MODEL` still default to the kimi variants. Existing behavior is preserved.

**Why not just delete the old names today?**
Because we have a live Railway deployment and a working local dev loop. The shim is a courtesy, not a permanent feature. The CI guard exists to make sure we don't forget to remove it.

**What about the mobile bundle? Is the API key still inlined?**
No. That's a separate fix (PR6) that removes `EXPO_PUBLIC_NANO_GPT_*` from the Expo bundle. This runbook only covers the backend env names.

**What if my CI passes the guard today but I want to confirm the failure path works?**
Run it with a forced past date: `AI_LEGACY_SHIM_OVERRIDE_DATE=2020-01-01 node scripts/check-legacy-shim.js`. It should exit 1 with a message containing the date.

**Where is the deprecation date defined?**
`AI_LEGACY_SHIM_DEPRECATION_DATE` in `backend/src/config/aiShim.ts`. Don't hardcode it elsewhere; the CI guard reads it from there.
