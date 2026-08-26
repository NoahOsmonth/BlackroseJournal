# Design: OmniRoute-Driven Admin Plane (Replaces Supabase Control-Plane Admin)

**Date:** 2026-08-26
**Status:** Approved by tay (brainstorming complete) — pending spec review
**Owner:** Mei / BlackroseJournal

---

## 1. Problem & Goal

The current AI control plane (Tasks 1–12, merged `b03e542`) implements its own provider
registration, credential vault, model catalog, flash-route assignment, and runtime ceilings,
backed by Supabase `control` schema. Two gaps motivated this redesign:

1. Duplicated responsibility — OmniRoute (local gateway at `:20128`, 350+ providers) already
   provides provider CRUD, model catalogs, combo fallback chains, API-key management, usage
   analytics, and an embeddings endpoint.
2. No embedding-model management exists anywhere in the control plane; embeddings are
   hardcoded to Hindsight's own Gemini setup.

**Goal:** Make **OmniRoute the single source of truth** for provider/model/routing/credential
configuration. The BlackroseJournal backend becomes a thin adapter over the OmniRoute REST API;
the admin app becomes a control surface over that API. **OmniRoute internals are never edited.**

## 2. Non-Negotiable Constraints

- **NO edits to `/home/sigmund/OmniRoute` internals.** Pure API consumer. If an endpoint is
  missing, work around it on our side.
- **Simple security only** (standing owner directive): no new rate limiters, no extra
  encryption layers, no defense-in-depth additions beyond what exists.
- **NEVER delete OmniRoute providers via our UI by default** (owner rule 8/22: no DELETE of
  providers); destructive admin actions require explicit confirm + audit entry.
- **Free models only** unless tay explicitly adds paid ones.
- Existing per-user managed-access limits (concurrency/request-window/token-window) are
  **kept** — they gate calls before any OmniRoute invocation.

## 3. Architecture

```
Admin UI (Expo web, admin/)
   │  Supabase login (unchanged)
   ▼
Backend adapter layer  backend/src/control/omnirouteAdapter.ts  (NEW)
   │  Authorization: Bearer <OMNIROUTE_MANAGE_KEY>  (manage scope)
   ▼
OmniRoute REST API  http://100.107.7.52:20128  (SOURCE OF TRUTH)
   ├─ GET/POST/PATCH/DELETE /api/providers        provider CRUD (+ test endpoint)
   ├─ GET  /api/models                            model catalog
   ├─ GET/POST/PATCH/DELETE /api/combos           fallback chains (= old "flash route")
   ├─ POST /api/keys                              key creation (allowedModels scoping)
   ├─ PATCH/DELETE /api/keys/[id]                 key update/revoke
   ├─ GET  /api/usage/*                           per-key analytics
   └─ POST /v1/chat/completions | /v1/embeddings  inference

User chat flow:
App user → BRJ backend (managed-access gates) → resolve user's OmniRoute key
         → OmniRoute /v1/chat/completions → upstream provider
```

### Transport & exposure
- OmniRoute must stay **loopback/Tailscale-only** (`100.107.7.52:20128`). Never expose publicly.
- Backend → OmniRoute runs over Tailscale/LAN HTTP (trusted network). No new TLS layer (simple
  security).

## 4. Per-User Key Provisioning

- On account activation or first LLM use, backend calls `POST /api/keys` with
  `name: brj-<userId>` and `allowedModels` = models published in our catalog view.
- Full key is stored **once**, encrypted, in Supabase (reuse existing credential encryption).
  Rationale: OmniRoute never allows full-key retrieval after creation.
- Admin Keys panel: masked listing, revoke, re-issue, allowed-models editing.
- Usage tracking: OmniRoute per-key analytics surfaced in the admin Usage panel.

## 5. Embeddings

- New admin-settable embedding model config (provider + model id, e.g. Gemini
  `gemini-embedding-001` connected as an OmniRoute provider).
- Backend embedding calls go through `POST /v1/embeddings` using an internal service key.
- Hindsight remains the **vector store only**; its own LLM/embedding env vars become unused
  for this path (left untouched — no OmniRoute/Hindsight internal edits).

## 6. Admin App Changes

Removed (Supabase-control-plane-backed):
- `ProviderForm`, `CredentialForm`, `CatalogPanel` (publish flow), `ModelInventory`
  (discover/publish), `RuntimePanel` ceilings tied to flash route, conflict-revision machinery.

Added (OmniRoute-backed panels):
1. **Providers** — list/connect/test/disconnect providers (uses OmniRoute test endpoints;
   disconnect = remove from catalog view, hard delete requires typed confirmation).
2. **Models** — read-only catalog view + which models are exposed to users
   (maintained as a small Supabase-side allowlist table `admin_published_models`).
3. **Combos** — build/edit the fallback chain(s) used for chat + flash extraction.
4. **Keys** — per-user keys: masked value, status, revoke, re-issue.
5. **Usage** — spend/usage analytics per key/model.
6. **Embeddings** — pick embedding provider+model, test call.

Kept unchanged:
- Supabase auth/login, audit log (all admin actions still logged to Supabase),
  admin app build/type/lint/test toolchain.

## 7. Backend Changes

- NEW `backend/src/control/omnirouteAdapter.ts`: typed fetch wrapper around the OmniRoute
  management API (manage-key auth, error normalization, timeouts). Unit-tested with mocked
  fetch; contract-tested against the live local instance in E2E.
- Chat orchestration: replace control-plane route lookup with
  user-key resolution → forward to `/v1/chat/completions`.
- Managed-access limits unchanged and enforced **before** adapter call.
- Env additions: `OMNIROUTE_BASE_URL`, `OMNIROUTE_MANAGE_KEY`.
- A long-lived **manage-scope** API key is created once in OmniRoute and injected via env.

## 8. Migration / Rollout

1. Build adapter + new panels alongside old ones behind feature flag `ADMIN_OMNIROUTE=on/off`.
2. Dual-run internally; verify parity (chat works, combos act as fallback, usage flows).
3. Flip default on; old control-plane tables **archived, not dropped** (drop is a later,
   separately-approved migration).
4. Old admin components deleted only after flag flip is stable.

## 9. Testing

- Adapter unit tests (mock fetch): CRUD coverage, auth header, error mapping, timeout.
- Panel tests mirror existing adminUi.test.tsx patterns against mocked adapter responses.
- E2E probe (like `app-live-probe.js`): create temp key w/ allowedModels → chat completion →
  revoke → verify 401. Uses FREE models only.
- All existing gates rerun: Jest suites, `tsc --noEmit`, ESLint changed files, check:design.

## 10. Risks

| Risk | Mitigation |
|---|---|
| Manage key leak = full gateway control | Env-injected, never logged; revocable in OmniRoute |
| Full user keys unrecoverable from OmniRoute | Store-once encrypted in Supabase + backup discipline |
| OmniRoute API shape drifts upstream | Adapter isolates all calls; contract tests catch breakage |
| Dev-mode dashboard vs API auth confusion | Use Bearer manage-scope key exclusively from backend |
| Port accidentally exposed | Keep Tailscale-only binding; document in ops notes |
