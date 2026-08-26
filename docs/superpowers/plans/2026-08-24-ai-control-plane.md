# Blackrose AI Control Plane Implementation Plan

> Execute in dependency waves. Parallel tasks have disjoint ownership. Every task uses TDD and records verification evidence.

**Goal:** Deliver a portable Supabase-backed admin control plane, secure multi-protocol AI gateway, realtime managed-model catalog, direct BYOK override, authenticated account-scoped local data, and per-user gateway-owned Hindsight memory.

**Design:** `docs/superpowers/specs/2026-08-24-ai-control-plane-design.md`

## Global Constraints

- Preserve every constraint in the design document's Global Constraints section.
- Do not change lockfiles, applied migrations, generated/build output, or `example-design/`.
- All shared contracts land before dependent parallel work.
- UI -> hooks -> services; all text and surfaces support both themes; no `space-*`; design files stay below 500 lines.
- Test-first evidence must show the new test failing for the intended missing behavior before implementation.
- Managed keys and Hindsight bank identifiers never reach clients.
- No silent cross-model fallback.

## Task 1: Freeze shared control-plane contracts

**Files:** Create shared TypeScript contracts under `packages/ai-control-plane-contracts/`, contract tests under `__tests__/contracts/`, and workspace package metadata without modifying lockfiles.

Define catalog, provider protocol, normalized inference request/event/error, preferences, admin mutations, memory requests, revision conflict, and capability types. Define runtime validators for every network boundary. Keep secret-bearing admin types separate from public catalog types. Prove validators reject bank ids in client memory requests and provider details in public catalog rows.

## Task 2: Add portable Supabase schema and RLS

**Files:** Add one new migration under `supabase/migrations/` and pgTAP tests under `supabase/tests/`.

Create the public and private schema from the design, enum/check constraints, indexes, revision trigger/functions, grants, RLS policies, transactional publish/archive functions, and Realtime publication for only the catalog and revision tables. Prove anonymous denial, per-user preference isolation, public catalog safety, admin/service behavior, optimistic conflicts, and archive withdrawal.

## Task 3: Add gateway authentication, secret storage, and request safety

**Files:** Add backend modules/tests under `backend/src/auth`, `backend/src/security`, `backend/src/control`.

Implement Supabase JWT/JWKS verification, explicit admin authorization, versioned envelope encryption/decryption, redaction, SSRF-safe provider URL resolution, bounded retry policy, request ceilings, and same-model-only transient retry. Configuration must fail closed when required production keys are absent. Never log token, prompt, provider key, or decrypted secret.

## Task 4: Implement Supabase repositories and admin/provider APIs

**Files:** Add backend repositories/routes/tests and admin-safe DTO mapping.

Implement provider CRUD/archive, credential replacement/rekey, upstream model discovery, model selection/publish/archive, runtime flash selection, catalog/preferences endpoints, audit recording, and revision conflict responses. Discovery is fetch-then-select and supports all four protocols. Route handlers remain thin and call services/repositories.

## Task 5: Implement normalized protocol adapters and managed inference

**Files:** Add backend adapter modules/tests plus managed inference service/routes.

Implement OpenAI Chat Completions, OpenAI Responses, Anthropic Messages, and Gemini GenerateContent request translation and streaming/non-stream parsing into the shared event contract. Add route resolution for user-selected chat and admin-selected flash purposes, structured extraction support, abort propagation, normalized errors, usage accounting, and no cross-model fallback.

## Task 6: Put Hindsight behind the gateway with per-user banks

**Files:** Add backend memory modules/routes/tests; update Hindsight deployment/config documentation.

Implement versioned HMAC bank derivation and authenticated retain/recall/reflect/rebuild/clear proxies. Ignore/reject any client bank input. Preserve soft-fail semantics where the app already treats Hindsight as optional. Add two-user isolation tests and prove neither ids nor bank names appear in logs/API responses.

## Task 7: Add app authentication and account-scoped persistence

**Files:** Add auth/account services and hooks, route gate, account-scoped storage owner/tests; migrate existing feature owners without creating parallel writes to their keys.

Gate protected app routes behind Supabase auth, persist/refresh sessions through the supported client, allow offline reopen only for a previously authenticated account, and clear runtime caches/subscriptions on account switch. Introduce a versioned account namespace and idempotent migration of legacy local data after ownership confirmation. Preserve serialized read-modify-write and corruption-safe reads.

## Task 8: Add managed catalog realtime and BYOK mode separation

**Files:** Add AI catalog service/hook/tests; update custom model service, shared settings UI, and AI transport selection.

Managed mode loads cached catalog, subscribes to the revision row, refetches atomically, persists the user's explicit selection, and handles withdrawal without silent fallback. BYOK-on shows only direct custom/OpenRouter models and bypasses the gateway; BYOK-off shows only managed models and routes through the gateway. Keep context budgeting local and avoid waiting on discovery during chat.

## Task 9: Build the separate admin web application

**Files:** Create `admin/` application source/config/tests without changing root lockfiles.

Build login/admin authorization, provider list/editor, masked credential replacement, discovery inventory selection, publish/archive controls, chat/flash route assignment, runtime ceilings, health, audit view, and stale-revision conflict UX. Use services/hooks/UI layering, accessible controls, responsive layouts, and both color schemes. No plaintext credential can be read back after save.

## Task 10: Migrate mobile Hindsight calls and rebuild private memory

**Files:** Update `services/memory/hindsight/`, related hooks/finish effects/tests, and add rebuild state owner.

Replace direct Hindsight URLs and fixed `rosebud` bank usage with gateway memory routes. Add an idempotent per-account rebuild from only that account's journal/check-in history, quarantine the shared bank, and maintain chat/finish/navigation soft-fail behavior. Clear history must clear that authenticated user's remote bank as a best-effort addition to existing local clears.

## Task 11: Integration, portability, and operations

**Files:** Add integration/Playwright tests, scripts, `.env.example` updates, deployment/runbooks, and `PROGRESS.md` entry.

Exercise local Supabase migrations and Realtime, admin add/discover/publish/withdraw, all protocol adapter fixtures, managed chat/flash, BYOK direct mode, two authenticated users with isolated memory, account switching, offline reopen, credential rotation, and export/import into a clean Supabase target. Document local CLI, hosted Supabase, and production self-hosted deployment plus rollback and key recovery.

Run root and backend tests, Supabase pgTAP, TypeScript, lint, design checks, admin tests/build, and real Playwright E2E against cleared demo data. Paste verbatim assistant responses for memory recall evidence.

## Task 12: Final security and whole-branch review

Review the complete branch for authorization bypass, RLS/grant exposure, SSRF, secret leakage, cross-user cache/storage/memory mixing, protocol stream correctness, destructive migration behavior, missing tests, and spec compliance. Resolve all Critical/Important findings, rerun every gate, and use the branch-finishing workflow.

