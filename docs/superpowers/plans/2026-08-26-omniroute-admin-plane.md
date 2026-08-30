# OmniRoute-Driven Admin Plane Implementation Plan

> **SUPERSEDED 2026-08-29.** The backend OmniRoute stack was removed (adapter, executor, route path, memory embedder) and the app now talks to the OmniRoute gateway device-direct via its default AI base URL (`DEFAULT_AI_BASE_URL`). The admin dashboard was already removed on 2026-08-27; this plan's remaining tasks are no longer wanted. See PROGRESS.md (2026-08-29 entry) and `services/ai/directConfig.ts`.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the Supabase control-plane admin flow with an adapter over the local OmniRoute gateway REST API, making OmniRoute the single source of truth for providers/models/routing/keys and adding admin-managed embeddings.

**Architecture:** A typed `omnirouteAdapter` in the backend wraps OmniRoute management endpoints (`/api/providers`, `/api/models`, `/api/combos`, `/api/keys`, `/api/usage`) plus inference (`/v1/chat/completions`, `/v1/embeddings`). New admin panels render adapter data; per-user scoped keys are provisioned via `POST /api/keys` with `allowedModels`. Old control-plane code stays compiled but is feature-flagged off; tables are archived, never dropped.

**Tech Stack:** TypeScript (Node backend, Expo React Native web admin), Supabase (auth + audit + encrypted user-key storage), Jest, OmniRoute v3.8.x REST API at `http://100.107.7.52:20128` (Tailscale-only).

**Spec:** `docs/superpowers/specs/2026-08-26-omniroute-admin-design.md`

## Global Constraints

- **NO edits to anything under `/home/sigmund/OmniRoute`.** Pure API consumer. Missing endpoint → workaround on our side.
- **Simple security only:** no new rate limiters, no extra encryption layers. Existing `managedAccess.ts` limits stay and gate BEFORE adapter calls.
- **NEVER call provider DELETE on OmniRoute by default** (owner rule 8/22). Disconnect = remove from our catalog view only. Hard delete requires typed confirmation AND explicit audit entry.
- **Free models only.** Any paid model requires owner's explicit go-ahead.
- Every color is a token in BOTH schemes; every `<Text>` needs a `dark:` variant; no hardcoded dark chrome; NO `space-y-*`/`space-x-*` — use `gap-*`; UI→hooks→services layering; design files ≤500 lines.
- Tests are part of every diff. All existing gates must stay green: Jest suites, `npx tsc --noEmit`, changed-file ESLint, `npm run check:design`.
- Env vars added (never committed): `OMNIROUTE_BASE_URL` (default `http://100.107.7.52:20128`), `OMNIROUTE_MANAGE_KEY`, `OMNIROUTE_EMBEDDING_MODEL`.
- Backend config pattern: follow `backend/src/config/aiConfig.ts` style (`readEnv` + defaults + throw on missing required).
- Backend tests use the existing patterns under `backend/src/control/__tests__/` / `backend/src/inference/__tests__/`.

---

### Task 1: OmniRoute adapter core — client, auth, error mapping

**Files:**
- Create: `backend/src/control/omnirouteAdapter.ts`
- Test: `backend/src/control/__tests__/omnirouteAdapter.test.ts`

**Interfaces:**
- Consumes: nothing (leaf module).
- Produces:
```ts
export interface OmnirouteAdapterConfig { baseUrl: string; manageKey: string; timeoutMs?: number }
export function createOmnirouteAdapter(config: OmnirouteAdapterConfig): OmnirouteAdapter
export interface OmnirouteRequestError extends Error { status: number; body: unknown }
export interface OmnirouteAdapter {
  listProviders(): Promise<unknown[]>
  createProvider(input: { provider: string; apiKey?: string; name: string }): Promise<unknown>
  testProvider(id: string): Promise<{ valid: boolean; latencyMs?: number }>
  listCombos(): Promise<unknown[]>
  upsertCombo(input: { id: string; models: string[] }): Promise<unknown>
  listKeys(): Promise<unknown[]>
  createKey(input: { name: string; allowedModels?: string[] }): Promise<{ id: string; key: string }>
  updateKey(id: string, patch: { allowedModels?: string[] }): Promise<unknown>
  revokeKey(id: string): Promise<unknown>   // DELETE /api/keys/[id] — keys only, NEVER providers
}
```
All methods send `Authorization: Bearer <manageKey>`, normalize non-2xx into `OmnirouteRequestError` (with `status` + parsed `body`), and abort at `timeoutMs ?? 15000`.

