# Design LLM probes (PR8-probe)

**Not product sign-off.** These suites answer design what-ifs against the local memory store, with live chat-provider data when `PROBE_LLM=1`.

## Rules

- Gated by `PROBE_LLM=1` (default skip, same pattern as `RUN_INTEGRATION_TESTS`).
- Uses `EXPO_PUBLIC_NANO_GPT_*` from `.env` — never hardcode or commit keys.
- `app/` and `services/` must not import anything under `probes/` (guarded by `__tests__/probes/isolation.test.ts`).
- Probes may import services for real functions (`shouldEnableHistoryTools`, `embed` constants, etc.).
- Embedding vectors cache under `.probe-cache/` (gitignored).
- Human-readable outputs under `probes/artifacts/` (gitignored).

## Run

```powershell
# Offline always-on: fixture + isolation + E4
npx jest --runInBand __tests__/probes --forceExit

# Full live battery (long; free-tier 429s expected on E3)
$env:PROBE_LLM='1'
npx jest --runInBand __tests__/probes/liveBattery.test.ts --forceExit

# R0/R2 recall metrics against the offline memory store
$env:PROBE_LLM='1'
npx jest --runInBand __tests__/probes/recallMetrics.test.ts --forceExit
```

Probes are offline by construction (the local-only build has no Supabase or
Hindsight); live runs only need the chat provider in `.env`.

## Experiments

| Id | Question |
|----|----------|
| E1 | Per-turn prompt_token tax of offering a 3-tool schema |
| E2 | Can models use search/list/get tools to find needles? |
| E3 | Embedding rank of semantic needle across 365 entries |
| E4 | Trigger coverage for `shouldEnableHistoryTools` |
| E5 | Would a 1.5k-token capsule alone include the needle? |
| E7 | Speed acceptance: recall / tool round / full turn / first-token budgets vs targets |
