# Offline Memory Rework — PLAN.md (ClawX-model, no embeddings, Drive manual backup)

## Status: DONE 2026-09-12 — all three waves landed, 624/624 tests green in scope, tsc + lint + check:design clean.

## Goal
Phone-offline long-term memory that survives Hindsight + Supabase outages: file-semantic memory docs in AsyncStorage, model-guided recall (gate → shortlist → headers → bodies), Dream consolidation via `_tmp` staging, manual Google Drive backup file. Hindsight demoted to fallback.

## Tracer slice (Wave 1) — must land + verify first
1. `services/memory/memoryFiles.ts` — file-equivalent store: frontmatter docs (`name/description/type/scope/projectId/updatedAt/capturedAt/sourceSessionKey/deprecated`), one AsyncStorage key per file (`@blackrose_memory_file:<id>`) + manifest index (`@blackrose_memory_manifest`), `_tmp` staging writes on journal/check-in finish (alongside existing atoms, not replacing), `memory_list`/`memory_get` readers with header-scan (frontmatter + 2KB preview, no full-body scan).
2. `services/memory/memoryRetrieval.ts` — `retrieveMemory(query, {mode})`: gate (none/user/project_memory via lexical intent + exact-thread override) → thread shortlist (exact +10 / token +2 / desc +1 / recency tiebreak, top-5) → manifest scan → top-K=5 select → body load with budgets (12k/file, 30k total) → 30s cache + structured trace.
3. Tools: `memory_search` / `memory_list` / `memory_get` definitions + handlers, registered in `services/ai/tools/registry.ts`; `HISTORY_TOOLS_POLICY` doctrine line (search first → get exact ids); `recall_memory` kept, description marks it fallback.
4. Tests: store round-trip + staging, gate short-circuit, budgets, header-before-body (sabotage: break gate → red), registry wiring.

## Expansion (Wave 2)
- `memory_overview` / `memory_flush` (index pending sessions now) / `memory_dream` (LLM global-plan + per-thread rewrite with merge_reason + evidence rule; local keyword fallback when provider down).
- Finish-path writes `_tmp` project/feedback candidates via `fetchDirectJsonCompletion` (never `response_format` at call sites — rule 9 gotcha).
- Dream trace + outcome surfaced in Settings memory screen.

## Backup (Wave 3)
- `services/backup/driveBackup.ts`: export = manifest + memory files + identity + digests snapshot JSON (ClawX bundle pattern); upload/download via `expo-auth-session` Google auth + Drive `appDataFolder` REST (`expo-file-system` read/write, `fetch` transport — no native modules, Expo Go OK).
- Settings UI: Backup now / Restore / status. Soft-fail offline.

## Verification
- `npm test -- --testPathPattern="memoryFiles|memoryRetrieval|historyTools"`, `npx tsc --noEmit`, `npm run lint`, `npm run check:design`.
- Sabotage checks: gate bypass → context injected on greeting (must fail); budget removal → oversize context (must fail).
- Live smoke (credentials present): `rosebudHistoryLive`-style probe asserting recall works with Hindsight unreachable.

## Non-goals
- No `expo-sqlite`, no vectors, no auto-sync to Drive, no Hindsight removal, no shadow `memory/*.md` workspace files.