- [ ] **Step 1: Write the failing test** — mock `global.fetch`; assert bearer header present, JSON error thrown as `OmnirouteRequestError` with `.status = 403` for `{status:403}` responses, network rejection maps to status 0 error, and `revokeKey` issues DELETE to `/api/keys/<id>`.

```ts
// backend/src/control/__tests__/omnirouteAdapter.test.ts
import { createOmnirouteAdapter } from '../omnirouteAdapter';

const fetchMock = jest.fn();
beforeEach(() => { fetchMock.mockReset(); (global as any).fetch = fetchMock; });

function jsonResponse(status: number, body: unknown) {
  return { ok: status < 400, status, json: async () => body } as Response;
}

test('sends bearer header and parses JSON', async () => {
  fetchMock.mockResolvedValueOnce(jsonResponse(200, []));
  const adapter = createOmnirouteAdapter({ baseUrl: 'http://x', manageKey: 'k' });
  await adapter.listProviders();
  const [url, init] = fetchMock.mock.calls[0];
  expect(url).toBe('http://x/api/providers');
  expect((init as RequestInit).headers).toMatchObject({ Authorization: 'Bearer k' });
});

test('maps 403 to OmnirouteRequestError with status', async () => {
  fetchMock.mockResolvedValueOnce(jsonResponse(403, { error: 'AUTH' }));
  const adapter = createOmnirouteAdapter({ baseUrl: 'http://x', manageKey: 'k' });
  await expect(adapter.listProviders()).rejects.toMatchObject({ status: 403 });
});

test('createKey posts name+allowedModels and returns full key once', async () => {
  fetchMock.mockResolvedValueOnce(jsonResponse(200, { id: 'key1', key: 'sk-full' }));
  const adapter = createOmnirouteAdapter({ baseUrl: 'http://x', manageKey: 'k' });
  await expect(adapter.createKey({ name: 'brj-u1', allowedModels: ['m'] })).resolves.toEqual({ id: 'key1', key: 'sk-full' });
});
```

- [ ] **Step 2: Run test to verify it fails**
Run: `cd backend && npx jest src/control/__tests__/omnirouteAdapter.test.ts`
Expected: FAIL — cannot find module `../omnirouteAdapter`.

- [ ] **Step 3: Write minimal implementation**

```ts
// backend/src/control/omnirouteAdapter.ts
export class OmnirouteRequestError extends Error {
  constructor(public status: number, public body: unknown, message?: string) {
    super(message ?? `OmniRoute request failed (${status})`);
    this.name = 'OmnirouteRequestError';
  }
}

export interface OmnirouteAdapterConfig { baseUrl: string; manageKey: string; timeoutMs?: number }

type JsonInit = { method: string; headers: Record<string, string>; body?: string };

async function request<T>(cfg: OmnirouteAdapterConfig, path: string, method: string, body?: unknown): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), cfg.timeoutMs ?? 15000);
  try {
    const init: JsonInit = {
      method,
      headers: { Authorization: `Bearer ${cfg.manageKey}`, 'Content-Type': 'application/json' },
    };
    if (body !== undefined) init.body = JSON.stringify(body);
    let res: Response;
    try {
      res = await fetch(`${cfg.baseUrl}${path}`, { ...init, signal: controller.signal });
    } catch {
      throw new OmnirouteRequestError(0, null, 'OmniRoute unreachable');
    }
    const parsed = await res.json().catch(() => null);
    if (!res.ok) throw new OmnirouteRequestError(res.status, parsed);
    return parsed as T;
  } finally {
    clearTimeout(timer);
  }
}

export function createOmnirouteAdapter(cfg: OmnirouteAdapterConfig) {
  const req = <T>(path: string, method = 'GET', body?: unknown) => request<T>(cfg, path, method, body);
  return {
    listProviders: () => req<unknown[]>('/api/providers'),
    createProvider: (input: { provider: string; apiKey?: string; name: string }) =>
      req<unknown>('/api/providers', 'POST', input),
    testProvider: (id: string) => req<{ valid: boolean; latencyMs?: number }>(`/api/providers/${id}/test`, 'POST'),
    listCombos: () => req<unknown[]>('/api/combos'),
    upsertCombo: (input: { id: string; models: string[] }) => req<unknown>('/api/combos', 'POST', input),
    listKeys: () => req<unknown[]>('/api/keys'),
    createKey: (input: { name: string; allowedModels?: string[] }) =>
      req<{ id: string; key: string }>('/api/keys', 'POST', input),
    updateKey: (id: string, patch: { allowedModels?: string[] }) =>
      req<unknown>(`/api/keys/${id}`, 'PATCH', patch),
    revokeKey: (id: string) => req<unknown>(`/api/keys/${id}`, 'DELETE'),
  };
}

export type OmnirouteAdapter = ReturnType<typeof createOmnirouteAdapter>;
```

- [ ] **Step 4: Run test to verify it passes**
Run: `cd backend && npx jest src/control/__tests__/omnirouteAdapter.test.ts`
Expected: PASS (all three tests green).

- [ ] **Step 5: Typecheck + commit**
Run: `cd backend && npx tsc --noEmit`
Expected: clean.
```bash
git add backend/src/control/omnirouteAdapter.ts backend/src/control/__tests__/omnirouteAdapter.test.ts
git commit -m "feat(control): OmniRoute management API adapter"
```

---

### Task 2: Adapter env wiring + live contract smoke probe

**Files:**
- Modify: `backend/src/control/controlPlaneConfig.ts` (add `createOmnirouteFromEnvironment`)
- Create: `scripts/control-plane/omniroute-live-probe.js` (E2E probe script, follows existing `app-live-probe.js` pattern)
- Test: extend `backend/src/control/__tests__/controlPlaneConfig.test.ts`

**Interfaces:**
- Consumes: Task 1's `createOmnirouteAdapter`, `OmnirouteAdapterConfig`.
- Produces:
```ts
export function createOmnirouteFromEnvironment(env: NodeJS.ProcessEnv): { adapter: OmnirouteAdapter; embeddingModel: string | null }
// Reads OMNIROUTE_BASE_URL (default http://100.107.7.52:20128), OMNIROUTE_MANAGE_KEY (required when OMNIROUTE_BASE_URL set), OMNIROUTE_EMBEDDING_MODEL (optional)
```
Probe script verifies LIVE contract against the running gateway: `GET /api/providers` 200 → `GET /api/models` 200 → free-model chat completion → temp key create/revoke cycle.

- [ ] **Step 1: Failing test** — missing key throws; defaults applied.

```ts
// append to controlPlaneConfig.test.ts
import { createOmnirouteFromEnvironment } from '../controlPlaneConfig';

test('omniroute env: throws without manage key', () => {
  expect(() => createOmnirouteFromEnvironment({} as NodeJS.ProcessEnv)).toThrow(/OMNIROUTE_MANAGE_KEY/);
});

test('omniroute env: defaults base url, optional embedding model', () => {
  const built = createOmnirouteFromEnvironment({ OMNIROUTE_MANAGE_KEY: 'k' } as NodeJS.ProcessEnv);
  expect(built.adapter).toBeTruthy();
  expect(built.embeddingModel).toBeNull();
});
```

- [ ] **Step 2: Run to verify fail** — `cd backend && npx jest src/control/__tests__/controlPlaneConfig.test.ts` → FAIL (no export).

- [ ] **Step 3: Implement** in `controlPlaneConfig.ts`:

```ts
import { createOmnirouteAdapter, type OmnirouteAdapter } from './omnirouteAdapter';

export function createOmnirouteFromEnvironment(env: NodeJS.ProcessEnv): {
  adapter: OmnirouteAdapter;
  embeddingModel: string | null;
} {
  const manageKey = env['OMNIROUTE_MANAGE_KEY'];
  if (!manageKey) throw new Error('Missing OMNIROUTE_MANAGE_KEY for OmniRoute adapter.');
  const baseUrl = env['OMNIROUTE_BASE_URL'] || 'http://100.107.7.52:20128';
  return {
    adapter: createOmnirouteAdapter({ baseUrl, manageKey }),
    embeddingModel: env['OMNIROUTE_EMBEDDING_MODEL'] || null,
  };
}
```

- [ ] **Step 4: Run tests pass**, then write live probe:

```js
// scripts/control-plane/omniroute-live-probe.js
// Usage: OMNIROUTE_MANAGE_KEY=... node scripts/control-plane/omniroute-live-probe.js
// Verifies LIVE OmniRoute contract. FREE MODELS ONLY.
const BASE = process.env['OMNIROUTE_BASE_URL'] || 'http://100.107.7.52:20128';
const KEY = process.env['OMNIROUTE_MANAGE_KEY'];
if (!KEY) { console.error('OMNIROUTE_MANAGE_KEY required'); process.exit(1); }
const H = { Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' };
async function j(path, opts = {}) {
  const res = await fetch(BASE + path, { ...opts, headers: H });
  const body = await res.json().catch(() => null);
  if (!res.ok) throw new Error(`${path} -> ${res.status}: ${JSON.stringify(body)?.slice(0, 200)}`);
  return body;
}
(async () => {
  const providers = await j('/api/providers');
  console.log('providers OK:', Array.isArray(providers) ? providers.length : typeof providers);
  await j('/api/models');
  console.log('models catalog OK');
  // FREE-model chat completion through the gateway
  const chat = await j('/v1/chat/completions', {
    method: 'POST',
    body: JSON.stringify({ model: process.env.PROBE_FREE_MODEL || 'ds-web/deepseek-v4-flash',
      messages: [{ role: 'user', content: 'Reply with exactly: OK' }], max_tokens: 10 }),
  });
  console.log('chat OK:', chat?.choices?.[0]?.message?.content?.slice(0, 20));
  // temp key lifecycle
  const created = await j('/api/keys', { method: 'POST', body: JSON.stringify({ name: 'brj-probe-temp' }) });
  console.log('temp key created:', Boolean(created?.key));
  await j(`/api/keys/${created.id}`, { method: 'DELETE' });
  console.log('temp key revoked — ALL PROBES PASS');
})().catch((e) => { console.error('PROBE FAIL:', e.message); process.exit(1); });
```

Run it once with the real manage key (created once via OmniRoute dashboard → API Keys with `manage` scope; store in backend `.env` only, never commit). Expected output ends with `ALL PROBES PASS`.

- [ ] **Step 5: Commit**
```bash
git add backend/src/control/controlPlaneConfig.ts backend/src/control/__tests__/controlPlaneConfig.test.ts scripts/control-plane/omniroute-live-probe.js
git commit -m "feat(control): omniroute env wiring + live contract probe"
```

---

### Task 3: Per-user key provisioning service

**Files:**
- Create: `backend/src/control/userModelKeyService.ts`
- Create: Supabase migration `supabase/migrations/<ts>_user_model_keys.sql` — table `control.user_model_keys (user_id uuid pk references auth.users, omniroute_key_id text not null, encrypted_key text not null, allowed_models jsonb not null default '[]', revoked_at timestamptz)`
- Test: `backend/src/control/__tests__/userModelKeyService.test.ts`

**Interfaces:**
- Consumes: Task 1 adapter (`createKey`, `updateKey`, `revokeKey`), existing credential-encryption helper used by the current provider vault (locate in `backend/src/control/supabaseControlPlaneRepository.ts` — reuse, do NOT add a new crypto scheme).
- Produces:
```ts
export interface UserModelKeyService {
  ensureUserKey(userId: string, allowedModels: string[]): Promise<string> // returns decrypted full key; creates or reuses
  setAllowedModels(userId: string, allowedModels: string[]): Promise<void>
  revokeUserKey(userId: string): Promise<void>
}
export function createUserModelKeyService(deps: {
  adapter: OmnirouteAdapter;
  repository: { getUserKey(userId: string): Promise<Row|null>; putUserKey(row: Row): Promise<void>; markRevoked(userId: string): Promise<void> };
  encrypt(secret: string): Promise<string>;
  decrypt(cipher: string): Promise<string>;
}): UserModelKeyService
```
Semantics: `ensureUserKey` returns existing active key if `allowed_models` unchanged; else PATCHes `allowedModels` on the same OmniRoute key (never re-creates unless revoked); full key stored encrypted via injected encryptor; key names are `brj-<userId>`.

- [ ] **Step 1: Failing test** — mock adapter + repo + crypto; cover: first call creates & stores; second call with same models returns cached; changed models PATCHes; revoke marks row and deletes upstream.

```ts
// backend/src/control/__tests__/userModelKeyService.test.ts
import { createUserModelKeyService } from '../userModelKeyService';

function makeDeps() {
  return {
    adapter: { createKey: jest.fn().mockResolvedValue({ id: 'ok1', key: 'sk-full' }),
               updateKey: jest.fn().mockResolvedValue({}), revokeKey: jest.fn().mockResolvedValue({}) },
    repository: { getUserKey: jest.fn().mockResolvedValue(null),
                  putUserKey: jest.fn().mockResolvedValue(undefined),
                  markRevoked: jest.fn().mockResolvedValue(undefined) },
    encrypt: jest.fn(async (s: string) => `enc:${s}`),
    decrypt: jest.fn(async (c: string) => c.replace('enc:', '')),
  };
}

test('creates and stores key on first use', async () => {
  const deps = makeDeps();
  const svc = createUserModelKeyService(deps);
  await expect(svc.ensureUserKey('u1', ['m1'])).resolves.toBe('sk-full');
  expect(deps.adapter.createKey).toHaveBeenCalledWith({ name: 'brj-u1', allowedModels: ['m1'] });
  expect(deps.repository.putUserKey).toHaveBeenCalled();
});

test('reuses cached key when models unchanged', async () => {
  const deps = makeDeps();
  deps.repository.getUserKey.mockResolvedValue({ userId: 'u1', omnirouteKeyId: 'ok1', encryptedKey: 'enc:sk-old', allowedModels: ['m1'], revokedAt: null });
  const svc = createUserModelKeyService(deps);
  await expect(svc.ensureUserKey('u1', ['m1'])).resolves.toBe('sk-old');
  expect(deps.adapter.createKey).not.toHaveBeenCalled();
});

test('patches allowedModels instead of recreating', async () => {
  const deps = makeDeps();
  deps.repository.getUserKey.mockResolvedValue({ userId: 'u1', omnirouteKeyId: 'ok1', encryptedKey: 'enc:sk-old', allowedModels: ['m1'], revokedAt: null });
  const svc = createUserModelKeyService(deps);
  await svc.ensureUserKey('u1', ['m2']);
  expect(deps.adapter.updateKey).toHaveBeenCalledWith('ok1', { allowedModels: ['m2'] });
});
```

- [ ] **Step 2: Verify fail** → Step 3: implement per semantics above (plain class closing over deps; compare `JSON.stringify(allowedModels)` sorted vs stored). Migration SQL: additive, `grant all on control.user_model_keys to service_role;` only (mirror existing control-schema grant style).
- [ ] **Step 4: Tests pass** + `npx tsc --noEmit` clean.
- [ ] **Step 5: Commit** — `feat(control): per-user scoped OmniRoute key provisioning`

---

### Task 4: Chat inference path switch (user-key → OmniRoute)

**Files:**
- Modify: `backend/src/inference/managedInferenceService.ts` (route execution behind flag)
- Modify: `backend/src/routes/managedInferenceRoutes.ts` (resolve user key before execute)
- Create: `backend/src/inference/omnirouteInferenceExecutor.ts`
- Test: `backend/src/inference/__tests__/omnirouteInferenceExecutor.test.ts`

**Interfaces:**
- Consumes: Task 3 `UserModelKeyService.ensureUserKey`, adapter baseUrl/key.
- Produces:
```ts
export function createOmnirouteInferenceExecutor(deps: {
  baseUrl: string;
  getUserKey: (userId: string) => Promise<string>;
  embeddingModel?: string | null;
}): { chat(req: { userId: string; model: string; messages: unknown[] }, signal?: AbortSignal): Promise<Response>; embed(req: { userId: string; input: string[] }): Promise<number[][]> }
```
`chat()` forwards to `POST /v1/chat/completions` with `Authorization: Bearer <userKey>` and returns the raw upstream `Response` (streaming preserved). Managed-access limits still run FIRST in the route handler (unchanged order).

- [ ] **Step 1: Failing test** — mock fetch; assert user key header, URL, and that streaming response is passed through untouched.
- [ ] **Step 2: Verify fail.**
- [ ] **Step 3: Implement executor** (thin fetch wrapper, no retry logic — OmniRoute owns resilience/circuit-breaking).
- [ ] **Step 4: Wire flag** `ADMIN_OMNIROUTE=on|off` read in route handler: `off` (default until parity verified) → old path; `on` → resolve key via `ensureUserKey(user.id, publishedModels)` then executor. Old code path remains intact.
- [ ] **Step 5: Gates pass** (Jest, tsc, eslint changed files). **Commit** — `feat(inference): OmniRoute user-key inference path behind ADMIN_OMNIROUTE flag`

---

### Task 5: Embeddings via OmniRoute

**Files:**
- Extend: `backend/src/inference/omnirouteInferenceExecutor.ts` (`embed()` from Task 4)
- Modify: memory retain/recall path where embeddings originate (locate call sites of Hindsight embedding setup under `backend/src/memory/` and `services/memory/hindsight/`) — point embedding generation at executor when `OMNIROUTE_EMBEDDING_MODEL` is set; otherwise keep existing behavior (soft-fail default).
- Test: extend `backend/src/inference/__tests__/omnirouteInferenceExecutor.test.ts`

**Interfaces:**
- Consumes: `OMNIROUTE_EMBEDDING_MODEL` env (Task 2), internal service key (manage key reused for server-side embedding calls).
- Produces: `embed(): Promise<number[][]>` posting `{ model, input }` to `/v1/embeddings`, returning `data[].embedding` in input order. Failure → soft-fail (log + return empty arrays) exactly like existing Hindsight soft-fail posture.

- [ ] Steps: failing test (order preservation, soft-fail on 500) → implement → wire optional env switch → gates → commit `feat(memory): embeddings via OmniRoute /v1/embeddings (soft-fail)`.

---

### Task 6: Admin panels — Providers + Models (read-only allowlist)

**Files:**
- Create: `admin/src/services/omnirouteAdminApi.ts` (+ `admin/src/services/__tests__/omnirouteAdminApi.test.tsx`)
- Create: `admin/src/components/OmnirouteProvidersPanel.tsx`, `admin/src/components/OmnirouteModelsPanel.tsx`
- Modify: `admin/src/App.tsx` (mount panels behind visible tab when backend reports `ADMIN_OMNIROUTE=on` via existing session/config endpoint)
- Backend: add thin proxy routes in `backend/src/routes/controlPlaneRoutes.ts`: `GET /control/omniroute/providers`, `POST .../providers/test/:id`, `GET /control/omniroute/models`, `PUT /control/omniroute/published-models` (allowlist stored in small Supabase table `control.admin_published_models(model_id text pk, label text)` — additive migration)

**Constraints honored:** UI→hooks→services; gap-* spacing; both color schemes; ≤500 lines/file; admin actions audited via existing audit-log helper.

- [ ] Steps: failing panel tests following existing `adminUi.test.tsx` mock patterns → implement services hooking new backend routes → components (list w/ status pill, "Test" button calling test route, disconnect = remove-from-allowlist ONLY, hard delete requires typing `DELETE PROVIDER` in confirm dialog + audit entry) → App mount behind flag → all gates → commit `feat(admin): OmniRoute-backed providers & models panels`.

---

### Task 7: Admin panels — Keys + Usage + Embeddings settings

**Files:**
- Create: `admin/src/components/OmnirouteKeysPanel.tsx`, `OmnirouteUsagePanel.tsx`, `EmbeddingsSettingsPanel.tsx` (+ tests)
- Backend routes (extend Task 6 block): `GET /control/omniroute/keys?userId=`, `POST .../keys/revoke/:userId`, `GET .../usage?range=daily|monthly`, `GET/PUT .../embeddings-config`

**Behavior:**
- Keys panel: masked values only (`brj-…` prefix + last4 from OmniRoute listing), status pill, Revoke button (calls `revokeUserKey`), re-issue button.
- Usage panel: per-key/model aggregates from `GET /api/usage/*` passthrough.
- Embeddings panel: shows configured model, allows setting via `PUT` (writes env-backed config row), "Send test" button doing a 1-token embed round-trip.
- [ ] Steps: failing tests per panel → implement → gates → commit `feat(admin): OmniRoute keys, usage, embeddings panels`.

---

### Task 8: Flag flip, archive old flow, final review

**Files:**
- Modify: `PROGRESS.md` (dated entry), `docs/superpowers/plans/` ledger updates
- No table drops. Old control-plane code stays but default flag becomes `on` after parity checklist passes.

**Parity checklist (all must be true before flip):**
1. Live probe (Task 2) passes end-to-end.
2. One real user chat round-trips through user-key path (free model).
3. Combo fallback demonstrably reroutes when primary model errors (simulate via invalid model in combo head).
4. Admin panels CRUD-verified against live gateway.
5. Full gates green: Jest all suites, tsc, eslint, check:design.

- [ ] Steps: run checklist items 1–4 live and record outputs in PROGRESS.md → flip default `ADMIN_OMNIROUTE=on` → full gate run → whole-diff security review pass (simple-security scope only) → commit `chore: enable OmniRoute admin plane by default; archive control-plane flow` → PROGRESS.md completion entry.

## Execution Notes

- Worktree: create fresh worktree via `superpowers:using-git-worktrees` at execution start.
- Free models only in ALL probes/tests hitting live gateway.
- If an OmniRoute endpoint shape differs from assumptions above (contract drift), STOP that task, record actual response shape in task report, adapt the adapter — never patch OmniRoute.
