# Cloud Memory Phase 0 Contract and Safety Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Establish canonical source, authority, PostgreSQL, authentication, durable-job, source-inventory, quality, and deployment contracts while every user remains `LOCAL`-authoritative and no source is uploaded.

**Architecture:** The backend uses a provider-neutral managed/private PostgREST gateway. Supabase supplies the first PostgREST/Auth/RLS overlay, while canonical PostgreSQL tables and atomic RPCs remain portable to another managed or private PostgREST deployment. The Node backend gains no database driver and no dependency or lockfile change. Every mutation is an atomic PostgreSQL RPC fenced by deployment ID, epoch, externally issued lease token/expiry, source-credential fingerprint, and active mode.

**Tech Stack:** Expo SDK 54, TypeScript 5.9, Node.js 24 LTS, Express 4, PostgreSQL 17, Supabase Auth/RLS/PostgREST as the initial overlay, managed/private PostgREST as the portable gateway contract, Jest, Node test runner, pgTAP, Docker, and one Heroku Eco web dyno in Common Runtime EU.

## Global Constraints

- Memory authority is per user: `LOCAL`, `MIRROR`, `SHADOW`, or `CLOUD`. The default and effective state remain `LOCAL` throughout Phase 0.
- Deployment write authority is separate: exactly one `deployment_id`, `writer_epoch`, externally issued writer lease, and source-credential fingerprint in `active` mode accepts mutations.
- Every mutation carries `deploymentId`, `writerEpoch`, `writerLeaseId`, the raw `writerLeaseToken`, and `sourceCredentialFingerprint`. PostgreSQL compares the token's SHA-256 digest, lease ID, lease expiry, epoch, deployment, mode, and source credential inside the same transaction.
- Raw writer lease tokens are never stored, returned by bootstrap, logged, or placed in traces. The authority row stores only the digest, issuer/key identifiers, and expiry.
- Missing, malformed, stale, foreign, expired-lease, wrong-token, wrong-source-credential, `maintenance`, `read_only`, or `retired` authority rejects every mutation.
- Canonical mutations are PostgreSQL RPCs. Multi-statement state transitions never occur as separate HTTP requests.
- The backend accesses data only through a configured managed/private PostgREST gateway. Do not add `pg`, `postgres`, an ORM, a vendor database SDK, or any Node dependency.
- Do not modify either lockfile. The package changes in this plan are scripts/engines only.
- Supabase Auth verifies the initial user identity. Backend repositories receive the verified UUID owner ID and do not depend on Express or Supabase types.
- Supabase-specific RLS, grants, `auth.uid()`, and API-key behavior live in the Supabase overlay, not the canonical SQL source.
- `supabase/migrations/202601240001_init.sql` is applied history and must not be edited.
- `supabase/migrations/20260728112723_cloud_memory_foundation.sql` is a historical byte-empty placeholder and must remain unchanged.
- `supabase/migrations/20260728144157_cloud_memory_foundation_20260728112723.sql` is generated from canonical SQL plus the Supabase overlay. Never hand-edit it after the generator exists.
- Every user-data table contains `owner_id uuid not null`, enables and forces RLS in the Supabase overlay, has an owner index, and uses composite owner foreign keys.
- Composite `ON DELETE SET NULL` constraints use PostgreSQL 17 column lists so `owner_id` is never nulled.
- Historical timezone, local date, week-start, and settled time are never invented. Legacy records without captured values carry `legacy_unknown` provenance and nullable temporal fields.
- Phase 0 creates a source high-watermark table and append-only deletion ledger. It does not claim verified erase-all safety; backup tombstone enforcement, dependency erasure verification, and signed deletion completion belong to final Phase 9 and must pass before local heavy stores may retire.
- No cloud extraction, upload, retrieval, prompt injection, model call, or visible-response routing is added.
- Heroku deploys an image built from the exact repository-root commit so both `backend/` and `shared/` exist in the build context.
- The user has explicitly authorized the existing Heroku Eco subscription for exactly one personal `blackrosejournal-api` web dyno at size `eco`, with no add-ons. Any other paid resource still requires separate authorization.
- Preserve unrelated dirty files. In particular, never stage all of an already-modified `PROGRESS.md`.
- Run every command from the repository root. Use `npm --prefix backend ...`; never persistently `cd backend`.
- A targeted backend test command that matches no files must fail.
- Each sabotage changes the real protected unit, produces red, is restored, and produces green.

---

## File Structure

### Shared contracts

- Create `shared/memory/contracts.ts` — canonical enums, source DTOs, temporal provenance, job type/status contracts, and runtime guards.
- Create `shared/memory/sourceIds.ts` — validated reversible source/client-event IDs.
- Create `shared/memory/deploymentAuthority.ts` — provider-neutral deployment write decision.
- Test `__tests__/services/cloudMemoryContracts.test.ts`.
- Test `backend/src/__tests__/memoryContracts.test.ts`.
- Test `backend/src/__tests__/deploymentAuthority.test.ts`.

### PostgreSQL and Supabase overlay

- Create `backend/sql/migrations/0001_memory_foundation.sql` — portable tables and atomic RPCs.
- Create `backend/sql/overlays/supabase/0001_memory_foundation.sql` — RLS, policies, grants, and `auth.uid()` behavior.
- Create `scripts/build-cloud-memory-migration.mjs` — deterministic concatenation into the new Supabase migration.
- Generate `supabase/migrations/20260728144157_cloud_memory_foundation_20260728112723.sql`.
- Create `supabase/tests/cloud_memory_foundation.test.sql`.
- Create `backend/src/__tests__/localPostgrest.integration.test.ts`.
- Test `__tests__/services/cloudMemoryMigrationContract.test.ts`.

### Backend boundary

- Modify `backend/scripts/run-tests.js` — explicit unmatched patterns exit nonzero.
- Create `backend/src/auth/supabaseAuth.ts`.
- Create `backend/src/memory/config.ts`.
- Create `backend/src/memory/gateway/postgrestGateway.ts`.
- Create `backend/src/memory/repositories/memoryRepository.ts`.
- Create `backend/src/memory/repositories/jobRepository.ts`.
- Create `backend/src/memory/routes/memoryRoutes.ts`.
- Create `backend/src/app.ts` — production app composition.
- Modify `backend/src/index.ts` — listener only.
- Modify `backend/src/config/serverConfig.ts`.
- Modify `backend/src/routes/healthRoutes.ts`.
- Test the corresponding files under `backend/src/__tests__/`.

### Client-only safety

- Create `services/memory/cloud/memoryAuthority.ts`.
- Create `services/memory/cloud/sourceInventory.ts`.
- Test `__tests__/services/memory/memoryAuthority.test.ts`.
- Test `__tests__/services/cloudSourceInventory.test.ts`.

### Constitution and deployment

- Create `benchmarks/memory/qualityConstitution.ts`.
- Create `benchmarks/memory/fixtures/phase0Isolation.ts`.
- Update `AGENTS.md`, `PLAN.md`, `memory.md`, `notes/supabase-setup.md`, and `notes/local-only-storage.md`.
- Replace obsolete portions of `__tests__/backend-local-only.test.ts` with cloud-boundary/no-client-secret assertions while preserving SimpleMem/Railway removal guards.
- Create `backend/Dockerfile`.
- Create `backend/.dockerignore`.
- Create `backend/Procfile` for source-build fallback documentation; the actual deployment uses the root-context container image.
- Update `PROGRESS.md` only through a separately reviewed patch.

---

### Task 0: Make Targeted Backend Tests Fail Closed

**Files:**
- Modify: `backend/scripts/run-tests.js`
- Test: `backend/src/__tests__/testRunner.test.ts`

**Interfaces:**
- Produces: `npm --prefix backend test -- --testPathPattern=<pattern>` exits `1` when no test file matches.
- Consumes: no production modules.

- [ ] **Step 1: Write the failing runner regression**

Create `backend/src/__tests__/testRunner.test.ts`:

```ts
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import path from 'node:path';

describe('backend test runner', () => {
  it('fails when an explicit pattern matches no files', () => {
    const backendRoot = path.resolve(__dirname, '../..');
    const result = spawnSync(
      process.execPath,
      ['scripts/run-tests.js', '--testPathPattern=definitely-not-a-real-test'],
      { cwd: backendRoot, encoding: 'utf8' },
    );
    assert.equal(result.status, 1);
    assert.match(`${result.stdout}${result.stderr}`, /No test files matched pattern/);
  });
});
```

- [ ] **Step 2: Prove the current false green**

Run:

```powershell
npm --prefix backend test -- --testPathPattern=testRunner
```

Expected: FAIL because the nested missing-pattern process currently exits `0`.

- [ ] **Step 3: Make unmatched explicit patterns fail**

In `backend/scripts/run-tests.js`, replace the no-match branch with:

```js
if (filtered.length === 0) {
    console.error(`No test files matched pattern: ${pattern || '(none)'}`);
    process.exit(pattern ? 1 : 0);
}
```

- [ ] **Step 4: Verify and sabotage**

Run:

```powershell
npm --prefix backend test -- --testPathPattern=testRunner
npm --prefix backend test -- --testPathPattern=definitely-not-a-real-test
```

Expected: first command PASS; second command exits `1`.

Sabotage: temporarily change `pattern ? 1 : 0` to `0`; confirm `testRunner` fails; restore and rerun.

- [ ] **Step 5: Commit**

```powershell
git add backend/scripts/run-tests.js backend/src/__tests__/testRunner.test.ts
git commit -m "test(backend): fail closed on unmatched test patterns"
```

---

### Task 1: Canonical Source, Job, and Deployment Contracts

**Files:**
- Create: `shared/memory/contracts.ts`
- Create: `shared/memory/sourceIds.ts`
- Create: `shared/memory/deploymentAuthority.ts`
- Modify: `backend/tsconfig.json`
- Modify: `backend/package.json`
- Test: `__tests__/services/cloudMemoryContracts.test.ts`
- Test: `backend/src/__tests__/memoryContracts.test.ts`
- Test: `backend/src/__tests__/deploymentAuthority.test.ts`

**Interfaces:**
- Produces: the exact types and guards shown below.
- Produces: `conversationSourceId`, `parseConversationSourceId`, `messageClientEventId`, `parseMessageClientEventId`.
- Produces: `evaluateDeploymentWrite(authority, request)`.

- [ ] **Step 1: Write the failing root contract tests**

Create `__tests__/services/cloudMemoryContracts.test.ts`:

```ts
import {
    MEMORY_AUTHORITY_STATES,
    MEMORY_JOB_STATUSES,
    parseMemoryFeatureFlags,
} from '../../shared/memory/contracts';
import {
    conversationSourceId,
    messageClientEventId,
    parseConversationSourceId,
    parseMessageClientEventId,
} from '../../shared/memory/sourceIds';

describe('cloud memory contracts', () => {
    it('pins authority and durable job states', () => {
        expect(MEMORY_AUTHORITY_STATES).toEqual(['LOCAL', 'MIRROR', 'SHADOW', 'CLOUD']);
        expect(MEMORY_JOB_STATUSES).toEqual([
            'queued', 'leased', 'succeeded', 'retryable', 'dead_letter', 'cancelled',
        ]);
    });

    it('validates feature flags at runtime', () => {
        const flags = {
            cloudSourceMirroring: true,
            cloudProjectionBuild: false,
            shadowRetrieval: false,
            cloudReadAuthority: false,
            cloudWriteAuthority: false,
        };
        expect(parseMemoryFeatureFlags(flags)).toEqual(flags);
        expect(parseMemoryFeatureFlags({ ...flags, cloudWriteAuthority: 'yes' })).toBeNull();
        expect(parseMemoryFeatureFlags(null)).toBeNull();
    });

    it('round-trips reserved and Unicode ID segments', () => {
        const conversationId = conversationSourceId('journal', 'entry:雪/1');
        const eventId = messageClientEventId(conversationId, 'message:%/2');
        expect(parseConversationSourceId(conversationId)).toEqual({
            kind: 'journal',
            recordId: 'entry:雪/1',
        });
        expect(parseMessageClientEventId(eventId)).toEqual({
            conversationId,
            messageId: 'message:%/2',
        });
        expect(() => conversationSourceId('journal', '')).toThrow('recordId');
    });
});
```

- [ ] **Step 2: Write backend parity and deployment tests**

Create `backend/src/__tests__/memoryContracts.test.ts` and `backend/src/__tests__/deploymentAuthority.test.ts`:

```ts
// memoryContracts.test.ts
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  MEMORY_CONTRACT_VERSION,
  type CanonicalMessageSource,
} from '../../../shared/memory/contracts';

describe('shared memory contract parity', () => {
  it('supports canonical roles, lifecycle, and unknown historical time', () => {
    const source: CanonicalMessageSource = {
      id: 'message-id',
      conversationId: 'journal:entry',
      clientEventId: 'journal%3Aentry:message-id',
      role: 'tool',
      sequence: 0,
      authoredAt: '2026-07-28T00:00:00.000Z',
      authoredTimezone: null,
      localDate: null,
      temporalProvenance: 'legacy_unknown',
      content: 'opaque source',
      revision: 2,
      status: 'edited',
    };
    assert.equal(MEMORY_CONTRACT_VERSION, 1);
    assert.equal(source.temporalProvenance, 'legacy_unknown');
  });
});
```

```ts
// deploymentAuthority.test.ts
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { evaluateDeploymentWrite } from '../../../shared/memory/deploymentAuthority';

const authority = {
  deploymentId: 'blackrose-primary',
  writerEpoch: 7,
  mode: 'active' as const,
  backendBaseUrl: 'https://api.example.test',
  databaseFingerprint: 'sha256:primary',
  writerLeaseId: '00000000-0000-4000-8000-000000000077',
  writerLeaseExpiresAt: '2099-07-28T00:00:00.000Z',
  writerLeaseIssuer: 'rosebud-operator',
  writerLeaseKeyId: 'operator-key-1',
  sourceCredentialFingerprint: 'sha256:source-a',
};

describe('deployment write authority', () => {
  it('accepts only the matching active writer', () => {
    assert.deepEqual(evaluateDeploymentWrite(authority, {
      deploymentId: 'blackrose-primary',
      writerEpoch: 7,
      writerLeaseId: authority.writerLeaseId,
      writerLeaseToken: 'opaque-signed-lease-token',
      sourceCredentialFingerprint: authority.sourceCredentialFingerprint,
      now: new Date('2026-07-28T00:00:00.000Z'),
    }), { accepted: true });
  });

  it('rejects missing, stale, foreign, and non-active authority', () => {
    assert.deepEqual(evaluateDeploymentWrite(null, {
      deploymentId: 'blackrose-primary',
      writerEpoch: 7,
      writerLeaseId: authority.writerLeaseId,
      writerLeaseToken: 'opaque-signed-lease-token',
      sourceCredentialFingerprint: authority.sourceCredentialFingerprint,
      now: new Date('2026-07-28T00:00:00.000Z'),
    }), { accepted: false, reason: 'authority_unavailable' });
    assert.equal(evaluateDeploymentWrite(authority, {
      deploymentId: 'blackrose-primary',
      writerEpoch: 6,
      writerLeaseId: authority.writerLeaseId,
      writerLeaseToken: 'opaque-signed-lease-token',
      sourceCredentialFingerprint: authority.sourceCredentialFingerprint,
      now: new Date('2026-07-28T00:00:00.000Z'),
    }).accepted, false);
    assert.equal(evaluateDeploymentWrite(authority, {
      deploymentId: 'other',
      writerEpoch: 7,
      writerLeaseId: authority.writerLeaseId,
      writerLeaseToken: 'opaque-signed-lease-token',
      sourceCredentialFingerprint: authority.sourceCredentialFingerprint,
      now: new Date('2026-07-28T00:00:00.000Z'),
    }).accepted, false);
    for (const mode of ['maintenance', 'read_only', 'retired'] as const) {
      assert.equal(evaluateDeploymentWrite({ ...authority, mode }, {
        deploymentId: authority.deploymentId,
        writerEpoch: authority.writerEpoch,
        writerLeaseId: authority.writerLeaseId,
        writerLeaseToken: 'opaque-signed-lease-token',
        sourceCredentialFingerprint: authority.sourceCredentialFingerprint,
        now: new Date('2026-07-28T00:00:00.000Z'),
      }).accepted, false);
    }
    assert.equal(evaluateDeploymentWrite(authority, {
      deploymentId: authority.deploymentId,
      writerEpoch: authority.writerEpoch,
      writerLeaseId: '00000000-0000-4000-8000-000000000078',
      writerLeaseToken: 'opaque-signed-lease-token',
      sourceCredentialFingerprint: authority.sourceCredentialFingerprint,
      now: new Date('2026-07-28T00:00:00.000Z'),
    }).accepted, false);
    assert.equal(evaluateDeploymentWrite(authority, {
      deploymentId: authority.deploymentId,
      writerEpoch: authority.writerEpoch,
      writerLeaseId: authority.writerLeaseId,
      writerLeaseToken: 'opaque-signed-lease-token',
      sourceCredentialFingerprint: 'sha256:wrong-source',
      now: new Date('2026-07-28T00:00:00.000Z'),
    }).accepted, false);
    assert.deepEqual(evaluateDeploymentWrite(authority, {
      deploymentId: authority.deploymentId,
      writerEpoch: authority.writerEpoch,
      writerLeaseId: authority.writerLeaseId,
      writerLeaseToken: 'opaque-signed-lease-token',
      sourceCredentialFingerprint: authority.sourceCredentialFingerprint,
      now: new Date('2100-07-28T00:00:00.000Z'),
    }), { accepted: false, reason: 'lease_expired' });
  });
});
```

- [ ] **Step 3: Run red**

```powershell
npx jest --runInBand __tests__/services/cloudMemoryContracts.test.ts
npm --prefix backend test -- --testPathPattern=memoryContracts
npm --prefix backend test -- --testPathPattern=deploymentAuthority
```

Expected: FAIL with missing shared modules.

- [ ] **Step 4: Implement the exact shared contract**

Create `shared/memory/contracts.ts`:

```ts
export const MEMORY_CONTRACT_VERSION = 1 as const;
export const MEMORY_AUTHORITY_STATES = ['LOCAL', 'MIRROR', 'SHADOW', 'CLOUD'] as const;
export type MemoryAuthorityState = typeof MEMORY_AUTHORITY_STATES[number];

export const DEPLOYMENT_MODES = ['active', 'maintenance', 'read_only', 'retired'] as const;
export type DeploymentMode = typeof DEPLOYMENT_MODES[number];

export interface DeploymentAuthority {
  deploymentId: string;
  writerEpoch: number;
  mode: DeploymentMode;
  backendBaseUrl: string | null;
  databaseFingerprint: string;
  writerLeaseId: string | null;
  writerLeaseExpiresAt: string | null;
  writerLeaseIssuer: string | null;
  writerLeaseKeyId: string | null;
  sourceCredentialFingerprint: string | null;
}

export const MEMORY_SOURCE_KINDS = ['journal', 'freeform_chat', 'intention_checkin'] as const;
export type MemorySourceKind = typeof MEMORY_SOURCE_KINDS[number];
export type TemporalProvenance = 'captured' | 'legacy_unknown';

export const MEMORY_JOB_STATUSES = [
  'queued', 'leased', 'succeeded', 'retryable', 'dead_letter', 'cancelled',
] as const;
export type MemoryJobStatus = typeof MEMORY_JOB_STATUSES[number];

export const MEMORY_JOB_TYPES = [
  'capture_source',
  'extract_turn_candidates',
  'checkpoint_conversation',
  'curate_session',
  'reconcile_entities',
  'reconcile_claims',
  'audit_epistemic_authorization',
  'audit_supersession_chains',
  'build_temporal_digest',
  'build_current_life_snapshot',
  'build_profile_tree',
  'build_search_document',
  'embed_search_document',
  'observe_interaction_outcome',
  'review_pattern_hypotheses',
  'scan_cross_domain_collisions',
  'rebuild_personalized_promotion_policy',
  'refresh_external_fact_snapshot',
  'cascade_source_invalidation',
  'verify_deletion',
  'compare_shadow_retrieval',
  'rebuild_projection_version',
] as const;
export type MemoryJobType = typeof MEMORY_JOB_TYPES[number];

export interface MemoryFeatureFlags {
  cloudSourceMirroring: boolean;
  cloudProjectionBuild: boolean;
  shadowRetrieval: boolean;
  cloudReadAuthority: boolean;
  cloudWriteAuthority: boolean;
}

const FEATURE_KEYS = [
  'cloudSourceMirroring',
  'cloudProjectionBuild',
  'shadowRetrieval',
  'cloudReadAuthority',
  'cloudWriteAuthority',
] as const;

export function parseMemoryFeatureFlags(value: unknown): MemoryFeatureFlags | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  if (Object.keys(record).length !== FEATURE_KEYS.length) return null;
  if (!FEATURE_KEYS.every((key) => typeof record[key] === 'boolean')) return null;
  return Object.fromEntries(FEATURE_KEYS.map((key) => [key, record[key]])) as unknown
    as MemoryFeatureFlags;
}

export interface CanonicalConversationSource {
  id: string;
  sourceKind: MemorySourceKind;
  sourceRecordId: string;
  status: 'draft' | 'active' | 'settled' | 'deleted';
  startedAt: string;
  settledAt: string | null;
  timezone: string | null;
  weekStartsOn: 0 | 1 | null;
  temporalProvenance: TemporalProvenance;
  clientSchemaVersion: 1;
}

export interface CanonicalMessageSource {
  id: string;
  conversationId: string;
  clientEventId: string;
  role: 'user' | 'assistant' | 'system' | 'tool';
  sequence: number;
  authoredAt: string;
  authoredTimezone: string | null;
  localDate: string | null;
  temporalProvenance: TemporalProvenance;
  content: string;
  revision: number;
  status: 'active' | 'edited' | 'deleted';
}

export interface MemorySourceInventory {
  contractVersion: typeof MEMORY_CONTRACT_VERSION;
  generatedAt: string;
  conversationCount: number;
  messageCount: number;
  oldestAuthoredAt: string | null;
  newestAuthoredAt: string | null;
  conversations: CanonicalConversationSource[];
  messages: CanonicalMessageSource[];
}

export function isMemoryAuthorityState(value: unknown): value is MemoryAuthorityState {
  return typeof value === 'string'
    && (MEMORY_AUTHORITY_STATES as readonly string[]).includes(value);
}
```

Create `shared/memory/sourceIds.ts`:

```ts
import { MEMORY_SOURCE_KINDS, type MemorySourceKind } from './contracts';

function assertSegment(name: string, value: string): void {
  if (value.length === 0) throw new Error(`${name} must not be empty`);
}

export function conversationSourceId(kind: MemorySourceKind, recordId: string): string {
  assertSegment('recordId', recordId);
  return `${kind}:${encodeURIComponent(recordId)}`;
}

export function parseConversationSourceId(value: string): {
  kind: MemorySourceKind;
  recordId: string;
} | null {
  const separator = value.indexOf(':');
  if (separator <= 0) return null;
  const kind = value.slice(0, separator);
  if (!(MEMORY_SOURCE_KINDS as readonly string[]).includes(kind)) return null;
  try {
    const recordId = decodeURIComponent(value.slice(separator + 1));
    return recordId ? { kind: kind as MemorySourceKind, recordId } : null;
  } catch {
    return null;
  }
}

export function messageClientEventId(conversationId: string, messageId: string): string {
  assertSegment('conversationId', conversationId);
  assertSegment('messageId', messageId);
  return `${encodeURIComponent(conversationId)}:${encodeURIComponent(messageId)}`;
}

export function parseMessageClientEventId(value: string): {
  conversationId: string;
  messageId: string;
} | null {
  const separator = value.indexOf(':');
  if (separator <= 0) return null;
  try {
    const conversationId = decodeURIComponent(value.slice(0, separator));
    const messageId = decodeURIComponent(value.slice(separator + 1));
    return conversationId && messageId ? { conversationId, messageId } : null;
  } catch {
    return null;
  }
}
```

Create `shared/memory/deploymentAuthority.ts`:

```ts
import type { DeploymentAuthority } from './contracts';

export interface DeploymentWriteRequest {
  deploymentId: string;
  writerEpoch: number;
  writerLeaseId: string;
  writerLeaseToken: string;
  sourceCredentialFingerprint: string;
  now?: Date;
}

export type DeploymentWriteDecision =
  | { accepted: true }
  | {
      accepted: false;
      reason:
        | 'authority_unavailable'
        | 'not_active'
        | 'deployment_mismatch'
        | 'stale_epoch'
        | 'lease_mismatch'
        | 'lease_expired'
        | 'lease_token_missing'
        | 'source_credential_mismatch';
    };

export function evaluateDeploymentWrite(
  authority: DeploymentAuthority | null,
  request: DeploymentWriteRequest,
): DeploymentWriteDecision {
  if (!authority) return { accepted: false, reason: 'authority_unavailable' };
  if (authority.mode !== 'active') return { accepted: false, reason: 'not_active' };
  if (authority.deploymentId !== request.deploymentId) {
    return { accepted: false, reason: 'deployment_mismatch' };
  }
  if (authority.writerEpoch !== request.writerEpoch) {
    return { accepted: false, reason: 'stale_epoch' };
  }
  if (authority.writerLeaseId !== request.writerLeaseId) {
    return { accepted: false, reason: 'lease_mismatch' };
  }
  if (!request.writerLeaseToken) {
    return { accepted: false, reason: 'lease_token_missing' };
  }
  if (authority.sourceCredentialFingerprint !== request.sourceCredentialFingerprint) {
    return { accepted: false, reason: 'source_credential_mismatch' };
  }
  const now = request.now ?? new Date();
  if (!authority.writerLeaseExpiresAt) {
    return { accepted: false, reason: 'lease_expired' };
  }
  const expiresAt = new Date(authority.writerLeaseExpiresAt);
  if (!Number.isFinite(expiresAt.getTime()) || expiresAt.getTime() <= now.getTime()) {
    return { accepted: false, reason: 'lease_expired' };
  }
  return { accepted: true };
}
```

- [ ] **Step 5: Compile shared code locally and in the backend**

Set `backend/tsconfig.json` to:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "commonjs",
    "lib": ["ES2022"],
    "outDir": "dist",
    "rootDir": "..",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "declaration": true
  },
  "include": ["src", "../shared/memory"],
  "exclude": ["node_modules", "dist"]
}
```

Add only these fields to `backend/package.json`; preserve dependencies verbatim:

```json
"engines": { "node": "24.x", "npm": "11.x" },
"scripts": {
  "dev": "tsx watch src/index.ts",
  "start": "node dist/backend/src/index.js",
  "build": "tsc",
  "test": "node scripts/run-tests.js"
}
```

Run:

```powershell
npx jest --runInBand __tests__/services/cloudMemoryContracts.test.ts
npm --prefix backend test -- --testPathPattern=memoryContracts
npm --prefix backend test -- --testPathPattern=deploymentAuthority
npm --prefix backend run build
git diff --exit-code -- package-lock.json backend/package-lock.json
```

Expected: PASS; `backend/dist/backend/src/index.js` exists; both lockfiles are unchanged.

- [ ] **Step 6: Sabotage and commit**

Sabotage: make `maintenance` return accepted in `evaluateDeploymentWrite`; confirm `deploymentAuthority` fails; restore and rerun.

```powershell
git add shared/memory backend/tsconfig.json backend/package.json __tests__/services/cloudMemoryContracts.test.ts backend/src/__tests__/memoryContracts.test.ts backend/src/__tests__/deploymentAuthority.test.ts
git commit -m "feat(memory): define canonical authority and source contracts"
```

---

### Task 2: Fail-Closed Memory Route Derivation

**Files:**
- Create: `services/memory/cloud/memoryAuthority.ts`
- Test: `__tests__/services/memory/memoryAuthority.test.ts`

**Interfaces:**
- Consumes: `rawServerIssuedState: unknown`, an owner-state envelope obtained from the authenticated Task 6 memory-state route, and `rawCurrentBinding: unknown`, the current client session/endpoint/version binding.
- Produces: `resolveMemoryRuntime(rawServerIssuedState, rawCurrentBinding): MemoryRuntimeRoute`.
- This function is a pure client-side route-table evaluator. It performs structural validation and prevents accidental use of stale, cross-owner, cross-deployment, expired-session, or under-flagged state. It is **not** an authentication, authorization, signature-verification, or server-security boundary.
- The names `ServerIssuedOwnerMemoryState` and `CurrentMemoryRuntimeBinding` describe required provenance at the call site; a structurally similar object does not prove that provenance.
- Never populate either input from settings, environment variables, query parameters, request bodies, or an unkeyed cache. Cache server state only under `(ownerId, deploymentId, writerEpoch)`, retain the greatest accepted `authorityVersion` for that tuple, and clear it on sign-out or account change. Construct the current binding at invocation time from the current Supabase session and active endpoint profile; never persist or reuse that binding across sessions.
- Task 5 must verify the Supabase access token server-side on every memory request, reject missing/invalid/expired identity with `401`, reject identity-provider unavailability with `503`, and derive the UUID owner ID without trusting client owner fields.
- Task 6 must ignore client owner IDs, bind repository calls to `res.locals.memoryAuth.ownerId`, and return that backend-verified owner UUID together with the current deployment ID, writer epoch, authority version, authority state, and flags. Server repositories/RLS/RPCs enforce authorization regardless of this client decision.
- Phase 0 does not wire this evaluator into visible-response or write authority. Local storage remains authoritative.

- [ ] **Step 1: Write the failing exhaustive route-table test**

Create `__tests__/services/memory/memoryAuthority.test.ts`:

```ts
import {
    resolveMemoryRuntime,
    type MemoryRuntimeRoute,
} from '../../../services/memory/cloud/memoryAuthority';
import {
    MEMORY_AUTHORITY_STATES,
    type MemoryAuthorityState,
    type MemoryFeatureFlags,
} from '../../../shared/memory/contracts';

const ownerA = '00000000-0000-4000-8000-00000000000a';
const ownerB = '00000000-0000-4000-8000-00000000000b';
const flagKeys = [
    'cloudSourceMirroring',
    'cloudProjectionBuild',
    'shadowRetrieval',
    'cloudReadAuthority',
    'cloudWriteAuthority',
] as const;

const routes = {
    LOCAL: {
        effectiveState: 'LOCAL',
        mirrorWrites: false,
        runShadow: false,
        readFromCloud: false,
        writeToCloud: false,
    },
    MIRROR: {
        effectiveState: 'MIRROR',
        mirrorWrites: true,
        runShadow: false,
        readFromCloud: false,
        writeToCloud: false,
    },
    SHADOW: {
        effectiveState: 'SHADOW',
        mirrorWrites: true,
        runShadow: true,
        readFromCloud: false,
        writeToCloud: false,
    },
    CLOUD: {
        effectiveState: 'CLOUD',
        mirrorWrites: false,
        runShadow: false,
        readFromCloud: true,
        writeToCloud: true,
    },
} as const satisfies Record<MemoryAuthorityState, MemoryRuntimeRoute>;

function flagsFor(mask: number): MemoryFeatureFlags {
    return Object.fromEntries(
        flagKeys.map((key, index) => [key, Boolean(mask & (1 << index))]),
    ) as unknown as MemoryFeatureFlags;
}

function serverState(
    authorityState: MemoryAuthorityState,
    featureFlags: unknown,
    overrides: Readonly<Record<string, unknown>> = {},
): Readonly<Record<string, unknown>> {
    return {
        ownerId: ownerA,
        deploymentId: 'blackrose-primary',
        writerEpoch: 11,
        authorityVersion: 7,
        authorityState,
        featureFlags,
        ...overrides,
    };
}

function currentBinding(
    overrides: Readonly<Record<string, unknown>> = {},
): Readonly<Record<string, unknown>> {
    return {
        sessionOwnerId: ownerA,
        sessionExpiresAtEpochSeconds: 2_000_000_000,
        nowEpochSeconds: 1_800_000_000,
        expectedDeploymentId: 'blackrose-primary',
        expectedWriterEpoch: 11,
        minimumAuthorityVersion: 7,
        ...overrides,
    };
}

function expectedRoute(
    state: MemoryAuthorityState,
    flags: MemoryFeatureFlags,
): MemoryRuntimeRoute {
    if (state === 'MIRROR' && flags.cloudSourceMirroring) return routes.MIRROR;
    if (
        state === 'SHADOW'
        && flags.cloudSourceMirroring
        && flags.cloudProjectionBuild
        && flags.shadowRetrieval
    ) {
        return routes.SHADOW;
    }
    if (state === 'CLOUD' && flags.cloudReadAuthority && flags.cloudWriteAuthority) {
        return routes.CLOUD;
    }
    return routes.LOCAL;
}

describe('resolveMemoryRuntime', () => {
    it.each(MEMORY_AUTHORITY_STATES)(
        'evaluates every valid flag combination for %s',
        (state) => {
            for (let mask = 0; mask < 32; mask += 1) {
                const flags = flagsFor(mask);
                expect(resolveMemoryRuntime(
                    serverState(state, flags),
                    currentBinding(),
                )).toEqual(expectedRoute(state, flags));
            }
        },
    );

    it('returns independent objects with exact route shapes', () => {
        const flags = flagsFor(31);
        const first = resolveMemoryRuntime(serverState('CLOUD', flags), currentBinding());
        const second = resolveMemoryRuntime(serverState('CLOUD', flags), currentBinding());
        expect(first).toEqual(routes.CLOUD);
        expect(second).toEqual(routes.CLOUD);
        expect(first).not.toBe(second);
    });
});
```

- [ ] **Step 2: Run the exhaustive test red**

```powershell
npx jest --runInBand '__tests__/services/memory/memoryAuthority.test.ts'
```

Expected: FAIL with missing module.

- [ ] **Step 3: Add failing malformed-state and binding tests**

Append inside the same `describe`:

```ts
it.each([
    null,
    'CLOUD',
    serverState('CLOUD', { ...flagsFor(31), futureFlag: true }),
    serverState('CLOUD', { ...flagsFor(31), cloudWriteAuthority: 'yes' }),
    serverState('CLOUD', { cloudReadAuthority: true, cloudWriteAuthority: true }),
    serverState('CLOUD', flagsFor(31), { ownerId: 'not-a-uuid' }),
    serverState('CLOUD', flagsFor(31), { authorityState: 'cloud' }),
    serverState('CLOUD', flagsFor(31), { authorityVersion: 0 }),
    serverState('CLOUD', flagsFor(31), { writerEpoch: 0 }),
    serverState('CLOUD', flagsFor(31), { unexpected: true }),
])('fails malformed or extra-key server state closed to LOCAL: %#', (state) => {
    expect(resolveMemoryRuntime(state, currentBinding())).toEqual(routes.LOCAL);
});

it.each([
    null,
    { sessionOwnerId: ownerA },
    currentBinding({ sessionOwnerId: ownerB }),
    currentBinding({ sessionOwnerId: 'not-a-uuid' }),
    currentBinding({ sessionExpiresAtEpochSeconds: 1_800_000_000 }),
    currentBinding({ expectedDeploymentId: 'other-deployment' }),
    currentBinding({ expectedWriterEpoch: 10 }),
    currentBinding({ minimumAuthorityVersion: 8 }),
    currentBinding({ unexpected: true }),
])('fails missing, expired, stale, or mismatched binding closed to LOCAL: %#', (binding) => {
    expect(resolveMemoryRuntime(
        serverState('CLOUD', flagsFor(31)),
        binding,
    )).toEqual(routes.LOCAL);
});

it('does not let a binding upgrade a server-issued LOCAL state', () => {
    expect(resolveMemoryRuntime(
        serverState('LOCAL', flagsFor(31)),
        currentBinding(),
    )).toEqual(routes.LOCAL);
});
```

- [ ] **Step 4: Run the malformed-input tests red**

```powershell
npx jest --runInBand '__tests__/services/memory/memoryAuthority.test.ts'
```

Expected: FAIL with missing module.

- [ ] **Step 5: Implement exact pure runtime validation**

Create `services/memory/cloud/memoryAuthority.ts`:

```ts
import {
    isMemoryAuthorityState,
    parseMemoryFeatureFlags,
    type MemoryAuthorityState,
    type MemoryFeatureFlags,
} from '../../../shared/memory/contracts';

export type MemoryRuntimeRoute =
    | {
        readonly effectiveState: 'LOCAL';
        readonly mirrorWrites: false;
        readonly runShadow: false;
        readonly readFromCloud: false;
        readonly writeToCloud: false;
    }
    | {
        readonly effectiveState: 'MIRROR';
        readonly mirrorWrites: true;
        readonly runShadow: false;
        readonly readFromCloud: false;
        readonly writeToCloud: false;
    }
    | {
        readonly effectiveState: 'SHADOW';
        readonly mirrorWrites: true;
        readonly runShadow: true;
        readonly readFromCloud: false;
        readonly writeToCloud: false;
    }
    | {
        readonly effectiveState: 'CLOUD';
        readonly mirrorWrites: false;
        readonly runShadow: false;
        readonly readFromCloud: true;
        readonly writeToCloud: true;
    };

interface ServerIssuedOwnerMemoryState {
    ownerId: string;
    deploymentId: string;
    writerEpoch: number;
    authorityVersion: number;
    authorityState: MemoryAuthorityState;
    featureFlags: MemoryFeatureFlags;
}

interface CurrentMemoryRuntimeBinding {
    sessionOwnerId: string;
    sessionExpiresAtEpochSeconds: number;
    nowEpochSeconds: number;
    expectedDeploymentId: string;
    expectedWriterEpoch: number;
    minimumAuthorityVersion: number;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const STATE_KEYS = [
    'ownerId',
    'deploymentId',
    'writerEpoch',
    'authorityVersion',
    'authorityState',
    'featureFlags',
] as const;
const BINDING_KEYS = [
    'sessionOwnerId',
    'sessionExpiresAtEpochSeconds',
    'nowEpochSeconds',
    'expectedDeploymentId',
    'expectedWriterEpoch',
    'minimumAuthorityVersion',
] as const;

function local(): MemoryRuntimeRoute {
    return {
        effectiveState: 'LOCAL',
        mirrorWrites: false,
        runShadow: false,
        readFromCloud: false,
        writeToCloud: false,
    };
}

function isExactRecord(
    value: unknown,
    keys: readonly string[],
): value is Record<string, unknown> {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
    const actual = Object.keys(value);
    return actual.length === keys.length && keys.every((key) => actual.includes(key));
}

function isPositiveSafeInteger(value: unknown): value is number {
    return typeof value === 'number'
        && Number.isSafeInteger(value)
        && value > 0;
}

function isDeploymentId(value: unknown): value is string {
    return typeof value === 'string'
        && value.length > 0
        && value.trim() === value;
}

function parseServerState(value: unknown): ServerIssuedOwnerMemoryState | null {
    if (!isExactRecord(value, STATE_KEYS)) return null;
    const flags = parseMemoryFeatureFlags(value.featureFlags);
    if (
        typeof value.ownerId !== 'string'
        || !UUID.test(value.ownerId)
        || !isDeploymentId(value.deploymentId)
        || !isPositiveSafeInteger(value.writerEpoch)
        || !isPositiveSafeInteger(value.authorityVersion)
        || !isMemoryAuthorityState(value.authorityState)
        || !flags
    ) {
        return null;
    }
    return {
        ownerId: value.ownerId,
        deploymentId: value.deploymentId,
        writerEpoch: value.writerEpoch,
        authorityVersion: value.authorityVersion,
        authorityState: value.authorityState,
        featureFlags: flags,
    };
}

function parseCurrentBinding(value: unknown): CurrentMemoryRuntimeBinding | null {
    if (!isExactRecord(value, BINDING_KEYS)) return null;
    if (
        typeof value.sessionOwnerId !== 'string'
        || !UUID.test(value.sessionOwnerId)
        || typeof value.sessionExpiresAtEpochSeconds !== 'number'
        || !Number.isSafeInteger(value.sessionExpiresAtEpochSeconds)
        || value.sessionExpiresAtEpochSeconds <= 0
        || typeof value.nowEpochSeconds !== 'number'
        || !Number.isSafeInteger(value.nowEpochSeconds)
        || value.nowEpochSeconds < 0
        || value.sessionExpiresAtEpochSeconds <= value.nowEpochSeconds
        || !isDeploymentId(value.expectedDeploymentId)
        || !isPositiveSafeInteger(value.expectedWriterEpoch)
        || !isPositiveSafeInteger(value.minimumAuthorityVersion)
    ) {
        return null;
    }
    return {
        sessionOwnerId: value.sessionOwnerId,
        sessionExpiresAtEpochSeconds: value.sessionExpiresAtEpochSeconds,
        nowEpochSeconds: value.nowEpochSeconds,
        expectedDeploymentId: value.expectedDeploymentId,
        expectedWriterEpoch: value.expectedWriterEpoch,
        minimumAuthorityVersion: value.minimumAuthorityVersion,
    };
}

function bindingMatches(
    state: ServerIssuedOwnerMemoryState,
    binding: CurrentMemoryRuntimeBinding,
): boolean {
    return state.ownerId === binding.sessionOwnerId
        && state.deploymentId === binding.expectedDeploymentId
        && state.writerEpoch === binding.expectedWriterEpoch
        && state.authorityVersion >= binding.minimumAuthorityVersion;
}

export function resolveMemoryRuntime(
    rawServerIssuedState: unknown,
    rawCurrentBinding: unknown,
): MemoryRuntimeRoute {
    const state = parseServerState(rawServerIssuedState);
    if (!state || state.authorityState === 'LOCAL') return local();

    const binding = parseCurrentBinding(rawCurrentBinding);
    if (!binding || !bindingMatches(state, binding)) return local();

    const flags = state.featureFlags;
    if (state.authorityState === 'MIRROR' && flags.cloudSourceMirroring) {
        return {
            effectiveState: 'MIRROR',
            mirrorWrites: true,
            runShadow: false,
            readFromCloud: false,
            writeToCloud: false,
        };
    }
    if (
        state.authorityState === 'SHADOW'
        && flags.cloudSourceMirroring
        && flags.cloudProjectionBuild
        && flags.shadowRetrieval
    ) {
        return {
            effectiveState: 'SHADOW',
            mirrorWrites: true,
            runShadow: true,
            readFromCloud: false,
            writeToCloud: false,
        };
    }
    if (
        state.authorityState === 'CLOUD'
        && flags.cloudReadAuthority
        && flags.cloudWriteAuthority
    ) {
        return {
            effectiveState: 'CLOUD',
            mirrorWrites: false,
            runShadow: false,
            readFromCloud: true,
            writeToCloud: true,
        };
    }
    return local();
}
```

- [ ] **Step 6: Verify both test families**

```powershell
npx jest --runInBand '__tests__/services/memory/memoryAuthority.test.ts'
npx tsc --noEmit
```

Expected: PASS. The resolver imports no React, hook, storage, Supabase, environment, or network module.

- [ ] **Step 7: Run two independent sabotages**

First remove `flags.cloudProjectionBuild` from the SHADOW condition. Run:

```powershell
npx jest --runInBand '__tests__/services/memory/memoryAuthority.test.ts'
```

Expected: FAIL in the exhaustive SHADOW matrix. Restore the condition and confirm PASS.

Then change the CLOUD condition from:

```ts
flags.cloudReadAuthority && flags.cloudWriteAuthority
```

to:

```ts
flags.cloudReadAuthority || flags.cloudWriteAuthority
```

Run:

```powershell
npx jest --runInBand '__tests__/services/memory/memoryAuthority.test.ts'
```

Expected: FAIL in the exhaustive CLOUD matrix. Restore `&&` and confirm PASS.

- [ ] **Step 8: Commit**

```powershell
git add -- 'services/memory/cloud/memoryAuthority.ts' '__tests__/services/memory/memoryAuthority.test.ts'
git commit -m "feat(memory): derive runtime route from bound owner state"
```

---

### Task 3: Portable PostgreSQL Schema, Supabase Overlay, and Atomic RPCs

**Files:**
- Create: `backend/sql/migrations/0001_memory_foundation.sql`
- Create: `backend/sql/overlays/supabase/0001_memory_foundation.sql`
- Create: `scripts/build-cloud-memory-migration.mjs`
- Generate: `supabase/migrations/20260728144157_cloud_memory_foundation_20260728112723.sql`
- Create: `supabase/config.toml` only if absent
- Create: `supabase/.gitignore` only when generated by `supabase init`; retain its `.branches`, `.temp`, and local dotenv exclusions so runtime state cannot be committed
- Test: `__tests__/services/cloudMemoryMigrationContract.test.ts`
- Test: `supabase/tests/cloud_memory_foundation.test.sql` (focused Task 3 fence, shape, idempotency, ACL, and lease subset; Task 4 extends this same file)

**Interfaces:**
- Produces tables: `memory_deployment_authority`, `memory_owner_state`, `memory_source_watermarks`, `memory_deletion_ledger`, `memory_conversations`, `memory_messages`, `memory_message_revisions`, `memory_evidence_spans`, `memory_import_manifests`, `memory_import_chunks`, `memory_jobs`, `memory_job_attempts`, `turn_traces`.
- Produces atomic RPCs: `memory_begin_import`, `memory_accept_import_chunk`, `memory_record_deletion`, `memory_enqueue_job`, `memory_claim_jobs`, `memory_finish_job`, `memory_get_bootstrap`, `memory_get_owner_state`, `memory_get_source_inventory`.
- Every mutating RPC begins with `p_deployment_id text, p_writer_epoch bigint, p_writer_lease_id uuid, p_writer_lease_token text, p_source_credential_fingerprint text` and calls `memory_assert_writer` before any write.
- Every idempotent RPC returns the existing row only when the immutable request is content-equivalent. Reusing an identity with different content raises SQLSTATE `PT409` and message `MEMORY_IDEMPOTENCY_CONFLICT`.
- The writer epoch is an integer in `[1, 9007199254740991]` during Phase 0. The reviewed Task 1A correction to the shared structural preflight (`Number.isSafeInteger(value) && value >= 1`) is a hard prerequisite; the portability phase's decimal-string boundary remains the required long-term representation before epochs can exceed JavaScript's safe range.
- Runtime `service_role` receives no direct table DML. It can mutate only through the allowlisted `SECURITY DEFINER` RPCs. Authority provisioning in tests uses the local PostgreSQL administrator, never the runtime key.
- This task must preserve the historical byte-empty `supabase/migrations/20260728112723_cloud_memory_foundation.sql` and may populate only the new `supabase/migrations/20260728144157_cloud_memory_foundation_20260728112723.sql`. It must prove `202601240001_init.sql`, `20260728112723_cloud_memory_foundation.sql`, `20260728120938_memory_portability_authority.sql`, `20260728123338_memory_writer_authority.sql`, and `20260728123342_memory_backup_schedule.sql` are byte-unchanged.

- [ ] **Step 1: Verify the reviewed Task 1A writer-epoch prerequisite**

Confirm `shared/memory/deploymentAuthority.ts` already contains:

```ts
function isWriterEpoch(value: unknown): value is number {
  return typeof value === 'number'
    && Number.isSafeInteger(value)
    && value >= 1;
}
```

Confirm `backend/src/__tests__/deploymentAuthority.test.ts` rejects `0`, negative, fractional, `NaN`, and infinity for both stored and requested epochs. Run:

```powershell
npm --prefix backend test -- --testPathPattern=deploymentAuthority
```

Expected: PASS. If it fails or the exact safe-positive predicate is absent, stop Task 3 and finish/review Task 1A; do not modify the shared contract in this task.

- [ ] **Step 2: Initialize and start PostgreSQL 17 locally without touching hosted state**

Run only when `supabase/config.toml` is absent:

```powershell
if (-not (Test-Path -LiteralPath 'supabase/config.toml')) { npx supabase init }
```

Set the generated config to PostgreSQL 17:

```toml
[db]
major_version = 17
```

Make the installed Docker client visible, verify the daemon, and start the local Supabase stack:

```powershell
$env:Path = 'C:\Program Files\Docker\Docker\resources\bin;' + $env:Path
docker version
npx supabase start
```

Expected: local config exists, Docker reports both client and server, and the local stack starts. Do not run `supabase link`, `db push`, or `--linked`.

- [ ] **Step 3: Write the failing deterministic-generation/static contract test**

Create `__tests__/services/cloudMemoryMigrationContract.test.ts`:

```ts
import fs from 'fs';
import path from 'path';

const root = process.cwd();
const canonicalPath = path.join(root, 'backend/sql/migrations/0001_memory_foundation.sql');
const overlayPath = path.join(root, 'backend/sql/overlays/supabase/0001_memory_foundation.sql');
const generatedPath = path.join(
    root,
    'supabase/migrations/20260728144157_cloud_memory_foundation_20260728112723.sql',
);

describe('cloud memory migration contract', () => {
    it('is byte-generated exactly from canonical SQL and the Supabase overlay', () => {
        const canonical = fs.readFileSync(canonicalPath);
        const overlay = fs.readFileSync(overlayPath);
        const generated = fs.readFileSync(generatedPath);
        const header = Buffer.from(
            `-- GENERATED by scripts/build-cloud-memory-migration.mjs\n`
            + `-- Source: backend/sql/migrations/0001_memory_foundation.sql\n`
            + `-- Overlay: backend/sql/overlays/supabase/0001_memory_foundation.sql\n\n`,
            'utf8',
        );
        expect(generated.equals(Buffer.concat([
            header,
            canonical,
            Buffer.from('\n'),
            overlay,
        ]))).toBe(true);
    });

    it('keeps provider-specific primitives out of canonical SQL', () => {
        const sql = fs.readFileSync(canonicalPath, 'utf8').toLowerCase();
        expect(sql).not.toContain('auth.uid()');
        expect(sql).not.toMatch(/\b(service_role|authenticated|anon)\b/);
        expect(sql).toContain('memory_assert_writer');
        expect(sql).toContain('memory_begin_import');
        expect(sql).toContain('memory_accept_import_chunk');
        expect(sql).toContain('memory_record_deletion');
        expect(sql).toContain('memory_enqueue_job');
        expect(sql).toContain('memory_claim_jobs');
        expect(sql).toContain('memory_finish_job');
        expect(sql).toContain('for update skip locked');
        expect(sql).toContain('for share');
        expect(sql).toContain('is distinct from p_writer_epoch');
        expect(sql).toContain('is distinct from p_deployment_id');
        expect(sql).toContain('clock_timestamp()');
        expect(sql).not.toContain('jsonb_object_length');
        expect(sql).toContain('on delete set null (conversation_id)');
        expect(sql).toContain('on delete set null (created_by_job_id)');
        for (const fn of [
            'memory_begin_import',
            'memory_accept_import_chunk',
            'memory_record_deletion',
            'memory_enqueue_job',
            'memory_claim_jobs',
            'memory_finish_job',
        ]) {
            const match = new RegExp(
                `create or replace function public\\.${fn}\\([\\s\\S]*?as \\$\\$([\\s\\S]*?)\\$\\$;`,
            ).exec(sql);
            expect(match?.[1]).toContain('perform public.memory_assert_writer(');
        }
    });

    it('keeps every memory function service-only in the Supabase overlay', () => {
        const sql = fs.readFileSync(overlayPath, 'utf8').toLowerCase();
        for (const fn of [
            'memory_begin_import',
            'memory_accept_import_chunk',
            'memory_record_deletion',
            'memory_enqueue_job',
            'memory_claim_jobs',
            'memory_finish_job',
            'memory_get_bootstrap',
            'memory_get_owner_state',
            'memory_get_source_inventory',
        ]) {
            expect(sql).toContain(`revoke all on function public.${fn}`);
            expect(sql).toContain(`grant execute on function public.${fn}`);
        }
        expect(sql).not.toMatch(/grant\s+execute[\s\S]*\bto\s+(anon|authenticated)\b/);
        expect(sql).not.toMatch(/grant\s+all\s+on\s+table[\s\S]*\bto\s+service_role\b/);
    });
});
```

- [ ] **Step 4: Write the focused real PostgreSQL tests before the schema**

Create `supabase/tests/cloud_memory_foundation.test.sql` with `begin`, `extensions.pgtap`, `no_plan()`, `finish()`, and `rollback`. Before Task 4 expands it, this focused Task 3 suite must contain exact assertions for:

```sql
select has_table('public', 'memory_deployment_authority', 'deployment authority exists');
select has_table('public', 'memory_jobs', 'job table exists');
select has_function(
  'public', 'memory_assert_writer',
  array['text', 'bigint', 'uuid', 'text', 'text'],
  'writer assertion has the fenced signature'
);

select throws_ok(
  $$insert into public.memory_owner_state (owner_id, feature_flags)
    values (
      '00000000-0000-4000-8000-00000000000a',
      '{"cloudSourceMirroring":false}'::jsonb
    )$$,
  '23514',
  null,
  'missing feature-flag keys are rejected'
);
select throws_ok(
  $$insert into public.memory_owner_state (owner_id, feature_flags)
    values (
      '00000000-0000-4000-8000-00000000000a',
      '{
        "cloudSourceMirroring":false,
        "cloudProjectionBuild":false,
        "shadowRetrieval":false,
        "cloudReadAuthority":false,
        "cloudWriteAuthority":false,
        "unexpected":true
      }'::jsonb
    )$$,
  '23514',
  null,
  'extra feature-flag keys are rejected'
);

update public.memory_deployment_authority
set
  mode = 'active',
  writer_lease_id = '00000000-0000-4000-8000-000000000077',
  writer_lease_token_digest = encode(
    sha256(convert_to('local-test-writer-token', 'UTF8')),
    'hex'
  ),
  writer_lease_expires_at = clock_timestamp() + interval '1 hour',
  writer_lease_issuer = 'phase0-pgtap',
  writer_lease_key_id = 'phase0-test-key',
  source_credential_fingerprint = 'sha256:local-source'
where singleton;

select throws_ok(
  $$select public.memory_assert_writer(
    null, 1, '00000000-0000-4000-8000-000000000077',
    'local-test-writer-token', 'sha256:local-source'
  )$$,
  'P0001',
  'MEMORY_DEPLOYMENT_MISMATCH',
  'null deployment cannot bypass the fence'
);
select throws_ok(
  $$select public.memory_assert_writer(
    'blackrose-primary', null, '00000000-0000-4000-8000-000000000077',
    'local-test-writer-token', 'sha256:local-source'
  )$$,
  'P0001',
  'MEMORY_STALE_WRITER_EPOCH',
  'null epoch cannot bypass the fence'
);
select throws_ok(
  $$select public.memory_assert_writer(
    'blackrose-primary', 0, '00000000-0000-4000-8000-000000000077',
    'local-test-writer-token', 'sha256:local-source'
  )$$,
  'P0001',
  'MEMORY_STALE_WRITER_EPOCH',
  'stale epoch is rejected'
);
```

The same focused file must:

- enqueue the same job twice with identical JSON and assert the same `id`;
- enqueue the same identity with different JSON and expect `PT409` / `MEMORY_IDEMPOTENCY_CONFLICT`;
- begin the same manifest twice identically, then reject a changed count/hash;
- accept the same chunk twice identically, then reject changed hash, item count, source kind, sequence, event ID, or observation time;
- prove an equal watermark sequence with a different event ID raises `PT409` / `MEMORY_SOURCE_WATERMARK_CONFLICT`;
- record the same deletion twice identically, then reject changed tombstone content;
- prove a deletion creates exactly one pending ledger row and one `verify_deletion` job;
- claim a job, expire that job lease, and prove the expired token cannot finish;
- prove `PUBLIC`, `anon`, and `authenticated` cannot execute mutators;
- prove `service_role` can execute allowlisted RPCs but has no direct `INSERT`, `UPDATE`, or `DELETE` privilege on memory tables;
- inspect `pg_constraint` so every cross-record memory FK includes `owner_id`, and prove a cross-owner message/conversation link fails;
- inspect `pg_indexes` for the global ready and expired-lease claim indexes.

- [ ] **Step 5: Run both red families**

```powershell
npx jest --runInBand __tests__/services/cloudMemoryMigrationContract.test.ts
npx supabase db reset --local --no-seed
npx supabase test db supabase/tests/cloud_memory_foundation.test.sql --local
```

Expected: the Jest test FAILS because canonical SQL, overlay SQL, and generator do not exist. The local reset/test FAILS because the Task 3 schema and functions do not exist.

- [ ] **Step 6: Create the canonical schema**

Create `backend/sql/migrations/0001_memory_foundation.sql` with the following complete schema. Keep the function signatures unchanged because Tasks 4–7 call them directly.

```sql
create table public.memory_deployment_authority (
  singleton boolean primary key default true check (singleton),
  deployment_id text not null
    check (deployment_id ~ '^[A-Za-z0-9][A-Za-z0-9._-]*$'),
  writer_epoch bigint not null
    check (writer_epoch between 1 and 9007199254740991),
  mode text not null check (mode in ('active', 'maintenance', 'read_only', 'retired')),
  backend_base_url text,
  database_fingerprint text not null
    check (database_fingerprint ~ '^sha256:[A-Za-z0-9][A-Za-z0-9._-]*$'),
  writer_lease_id uuid,
  writer_lease_token_digest text
    check (
      writer_lease_token_digest is null
      or writer_lease_token_digest ~ '^[0-9a-f]{64}$'
    ),
  writer_lease_expires_at timestamptz,
  writer_lease_issuer text
    check (
      writer_lease_issuer is null
      or writer_lease_issuer ~ '^[A-Za-z0-9][A-Za-z0-9._-]*$'
    ),
  writer_lease_key_id text
    check (
      writer_lease_key_id is null
      or writer_lease_key_id ~ '^[A-Za-z0-9][A-Za-z0-9._-]*$'
    ),
  source_credential_fingerprint text
    check (
      source_credential_fingerprint is null
      or source_credential_fingerprint
        ~ '^sha256:[A-Za-z0-9][A-Za-z0-9._-]*$'
    ),
  changed_at timestamptz not null default now(),
  change_reason text not null check (btrim(change_reason) <> ''),
  check (
    mode <> 'active'
    or (
      writer_lease_id is not null
      and writer_lease_token_digest is not null
      and writer_lease_expires_at is not null
      and writer_lease_issuer is not null
      and writer_lease_key_id is not null
      and source_credential_fingerprint is not null
    )
  )
);

insert into public.memory_deployment_authority (
  singleton, deployment_id, writer_epoch, mode, database_fingerprint, change_reason
  ) values (
  true, 'blackrose-primary', 1, 'maintenance',
  'sha256:phase0-unprovisioned',
  'phase-0 bootstrap; replace fingerprint before hosted writes'
);

create table public.memory_owner_state (
  owner_id uuid primary key,
  authority_state text not null default 'LOCAL'
    check (authority_state in ('LOCAL', 'MIRROR', 'SHADOW', 'CLOUD')),
  authority_version bigint not null default 1
    check (authority_version between 1 and 9007199254740991),
  feature_flags jsonb not null default '{
    "cloudSourceMirroring": false,
    "cloudProjectionBuild": false,
    "shadowRetrieval": false,
    "cloudReadAuthority": false,
    "cloudWriteAuthority": false
  }'::jsonb,
  observation_started_at timestamptz,
  updated_at timestamptz not null default now(),
  check (
    jsonb_typeof(feature_flags) = 'object'
    and feature_flags ?& array[
      'cloudSourceMirroring',
      'cloudProjectionBuild',
      'shadowRetrieval',
      'cloudReadAuthority',
      'cloudWriteAuthority'
    ]::text[]
    and (
      feature_flags - array[
        'cloudSourceMirroring',
        'cloudProjectionBuild',
        'shadowRetrieval',
        'cloudReadAuthority',
        'cloudWriteAuthority'
      ]::text[]
    ) = '{}'::jsonb
    and jsonb_typeof(feature_flags->'cloudSourceMirroring') = 'boolean'
    and jsonb_typeof(feature_flags->'cloudProjectionBuild') = 'boolean'
    and jsonb_typeof(feature_flags->'shadowRetrieval') = 'boolean'
    and jsonb_typeof(feature_flags->'cloudReadAuthority') = 'boolean'
    and jsonb_typeof(feature_flags->'cloudWriteAuthority') = 'boolean'
  )
);

create table public.memory_source_watermarks (
  owner_id uuid not null,
  source_kind text not null
    check (source_kind in ('journal', 'freeform_chat', 'intention_checkin')),
  highest_client_sequence bigint not null default 0 check (highest_client_sequence >= 0),
  highest_client_event_id text,
  observed_at timestamptz not null,
  updated_at timestamptz not null default now(),
  primary key (owner_id, source_kind)
);

create table public.memory_deletion_ledger (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null,
  source_kind text not null
    check (source_kind in ('journal', 'freeform_chat', 'intention_checkin')),
  source_id text not null,
  source_revision integer not null check (source_revision > 0),
  client_event_id text not null,
  deleted_at timestamptz not null,
  reason_code text not null,
  verification_status text not null default 'pending'
    check (verification_status in ('pending', 'verified', 'failed')),
  verified_at timestamptz,
  created_at timestamptz not null default now(),
  unique (owner_id, client_event_id),
  unique (owner_id, source_kind, source_id, source_revision),
  check (
    (verification_status = 'verified' and verified_at is not null)
    or (verification_status <> 'verified' and verified_at is null)
  )
);

create table public.memory_conversations (
  id text not null,
  owner_id uuid not null,
  source_kind text not null
    check (source_kind in ('journal', 'freeform_chat', 'intention_checkin')),
  source_record_id text not null,
  status text not null check (status in ('draft', 'active', 'settled', 'deleted')),
  started_at timestamptz not null,
  settled_at timestamptz,
  timezone text,
  week_starts_on smallint check (week_starts_on in (0, 1)),
  temporal_provenance text not null
    check (temporal_provenance in ('captured', 'legacy_unknown')),
  client_schema_version integer not null check (client_schema_version > 0),
  source_hash text,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (owner_id, id),
  unique (owner_id, source_kind, source_record_id),
  check (
    temporal_provenance = 'captured'
    or (timezone is null and week_starts_on is null and settled_at is null)
  )
);

create table public.memory_messages (
  id text not null,
  owner_id uuid not null,
  conversation_id text not null,
  client_event_id text not null,
  role text not null check (role in ('user', 'assistant', 'system', 'tool')),
  sequence integer not null check (sequence >= 0),
  authored_at timestamptz not null,
  authored_timezone text,
  local_date date,
  temporal_provenance text not null
    check (temporal_provenance in ('captured', 'legacy_unknown')),
  content text not null,
  content_hash text,
  revision integer not null default 1 check (revision > 0),
  status text not null default 'active'
    check (status in ('active', 'edited', 'deleted')),
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (owner_id, id),
  unique (owner_id, client_event_id),
  unique (owner_id, conversation_id, sequence),
  foreign key (owner_id, conversation_id)
    references public.memory_conversations (owner_id, id) on delete cascade,
  check (
    temporal_provenance = 'captured'
    or (authored_timezone is null and local_date is null)
  )
);

create table public.memory_message_revisions (
  id bigint generated always as identity primary key,
  owner_id uuid not null,
  message_id text not null,
  revision integer not null check (revision > 0),
  content text not null,
  content_hash text,
  authored_at timestamptz not null,
  authored_timezone text,
  local_date date,
  temporal_provenance text not null
    check (temporal_provenance in ('captured', 'legacy_unknown')),
  lifecycle_reason text not null,
  eligibility text not null
    check (eligibility in ('eligible', 'withheld', 'deleted', 'expired')),
  created_at timestamptz not null default now(),
  unique (owner_id, id),
  unique (owner_id, message_id, revision),
  foreign key (owner_id, message_id)
    references public.memory_messages (owner_id, id) on delete cascade
);

create table public.memory_jobs (
  id bigint generated always as identity primary key,
  owner_id uuid not null,
  job_type text not null check (job_type in (
    'capture_source',
    'extract_turn_candidates',
    'checkpoint_conversation',
    'curate_session',
    'reconcile_entities',
    'reconcile_claims',
    'audit_epistemic_authorization',
    'audit_supersession_chains',
    'build_temporal_digest',
    'build_current_life_snapshot',
    'build_profile_tree',
    'build_search_document',
    'embed_search_document',
    'observe_interaction_outcome',
    'review_pattern_hypotheses',
    'scan_cross_domain_collisions',
    'rebuild_personalized_promotion_policy',
    'refresh_external_fact_snapshot',
    'cascade_source_invalidation',
    'verify_deletion',
    'compare_shadow_retrieval',
    'rebuild_projection_version'
  )),
  idempotency_key text not null,
  source_version text not null,
  payload_reference jsonb not null default '{}'::jsonb
    check (jsonb_typeof(payload_reference) = 'object'),
  status text not null default 'queued'
    check (status in ('queued', 'leased', 'succeeded', 'retryable', 'dead_letter', 'cancelled')),
  priority smallint not null default 0,
  attempt_count integer not null default 0 check (attempt_count >= 0),
  max_attempts integer not null default 5 check (max_attempts > 0),
  available_at timestamptz not null default now(),
  lease_started_at timestamptz,
  lease_expires_at timestamptz,
  worker_id text,
  lease_token uuid,
  last_error_code text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz,
  unique (owner_id, id),
  unique (owner_id, job_type, idempotency_key, source_version),
  check (
    status <> 'leased'
    or (
      worker_id is not null
      and worker_id <> ''
      and lease_token is not null
      and lease_started_at is not null
      and lease_expires_at is not null
      and lease_expires_at > lease_started_at
    )
  )
);

create table public.memory_evidence_spans (
  id bigint generated always as identity primary key,
  owner_id uuid not null,
  message_revision_id bigint not null,
  start_offset integer not null check (start_offset >= 0),
  end_offset integer not null check (end_offset > start_offset),
  span_hash text not null,
  evidence_kind text not null,
  eligibility text not null
    check (eligibility in ('eligible', 'withheld', 'deleted', 'expired')),
  created_by_job_id bigint,
  created_at timestamptz not null default now(),
  unique (owner_id, id),
  unique (owner_id, message_revision_id, start_offset, end_offset),
  foreign key (owner_id, message_revision_id)
    references public.memory_message_revisions (owner_id, id) on delete cascade,
  foreign key (owner_id, created_by_job_id)
    references public.memory_jobs (owner_id, id)
    on delete set null (created_by_job_id)
);

create table public.memory_job_attempts (
  id bigint generated always as identity primary key,
  owner_id uuid not null,
  job_id bigint not null,
  attempt_number integer not null check (attempt_number > 0),
  lease_token uuid not null,
  worker_id text not null,
  provider text,
  model text,
  token_usage jsonb not null default '{}'::jsonb
    check (jsonb_typeof(token_usage) = 'object'),
  status_code integer,
  schema_version integer not null check (schema_version > 0),
  started_at timestamptz not null,
  finished_at timestamptz not null,
  outcome text not null
    check (outcome in ('succeeded', 'retryable', 'dead_letter', 'cancelled')),
  error_code text,
  redacted_diagnostics jsonb not null default '{}'::jsonb
    check (jsonb_typeof(redacted_diagnostics) = 'object'),
  duration_ms integer not null check (duration_ms >= 0),
  unique (owner_id, job_id, attempt_number),
  foreign key (owner_id, job_id)
    references public.memory_jobs (owner_id, id) on delete cascade
);

create table public.memory_import_manifests (
  id text not null,
  owner_id uuid not null,
  contract_version integer not null check (contract_version > 0),
  source_count integer not null check (source_count >= 0),
  message_count integer not null check (message_count >= 0),
  source_hash text,
  status text not null
    check (status in ('created', 'uploading', 'verified', 'failed', 'cancelled')),
  created_at timestamptz not null default now(),
  verified_at timestamptz,
  primary key (owner_id, id)
);

create table public.memory_import_chunks (
  id bigint generated always as identity primary key,
  owner_id uuid not null,
  manifest_id text not null,
  chunk_index integer not null check (chunk_index >= 0),
  idempotency_key text not null,
  item_count integer not null check (item_count >= 0),
  chunk_hash text not null,
  source_kind text not null
    check (source_kind in ('journal', 'freeform_chat', 'intention_checkin')),
  highest_client_sequence bigint not null check (highest_client_sequence >= 0),
  highest_client_event_id text,
  observed_at timestamptz not null,
  status text not null check (status in ('accepted', 'verified', 'failed')),
  accepted_at timestamptz not null default now(),
  unique (owner_id, id),
  unique (owner_id, manifest_id, chunk_index),
  unique (owner_id, idempotency_key),
  foreign key (owner_id, manifest_id)
    references public.memory_import_manifests (owner_id, id) on delete cascade
);

create table public.turn_traces (
  id text not null,
  owner_id uuid not null,
  conversation_id text,
  authority_state text not null
    check (authority_state in ('LOCAL', 'MIRROR', 'SHADOW', 'CLOUD')),
  source_turn_ids jsonb not null default '[]'::jsonb,
  route text not null,
  reason_codes jsonb not null default '[]'::jsonb,
  status text not null,
  model_versions jsonb not null default '{}'::jsonb,
  prompt_versions jsonb not null default '{}'::jsonb,
  retrieval_evidence_ids jsonb not null default '[]'::jsonb,
  target_count integer not null default 0 check (target_count >= 0),
  covered_target_count integer not null default 0 check (covered_target_count >= 0),
  expansion_cycles integer not null default 0 check (expansion_cycles >= 0),
  stop_reason text,
  token_usage jsonb not null default '{}'::jsonb,
  latency_ms jsonb not null default '{}'::jsonb,
  cost_microusd bigint not null default 0 check (cost_microusd >= 0),
  response_hash text,
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  primary key (owner_id, id),
  foreign key (owner_id, conversation_id)
    references public.memory_conversations (owner_id, id)
    on delete set null (conversation_id)
);

create index memory_conversations_owner_started_idx
  on public.memory_conversations (owner_id, started_at desc);
create index memory_source_watermarks_owner_updated_idx
  on public.memory_source_watermarks (owner_id, updated_at desc);
create index memory_deletion_ledger_owner_deleted_idx
  on public.memory_deletion_ledger (owner_id, deleted_at desc);
create index memory_deletion_pending_idx
  on public.memory_deletion_ledger (created_at, id)
  where verification_status = 'pending';
create index memory_messages_owner_authored_idx
  on public.memory_messages (owner_id, authored_at);
create index memory_jobs_claim_ready_idx
  on public.memory_jobs (priority desc, available_at, created_at, id)
  where status in ('queued', 'retryable');
create index memory_jobs_claim_expired_idx
  on public.memory_jobs (lease_expires_at, priority desc, available_at, created_at, id)
  where status = 'leased';
create index memory_import_manifests_owner_created_idx
  on public.memory_import_manifests (owner_id, created_at desc);
create index turn_traces_owner_created_idx
  on public.turn_traces (owner_id, created_at desc);

create or replace function public.memory_assert_writer(
  p_deployment_id text,
  p_writer_epoch bigint,
  p_writer_lease_id uuid,
  p_writer_lease_token text,
  p_source_credential_fingerprint text
) returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  authority public.memory_deployment_authority%rowtype;
begin
  select * into authority
  from public.memory_deployment_authority
  where singleton = true
  for share;
  if not found then
    raise exception using errcode = 'P0001', message = 'MEMORY_AUTHORITY_UNAVAILABLE';
  end if;
  if authority.mode <> 'active' then
    raise exception using errcode = 'P0001', message = 'MEMORY_WRITES_DISABLED';
  end if;
  if authority.deployment_id is distinct from p_deployment_id then
    raise exception using errcode = 'P0001', message = 'MEMORY_DEPLOYMENT_MISMATCH';
  end if;
  if authority.writer_epoch is distinct from p_writer_epoch then
    raise exception using errcode = 'P0001', message = 'MEMORY_STALE_WRITER_EPOCH';
  end if;
  if authority.writer_lease_id is distinct from p_writer_lease_id then
    raise exception using errcode = 'P0001', message = 'MEMORY_WRITER_LEASE_MISMATCH';
  end if;
  if authority.writer_lease_expires_at is null
      or authority.writer_lease_expires_at <= clock_timestamp() then
    raise exception using errcode = 'P0001', message = 'MEMORY_WRITER_LEASE_EXPIRED';
  end if;
  if p_writer_lease_token is null or btrim(p_writer_lease_token) = '' then
    raise exception using errcode = 'P0001', message = 'MEMORY_WRITER_LEASE_TOKEN_INVALID';
  end if;
  if authority.writer_lease_token_digest is distinct from encode(
    sha256(convert_to(p_writer_lease_token, 'UTF8')),
    'hex'
  ) then
    raise exception using errcode = 'P0001', message = 'MEMORY_WRITER_LEASE_TOKEN_INVALID';
  end if;
  if authority.source_credential_fingerprint
      is distinct from p_source_credential_fingerprint then
    raise exception using errcode = 'P0001', message = 'MEMORY_SOURCE_CREDENTIAL_MISMATCH';
  end if;
end;
$$;

create or replace function public.memory_enqueue_job(
  p_deployment_id text,
  p_writer_epoch bigint,
  p_writer_lease_id uuid,
  p_writer_lease_token text,
  p_source_credential_fingerprint text,
  p_owner_id uuid,
  p_job_type text,
  p_idempotency_key text,
  p_source_version text,
  p_payload_reference jsonb,
  p_priority smallint default 0,
  p_max_attempts integer default 5
) returns public.memory_jobs
language plpgsql
security definer
set search_path = ''
as $$
declare result public.memory_jobs%rowtype;
begin
  perform public.memory_assert_writer(
    p_deployment_id, p_writer_epoch, p_writer_lease_id,
    p_writer_lease_token, p_source_credential_fingerprint
  );
  insert into public.memory_jobs (
    owner_id, job_type, idempotency_key, source_version,
    payload_reference, priority, max_attempts
  ) values (
    p_owner_id, p_job_type, p_idempotency_key, p_source_version,
    coalesce(p_payload_reference, '{}'::jsonb),
    coalesce(p_priority, 0),
    coalesce(p_max_attempts, 5)
  )
  on conflict (owner_id, job_type, idempotency_key, source_version)
  do nothing
  returning * into result;

  if not found then
    select * into result
    from public.memory_jobs
    where owner_id = p_owner_id
      and job_type = p_job_type
      and idempotency_key = p_idempotency_key
      and source_version = p_source_version
    for update;
    if not found
        or result.payload_reference
          is distinct from coalesce(p_payload_reference, '{}'::jsonb)
        or result.priority is distinct from coalesce(p_priority, 0)
        or result.max_attempts is distinct from coalesce(p_max_attempts, 5) then
      raise exception using
        errcode = 'PT409',
        message = 'MEMORY_IDEMPOTENCY_CONFLICT';
    end if;
  end if;
  return result;
end;
$$;

create or replace function public.memory_claim_jobs(
  p_deployment_id text,
  p_writer_epoch bigint,
  p_writer_lease_id uuid,
  p_writer_lease_token text,
  p_source_credential_fingerprint text,
  p_worker_id text,
  p_limit integer default 10,
  p_lease_seconds integer default 60
) returns setof public.memory_jobs
language plpgsql
security definer
set search_path = ''
as $$
declare exhausted public.memory_jobs%rowtype;
begin
  perform public.memory_assert_writer(
    p_deployment_id, p_writer_epoch, p_writer_lease_id,
    p_writer_lease_token, p_source_credential_fingerprint
  );
  if p_worker_id is null or btrim(p_worker_id) = '' then
    raise exception using errcode = '22023', message = 'MEMORY_WORKER_ID_INVALID';
  end if;

  for exhausted in
    select *
    from public.memory_jobs
    where status in ('queued', 'retryable', 'leased')
      and attempt_count >= max_attempts
      and (
        status <> 'leased'
        or lease_expires_at <= clock_timestamp()
      )
    for update skip locked
  loop
    if exhausted.status = 'leased' then
      insert into public.memory_job_attempts (
        owner_id, job_id, attempt_number, lease_token, worker_id,
        token_usage, schema_version, started_at, finished_at, outcome,
        error_code, redacted_diagnostics, duration_ms
      ) values (
        exhausted.owner_id, exhausted.id, exhausted.attempt_count,
        exhausted.lease_token, exhausted.worker_id, '{}'::jsonb, 1,
        exhausted.lease_started_at, clock_timestamp(), 'dead_letter',
        'JOB_LEASE_EXPIRED', '{}'::jsonb,
        least(
          2147483647,
          greatest(
            0,
            floor(extract(epoch from (
              clock_timestamp() - exhausted.lease_started_at
            )) * 1000)
          )
        )::integer
      )
      on conflict (owner_id, job_id, attempt_number) do nothing;
    end if;
    update public.memory_jobs
    set status = 'dead_letter',
        completed_at = clock_timestamp(),
        updated_at = clock_timestamp(),
        last_error_code = coalesce(last_error_code, 'MAX_ATTEMPTS_EXHAUSTED'),
        worker_id = null,
        lease_token = null,
        lease_started_at = null,
        lease_expires_at = null
    where id = exhausted.id;
  end loop;

  return query
  with candidates as materialized (
    select job.*
    from public.memory_jobs as job
    where (
      job.status in ('queued', 'retryable')
      or (
        job.status = 'leased'
        and job.lease_expires_at <= clock_timestamp()
      )
    )
      and job.available_at <= clock_timestamp()
      and job.attempt_count < job.max_attempts
    order by job.priority desc, job.available_at, job.created_at
    limit greatest(1, least(coalesce(p_limit, 10), 50))
    for update skip locked
  ),
  expired_attempts as (
    insert into public.memory_job_attempts (
      owner_id, job_id, attempt_number, lease_token, worker_id,
      token_usage, schema_version, started_at, finished_at, outcome,
      error_code, redacted_diagnostics, duration_ms
    )
    select
      owner_id, id, attempt_count, lease_token, worker_id,
      '{}'::jsonb, 1, lease_started_at, clock_timestamp(), 'retryable',
      'JOB_LEASE_EXPIRED', '{}'::jsonb,
      least(
        2147483647,
        greatest(
          0,
          floor(extract(epoch from (
            clock_timestamp() - lease_started_at
          )) * 1000)
        )
      )::integer
    from candidates
    where status = 'leased'
    on conflict (owner_id, job_id, attempt_number) do nothing
    returning job_id
  ),
  expired_attempt_count as (
    select count(*) from expired_attempts
  )
  update public.memory_jobs as job
  set status = 'leased',
      worker_id = p_worker_id,
      lease_token = gen_random_uuid(),
      lease_started_at = clock_timestamp(),
      lease_expires_at = clock_timestamp() + make_interval(
        secs => greatest(15, least(coalesce(p_lease_seconds, 60), 900))
      ),
      attempt_count = job.attempt_count + 1,
      updated_at = clock_timestamp()
  from candidates, expired_attempt_count
  where job.id = candidates.id
  returning job.*;
end;
$$;

create or replace function public.memory_finish_job(
  p_deployment_id text,
  p_writer_epoch bigint,
  p_writer_lease_id uuid,
  p_writer_lease_token text,
  p_source_credential_fingerprint text,
  p_job_id bigint,
  p_worker_id text,
  p_lease_token uuid,
  p_outcome text,
  p_error_code text default null,
  p_retry_delay_seconds integer default 15,
  p_provider text default null,
  p_model text default null,
  p_token_usage jsonb default '{}'::jsonb,
  p_status_code integer default null,
  p_schema_version integer default 1,
  p_started_at timestamptz default now(),
  p_redacted_diagnostics jsonb default '{}'::jsonb
) returns public.memory_jobs
language plpgsql
security definer
set search_path = ''
as $$
declare
  job public.memory_jobs%rowtype;
  final_outcome text;
begin
  perform public.memory_assert_writer(
    p_deployment_id, p_writer_epoch, p_writer_lease_id,
    p_writer_lease_token, p_source_credential_fingerprint
  );
  if p_outcome not in ('succeeded', 'retryable', 'dead_letter', 'cancelled') then
    raise exception using errcode = '22023', message = 'MEMORY_INVALID_JOB_OUTCOME';
  end if;

  select * into job
  from public.memory_jobs
  where id = p_job_id
    and status = 'leased'
    and worker_id = p_worker_id
    and lease_token = p_lease_token
    and lease_expires_at > clock_timestamp()
  for update;
  if not found then
    raise exception using errcode = 'P0001', message = 'MEMORY_STALE_JOB_LEASE';
  end if;

  final_outcome := case
    when p_outcome = 'retryable' and job.attempt_count >= job.max_attempts then 'dead_letter'
    else p_outcome
  end;

  insert into public.memory_job_attempts (
    owner_id, job_id, attempt_number, lease_token, worker_id,
    provider, model, token_usage, status_code, schema_version,
    started_at, finished_at, outcome, error_code,
    redacted_diagnostics, duration_ms
  ) values (
    job.owner_id, job.id, job.attempt_count, p_lease_token, p_worker_id,
    p_provider, p_model, coalesce(p_token_usage, '{}'::jsonb), p_status_code,
    p_schema_version, job.lease_started_at, clock_timestamp(),
    final_outcome, p_error_code,
    coalesce(p_redacted_diagnostics, '{}'::jsonb),
    least(
      2147483647,
      greatest(
        0,
        floor(extract(epoch from (
          clock_timestamp() - job.lease_started_at
        )) * 1000)
      )
    )::integer
  );

  update public.memory_jobs
  set status = final_outcome,
      available_at = case
        when final_outcome = 'retryable'
          then clock_timestamp() + make_interval(
            secs => greatest(
              15,
              least(coalesce(p_retry_delay_seconds, 15), 3600)
            )
          )
        else available_at
      end,
      completed_at = case
        when final_outcome in ('succeeded', 'dead_letter', 'cancelled')
          then clock_timestamp()
        else null
      end,
      last_error_code = p_error_code,
      worker_id = null,
      lease_token = null,
      lease_started_at = null,
      lease_expires_at = null,
      updated_at = clock_timestamp()
  where id = job.id
  returning * into job;
  return job;
end;
$$;

create or replace function public.memory_begin_import(
  p_deployment_id text,
  p_writer_epoch bigint,
  p_writer_lease_id uuid,
  p_writer_lease_token text,
  p_source_credential_fingerprint text,
  p_owner_id uuid,
  p_manifest_id text,
  p_contract_version integer,
  p_source_count integer,
  p_message_count integer,
  p_source_hash text
) returns public.memory_import_manifests
language plpgsql
security definer
set search_path = ''
as $$
declare result public.memory_import_manifests%rowtype;
begin
  perform public.memory_assert_writer(
    p_deployment_id, p_writer_epoch, p_writer_lease_id,
    p_writer_lease_token, p_source_credential_fingerprint
  );
  insert into public.memory_import_manifests (
    owner_id, id, contract_version, source_count, message_count, source_hash, status
  ) values (
    p_owner_id, p_manifest_id, p_contract_version,
    p_source_count, p_message_count, p_source_hash, 'created'
  )
  on conflict (owner_id, id)
  do nothing
  returning * into result;
  if not found then
    select * into result
    from public.memory_import_manifests
    where owner_id = p_owner_id and id = p_manifest_id
    for update;
    if not found
        or result.contract_version is distinct from p_contract_version
        or result.source_count is distinct from p_source_count
        or result.message_count is distinct from p_message_count
        or result.source_hash is distinct from p_source_hash then
      raise exception using
        errcode = 'PT409',
        message = 'MEMORY_IDEMPOTENCY_CONFLICT';
    end if;
  end if;
  return result;
end;
$$;

create or replace function public.memory_accept_import_chunk(
  p_deployment_id text,
  p_writer_epoch bigint,
  p_writer_lease_id uuid,
  p_writer_lease_token text,
  p_source_credential_fingerprint text,
  p_owner_id uuid,
  p_manifest_id text,
  p_chunk_index integer,
  p_idempotency_key text,
  p_item_count integer,
  p_chunk_hash text,
  p_highest_client_sequence bigint,
  p_highest_client_event_id text,
  p_source_kind text,
  p_observed_at timestamptz
) returns public.memory_import_chunks
language plpgsql
security definer
set search_path = ''
as $$
declare
  result public.memory_import_chunks%rowtype;
  watermark public.memory_source_watermarks%rowtype;
  matching_rows bigint;
  matching_id bigint;
begin
  perform public.memory_assert_writer(
    p_deployment_id, p_writer_epoch, p_writer_lease_id,
    p_writer_lease_token, p_source_credential_fingerprint
  );
  insert into public.memory_import_chunks (
    owner_id, manifest_id, chunk_index, idempotency_key,
    item_count, chunk_hash, source_kind, highest_client_sequence,
    highest_client_event_id, observed_at, status
  ) values (
    p_owner_id, p_manifest_id, p_chunk_index, p_idempotency_key,
    p_item_count, p_chunk_hash, p_source_kind, p_highest_client_sequence,
    p_highest_client_event_id, p_observed_at, 'accepted'
  )
  on conflict do nothing
  returning * into result;

  if not found then
    select count(*), min(id)
    into matching_rows, matching_id
    from public.memory_import_chunks
    where owner_id = p_owner_id
      and (
        idempotency_key = p_idempotency_key
        or (
          manifest_id = p_manifest_id
          and chunk_index = p_chunk_index
        )
      );
    if matching_rows <> 1 then
      raise exception using
        errcode = 'PT409',
        message = 'MEMORY_IDEMPOTENCY_CONFLICT';
    end if;
    select * into result
    from public.memory_import_chunks
    where owner_id = p_owner_id and id = matching_id
    for update;
    if result.manifest_id is distinct from p_manifest_id
        or result.chunk_index is distinct from p_chunk_index
        or result.idempotency_key is distinct from p_idempotency_key
        or result.item_count is distinct from p_item_count
        or result.chunk_hash is distinct from p_chunk_hash
        or result.source_kind is distinct from p_source_kind
        or result.highest_client_sequence
          is distinct from p_highest_client_sequence
        or result.highest_client_event_id
          is distinct from p_highest_client_event_id
        or result.observed_at is distinct from p_observed_at then
      raise exception using
        errcode = 'PT409',
        message = 'MEMORY_IDEMPOTENCY_CONFLICT';
    end if;
  end if;

  insert into public.memory_source_watermarks (
    owner_id, source_kind, highest_client_sequence,
    highest_client_event_id, observed_at
  ) values (
    result.owner_id, result.source_kind, result.highest_client_sequence,
    result.highest_client_event_id, result.observed_at
  )
  on conflict (owner_id, source_kind)
  do nothing
  returning * into watermark;
  if not found then
    select * into watermark
    from public.memory_source_watermarks
    where owner_id = result.owner_id
      and source_kind = result.source_kind
    for update;
    if result.highest_client_sequence = watermark.highest_client_sequence
        and result.highest_client_event_id
          is distinct from watermark.highest_client_event_id then
      raise exception using
        errcode = 'PT409',
        message = 'MEMORY_SOURCE_WATERMARK_CONFLICT';
    elsif result.highest_client_sequence > watermark.highest_client_sequence then
      update public.memory_source_watermarks
      set highest_client_sequence = result.highest_client_sequence,
          highest_client_event_id = result.highest_client_event_id,
          observed_at = result.observed_at,
          updated_at = clock_timestamp()
      where owner_id = result.owner_id
        and source_kind = result.source_kind;
    elsif result.highest_client_sequence = watermark.highest_client_sequence then
      update public.memory_source_watermarks
      set observed_at = greatest(observed_at, result.observed_at),
          updated_at = clock_timestamp()
      where owner_id = result.owner_id
        and source_kind = result.source_kind;
    end if;
  end if;
  return result;
end;
$$;

create or replace function public.memory_record_deletion(
  p_deployment_id text,
  p_writer_epoch bigint,
  p_writer_lease_id uuid,
  p_writer_lease_token text,
  p_source_credential_fingerprint text,
  p_owner_id uuid,
  p_source_kind text,
  p_source_id text,
  p_source_revision integer,
  p_client_event_id text,
  p_deleted_at timestamptz,
  p_reason_code text
) returns public.memory_deletion_ledger
language plpgsql
security definer
set search_path = ''
as $$
declare
  result public.memory_deletion_ledger%rowtype;
  matching_rows bigint;
begin
  perform public.memory_assert_writer(
    p_deployment_id, p_writer_epoch, p_writer_lease_id,
    p_writer_lease_token, p_source_credential_fingerprint
  );
  insert into public.memory_deletion_ledger (
    owner_id, source_kind, source_id, source_revision,
    client_event_id, deleted_at, reason_code
  ) values (
    p_owner_id, p_source_kind, p_source_id, p_source_revision,
    p_client_event_id, p_deleted_at, p_reason_code
  )
  on conflict do nothing
  returning * into result;
  if not found then
    select count(*) into matching_rows
    from public.memory_deletion_ledger
    where owner_id = p_owner_id
      and (
        client_event_id = p_client_event_id
        or (
          source_kind = p_source_kind
          and source_id = p_source_id
          and source_revision = p_source_revision
        )
      );
    if matching_rows <> 1 then
      raise exception using
        errcode = 'PT409',
        message = 'MEMORY_IDEMPOTENCY_CONFLICT';
    end if;
    select * into result
    from public.memory_deletion_ledger
    where owner_id = p_owner_id
      and (
        client_event_id = p_client_event_id
        or (
          source_kind = p_source_kind
          and source_id = p_source_id
          and source_revision = p_source_revision
        )
      )
    for update;
    if result.source_kind is distinct from p_source_kind
        or result.source_id is distinct from p_source_id
        or result.source_revision is distinct from p_source_revision
        or result.client_event_id is distinct from p_client_event_id
        or result.deleted_at is distinct from p_deleted_at
        or result.reason_code is distinct from p_reason_code then
      raise exception using
        errcode = 'PT409',
        message = 'MEMORY_IDEMPOTENCY_CONFLICT';
    end if;
  end if;

  perform public.memory_enqueue_job(
    p_deployment_id,
    p_writer_epoch,
    p_writer_lease_id,
    p_writer_lease_token,
    p_source_credential_fingerprint,
    p_owner_id,
    'verify_deletion',
    'deletion:' || p_client_event_id,
    p_source_revision::text,
    jsonb_build_object(
      'sourceKind', p_source_kind,
      'sourceId', p_source_id,
      'sourceRevision', p_source_revision,
      'deletionEventId', p_client_event_id
    ),
    10,
    5
  );
  return result;
end;
$$;

create or replace function public.memory_get_bootstrap()
returns table (
  deployment_id text,
  writer_epoch bigint,
  mode text,
  backend_base_url text,
  database_fingerprint text,
  writer_lease_id uuid,
  writer_lease_expires_at timestamptz,
  writer_lease_issuer text,
  writer_lease_key_id text,
  source_credential_fingerprint text
)
language sql
security definer
set search_path = ''
as $$
  select
    deployment_id, writer_epoch, mode, backend_base_url, database_fingerprint,
    writer_lease_id, writer_lease_expires_at,
    writer_lease_issuer, writer_lease_key_id, source_credential_fingerprint
  from public.memory_deployment_authority
  where singleton = true
$$;

create or replace function public.memory_get_owner_state(p_owner_id uuid)
returns setof public.memory_owner_state
language sql
security definer
set search_path = ''
as $$
  select * from public.memory_owner_state where owner_id = p_owner_id
$$;

create or replace function public.memory_get_source_inventory(p_owner_id uuid)
returns table (
  conversation_count bigint,
  message_count bigint,
  oldest_authored_at timestamptz,
  newest_authored_at timestamptz
)
language sql
security definer
set search_path = ''
as $$
  select
    (select count(*) from public.memory_conversations where owner_id = p_owner_id),
    (select count(*) from public.memory_messages where owner_id = p_owner_id),
    (select min(authored_at) from public.memory_messages where owner_id = p_owner_id),
    (select max(authored_at) from public.memory_messages where owner_id = p_owner_id)
$$;

-- Canonical PostgreSQL must never leave SECURITY DEFINER functions executable
-- by PUBLIC between the core migration and a provider overlay.
revoke all on function public.memory_assert_writer(text, bigint, uuid, text, text)
  from public;
revoke all on function public.memory_enqueue_job(
  text, bigint, uuid, text, text, uuid, text, text, text, jsonb, smallint, integer
) from public;
revoke all on function public.memory_claim_jobs(
  text, bigint, uuid, text, text, text, integer, integer
) from public;
revoke all on function public.memory_finish_job(
  text, bigint, uuid, text, text, bigint, text, uuid, text, text, integer,
  text, text, jsonb, integer, integer, timestamptz, jsonb
) from public;
revoke all on function public.memory_begin_import(
  text, bigint, uuid, text, text, uuid, text, integer, integer, integer, text
) from public;
revoke all on function public.memory_accept_import_chunk(
  text, bigint, uuid, text, text, uuid, text, integer, text, integer, text,
  bigint, text, text, timestamptz
) from public;
revoke all on function public.memory_record_deletion(
  text, bigint, uuid, text, text, uuid, text, text, integer, text,
  timestamptz, text
) from public;
revoke all on function public.memory_get_bootstrap() from public;
revoke all on function public.memory_get_owner_state(uuid) from public;
revoke all on function public.memory_get_source_inventory(uuid) from public;
```

- [ ] **Step 7: Create the Supabase overlay**

Create `backend/sql/overlays/supabase/0001_memory_foundation.sql`:

```sql
do $$
declare table_name text;
begin
  foreach table_name in array array[
    'memory_owner_state', 'memory_source_watermarks', 'memory_deletion_ledger',
    'memory_conversations', 'memory_messages',
    'memory_message_revisions', 'memory_evidence_spans',
    'memory_import_manifests', 'memory_import_chunks',
    'memory_jobs', 'memory_job_attempts', 'turn_traces'
  ]
  loop
    execute format('alter table public.%I enable row level security', table_name);
    execute format('alter table public.%I force row level security', table_name);
    execute format(
      'create policy %I on public.%I for all to authenticated '
      || 'using ((select auth.uid()) = owner_id) '
      || 'with check ((select auth.uid()) = owner_id)',
      table_name || '_owner_access',
      table_name
    );
  end loop;
end
$$;

alter table public.memory_deployment_authority enable row level security;
alter table public.memory_deployment_authority force row level security;

revoke all on table
  public.memory_deployment_authority,
  public.memory_owner_state,
  public.memory_source_watermarks,
  public.memory_deletion_ledger,
  public.memory_conversations,
  public.memory_messages,
  public.memory_message_revisions,
  public.memory_evidence_spans,
  public.memory_import_manifests,
  public.memory_import_chunks,
  public.memory_jobs,
  public.memory_job_attempts,
  public.turn_traces
from public, anon, authenticated, service_role;

grant select on table
  public.memory_owner_state,
  public.memory_source_watermarks,
  public.memory_deletion_ledger,
  public.memory_conversations,
  public.memory_messages
to authenticated;

revoke all on function public.memory_assert_writer(text, bigint, uuid, text, text)
  from public, anon, authenticated, service_role;
revoke all on function public.memory_enqueue_job(
  text, bigint, uuid, text, text, uuid, text, text, text, jsonb, smallint, integer
) from public, anon, authenticated;
revoke all on function public.memory_claim_jobs(
  text, bigint, uuid, text, text, text, integer, integer
)
  from public, anon, authenticated;
revoke all on function public.memory_finish_job(
  text, bigint, uuid, text, text, bigint, text, uuid, text, text, integer,
  text, text, jsonb, integer, integer, timestamptz, jsonb
) from public, anon, authenticated;
revoke all on function public.memory_begin_import(
  text, bigint, uuid, text, text, uuid, text, integer, integer, integer, text
) from public, anon, authenticated;
revoke all on function public.memory_accept_import_chunk(
  text, bigint, uuid, text, text, uuid, text, integer, text, integer, text,
  bigint, text, text, timestamptz
) from public, anon, authenticated;
revoke all on function public.memory_record_deletion(
  text, bigint, uuid, text, text, uuid, text, text, integer, text,
  timestamptz, text
) from public, anon, authenticated;
revoke all on function public.memory_get_bootstrap()
  from public, anon, authenticated;
revoke all on function public.memory_get_owner_state(uuid)
  from public, anon, authenticated;
revoke all on function public.memory_get_source_inventory(uuid)
  from public, anon, authenticated;

grant execute on function public.memory_enqueue_job(
  text, bigint, uuid, text, text, uuid, text, text, text, jsonb, smallint, integer
) to service_role;
grant execute on function public.memory_claim_jobs(
  text, bigint, uuid, text, text, text, integer, integer
)
  to service_role;
grant execute on function public.memory_finish_job(
  text, bigint, uuid, text, text, bigint, text, uuid, text, text, integer,
  text, text, jsonb, integer, integer, timestamptz, jsonb
) to service_role;
grant execute on function public.memory_begin_import(
  text, bigint, uuid, text, text, uuid, text, integer, integer, integer, text
) to service_role;
grant execute on function public.memory_accept_import_chunk(
  text, bigint, uuid, text, text, uuid, text, integer, text, integer, text,
  bigint, text, text, timestamptz
) to service_role;
grant execute on function public.memory_record_deletion(
  text, bigint, uuid, text, text, uuid, text, text, integer, text,
  timestamptz, text
) to service_role;
grant execute on function public.memory_get_bootstrap() to service_role;
grant execute on function public.memory_get_owner_state(uuid) to service_role;
grant execute on function public.memory_get_source_inventory(uuid) to service_role;
```

- [ ] **Step 8: Add the byte-preserving deterministic generator**

Create `scripts/build-cloud-memory-migration.mjs`:

```js
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const canonicalRelative = 'backend/sql/migrations/0001_memory_foundation.sql';
const overlayRelative = 'backend/sql/overlays/supabase/0001_memory_foundation.sql';
const outputRelative =
  'supabase/migrations/20260728144157_cloud_memory_foundation_20260728112723.sql';
const canonical = await readFile(path.join(root, canonicalRelative));
const overlay = await readFile(path.join(root, overlayRelative));

function assertCanonicalBytes(label, value) {
  if (value.includes(13)) {
    throw new Error(`${label} must use LF, not CRLF`);
  }
  if (
    value.length === 0
    || value[value.length - 1] !== 10
    || (value.length > 1 && value[value.length - 2] === 10)
  ) {
    throw new Error(`${label} must end with exactly one LF`);
  }
}

assertCanonicalBytes(canonicalRelative, canonical);
assertCanonicalBytes(overlayRelative, overlay);
const header = Buffer.from(
  `-- GENERATED by scripts/build-cloud-memory-migration.mjs\n`
  + `-- Source: ${canonicalRelative}\n`
  + `-- Overlay: ${overlayRelative}\n\n`,
  'utf8',
);
const expected = Buffer.concat([
  header,
  canonical,
  Buffer.from('\n'),
  overlay,
]);
const outputPath = path.join(root, outputRelative);

if (process.argv.includes('--check')) {
  const actual = await readFile(outputPath);
  if (!actual.equals(expected)) {
    throw new Error(`${outputRelative} is not byte-current`);
  }
} else {
  await writeFile(outputPath, expected);
}
```

Run:

```powershell
$protected = @(
  'supabase/migrations/202601240001_init.sql',
  'supabase/migrations/20260728120938_memory_portability_authority.sql',
  'supabase/migrations/20260728123338_memory_writer_authority.sql',
  'supabase/migrations/20260728123342_memory_backup_schedule.sql'
)
$protectedBefore = @{}
foreach ($path in $protected) {
  $protectedBefore[$path] = (Get-FileHash -Algorithm SHA256 -LiteralPath $path).Hash
}

node scripts/build-cloud-memory-migration.mjs
node scripts/build-cloud-memory-migration.mjs --check
npx jest --runInBand __tests__/services/cloudMemoryMigrationContract.test.ts
npx supabase db reset --local --no-seed
npx supabase test db supabase/tests/cloud_memory_foundation.test.sql --local
npx supabase db lint --local --level warning --fail-on warning

foreach ($path in $protected) {
  if ((Get-FileHash -Algorithm SHA256 -LiteralPath $path).Hash -ne $protectedBefore[$path]) {
    throw "Protected migration changed: $path"
  }
}
```

Expected: generator check PASS, Jest PASS, reset PASS on PostgreSQL 17, focused pgTAP PASS, lint exits `0`, and every protected migration hash is unchanged.

- [ ] **Step 9: Run a self-contained stale/null-epoch sabotage**

Change only:

```sql
if authority.writer_epoch is distinct from p_writer_epoch then
```

to:

```sql
if false then
```

Run:

```powershell
node scripts/build-cloud-memory-migration.mjs
npx supabase db reset --local --no-seed
npx supabase test db supabase/tests/cloud_memory_foundation.test.sql --local
```

Expected: FAIL on both stale and null writer-epoch assertions. Restore the exact `IS DISTINCT FROM` expression, regenerate, reset, and confirm PASS.

- [ ] **Step 10: Run the `FOR SHARE` concurrency sabotage**

Remove only `for share` from `memory_assert_writer`, regenerate, reset, provision the Task 3 test authority, and run two local PostgreSQL sessions:

```powershell
$statusJson = npx supabase status -o json | ConvertFrom-Json
$dbUrl = $statusJson.DB_URL
$psql = 'C:\Program Files\PostgreSQL\17\bin\psql.exe'
& $psql $dbUrl -X -v ON_ERROR_STOP=1 -c @"
update public.memory_deployment_authority
set
  mode = 'active',
  writer_epoch = 1,
  writer_lease_id = '00000000-0000-4000-8000-000000000077',
  writer_lease_token_digest = encode(
    sha256(convert_to('local-test-writer-token', 'UTF8')),
    'hex'
  ),
  writer_lease_expires_at = clock_timestamp() + interval '1 hour',
  writer_lease_issuer = 'phase0-lock-sabotage',
  writer_lease_key_id = 'phase0-test-key',
  source_credential_fingerprint = 'sha256:local-source',
  change_reason = 'Task 3 FOR SHARE sabotage setup'
where singleton;
"@
$holder = Start-Job -ScriptBlock {
  param($psqlPath, $url)
  & $psqlPath $url -X -v ON_ERROR_STOP=1 -c @"
begin;
select public.memory_assert_writer(
  'blackrose-primary', 1,
  '00000000-0000-4000-8000-000000000077',
  'local-test-writer-token', 'sha256:local-source'
);
select pg_sleep(4);
commit;
"@
} -ArgumentList $psql, $dbUrl
Start-Sleep -Milliseconds 750
$elapsed = Measure-Command {
  & $psql $dbUrl -X -v ON_ERROR_STOP=1 -c @"
update public.memory_deployment_authority
set writer_epoch = 2, change_reason = 'Task 3 FOR SHARE sabotage'
where singleton;
"@
}
Receive-Job -Job $holder -Wait
Remove-Job -Job $holder
if ($elapsed.TotalSeconds -ge 2.5) {
  throw 'Sabotage unexpectedly retained the transactional authority lock'
}
```

Expected with `FOR SHARE` removed: the authority update completes in under `2.5` seconds. Restore `FOR SHARE`, regenerate, reset, provision epoch `1`, rerun the same probe, and invert the assertion:

```powershell
if ($elapsed.TotalSeconds -lt 2.5) {
  throw 'Authority rotation did not wait for the fenced transaction'
}
```

Expected after restoration: the update waits at least `2.5` seconds and runs only after the holding transaction commits. Regenerate, reset, and rerun the focused suite after restoring.

- [ ] **Step 11: Commit only the exact Task 3 allowlist**

```powershell
git add backend/sql scripts/build-cloud-memory-migration.mjs supabase/.gitignore supabase/config.toml supabase/migrations/20260728112723_cloud_memory_foundation.sql supabase/migrations/20260728144157_cloud_memory_foundation_20260728112723.sql __tests__/services/cloudMemoryMigrationContract.test.ts supabase/tests/cloud_memory_foundation.test.sql
git commit -m "feat(memory): add portable fenced PostgreSQL foundation"
```

---

### Task 4: Real PostgreSQL Isolation, Idempotency, Lease, and Delete Verification

**Files:**
- Modify: `supabase/tests/cloud_memory_foundation.test.sql`
- Create: `backend/src/__tests__/localPostgrest.integration.test.ts`
- Create: `backend/sql/tests/local_postgrest_lock_helper.sql`

**Interfaces:**
- Consumes: Task 3 schema and RPC signatures.
- Proves: owner isolation, explicit ACLs, writer fencing, content-equivalent job/manifest/chunk/deletion idempotency, watermark collision rejection, deletion verification enqueue, expired lease recovery and audit history, lease-token fencing, max attempts, atomic attempt recording, PostgreSQL 17 column-list nulling, authority-row lock ordering, and concurrent disjoint claims.

- [ ] **Step 1: Extend the focused Task 3 pgTAP suite using `no_plan()`**

Modify the Task 3 `supabase/tests/cloud_memory_foundation.test.sql`. Preserve its strict feature-shape, null/stale writer, ACL, content-equivalence, expired-finish, owner-FK, and global-index assertions. Add the following isolation, recovery, PostgreSQL 17, and full lifecycle cases. Use real UUIDs and seed as `postgres`; never rely on an inaccurate assertion count.

```sql
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

select has_table('public', 'memory_deployment_authority', 'deployment authority exists');
select has_table('public', 'memory_jobs', 'job table exists');
select has_function(
  'public', 'memory_claim_jobs',
  array['text', 'bigint', 'uuid', 'text', 'text', 'text', 'integer', 'integer'],
  'claim RPC has the fenced signature'
);

update public.memory_deployment_authority
set
  mode = 'active',
  writer_lease_id = '00000000-0000-4000-8000-000000000077',
  writer_lease_token_digest = encode(
    sha256(convert_to('local-test-writer-token', 'UTF8')),
    'hex'
  ),
  writer_lease_expires_at = now() + interval '1 hour',
  writer_lease_issuer = 'phase0-pgtap',
  writer_lease_key_id = 'phase0-test-key',
  source_credential_fingerprint = 'sha256:local-source'
where singleton;

insert into public.memory_conversations (
  owner_id, id, source_kind, source_record_id, status,
  started_at, temporal_provenance, client_schema_version
) values
(
  '00000000-0000-4000-8000-00000000000a',
  'conversation-a', 'journal', 'entry-a', 'settled',
  '2026-07-01T01:00:00Z', 'legacy_unknown', 1
),
(
  '00000000-0000-4000-8000-00000000000b',
  'conversation-b', 'journal', 'entry-b', 'settled',
  '2026-07-01T01:00:00Z', 'legacy_unknown', 1
);

set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  '00000000-0000-4000-8000-00000000000a',
  true
);
select is(
  (select array_agg(id order by id) from public.memory_conversations),
  array['conversation-a']::text[],
  'owner A sees only owner A'
);
select throws_ok(
  $$select * from public.memory_claim_jobs(
    'blackrose-primary', 1,
    '00000000-0000-4000-8000-000000000077',
    'local-test-writer-token', 'sha256:local-source',
    'forbidden-worker', 1, 60
  )$$,
  '42501',
  null,
  'authenticated cannot execute service-only claim RPC'
);

reset role;
select throws_ok(
  $$select * from public.memory_enqueue_job(
    'blackrose-primary', 0,
    '00000000-0000-4000-8000-000000000077',
    'local-test-writer-token', 'sha256:local-source',
    '00000000-0000-4000-8000-00000000000a',
    'capture_source', 'same', 'v1', '{}'::jsonb, 0, 2
  )$$,
  'P0001',
  'MEMORY_STALE_WRITER_EPOCH',
  'stale writer epoch is rejected'
);

update public.memory_deployment_authority set mode = 'maintenance' where singleton;
select throws_ok(
  $$select * from public.memory_enqueue_job(
    'blackrose-primary', 1,
    '00000000-0000-4000-8000-000000000077',
    'local-test-writer-token', 'sha256:local-source',
    '00000000-0000-4000-8000-00000000000a',
    'capture_source', 'same', 'v1', '{}'::jsonb, 0, 2
  )$$,
  'P0001',
  'MEMORY_WRITES_DISABLED',
  'maintenance rejects mutations'
);
update public.memory_deployment_authority set mode = 'active' where singleton;

select throws_ok(
  $$select * from public.memory_enqueue_job(
    'blackrose-primary', 1,
    '00000000-0000-4000-8000-000000000077',
    'wrong-writer-token', 'sha256:local-source',
    '00000000-0000-4000-8000-00000000000a',
    'capture_source', 'wrong-token', 'v1', '{}'::jsonb, 0, 2
  )$$,
  'P0001',
  'MEMORY_WRITER_LEASE_TOKEN_INVALID',
  'wrong writer lease token is rejected'
);
select throws_ok(
  $$select * from public.memory_begin_import(
    'blackrose-primary', 1,
    '00000000-0000-4000-8000-000000000077',
    'wrong-writer-token', 'sha256:local-source',
    '00000000-0000-4000-8000-00000000000a',
    'wrong-token-manifest', 1, 0, 0, 'sha256:empty'
  )$$,
  'P0001',
  'MEMORY_WRITER_LEASE_TOKEN_INVALID',
  'import writes use the same writer lease fence'
);
select throws_ok(
  $$select * from public.memory_enqueue_job(
    'blackrose-primary', 1,
    '00000000-0000-4000-8000-000000000077',
    'local-test-writer-token', 'sha256:wrong-source',
    '00000000-0000-4000-8000-00000000000a',
    'capture_source', 'wrong-source', 'v1', '{}'::jsonb, 0, 2
  )$$,
  'P0001',
  'MEMORY_SOURCE_CREDENTIAL_MISMATCH',
  'wrong source credential fingerprint is rejected'
);
update public.memory_deployment_authority
set writer_lease_expires_at = now() - interval '1 second'
where singleton;
select throws_ok(
  $$select * from public.memory_enqueue_job(
    'blackrose-primary', 1,
    '00000000-0000-4000-8000-000000000077',
    'local-test-writer-token', 'sha256:local-source',
    '00000000-0000-4000-8000-00000000000a',
    'capture_source', 'expired-lease', 'v1', '{}'::jsonb, 0, 2
  )$$,
  'P0001',
  'MEMORY_WRITER_LEASE_EXPIRED',
  'expired writer lease is rejected'
);
update public.memory_deployment_authority
set writer_lease_expires_at = now() + interval '1 hour'
where singleton;

select lives_ok(
  $$select * from public.memory_begin_import(
    'blackrose-primary', 1,
    '00000000-0000-4000-8000-000000000077',
    'local-test-writer-token', 'sha256:local-source',
    '00000000-0000-4000-8000-00000000000a',
    'manifest-a', 1, 0, 0, 'sha256:empty'
  )$$,
  'fenced import manifest begins'
);
select lives_ok(
  $$select * from public.memory_begin_import(
    'blackrose-primary', 1,
    '00000000-0000-4000-8000-000000000077',
    'local-test-writer-token', 'sha256:local-source',
    '00000000-0000-4000-8000-00000000000a',
    'manifest-a', 1, 0, 0, 'sha256:empty'
  )$$,
  'content-equivalent manifest replay returns the existing row'
);
select throws_ok(
  $$select * from public.memory_begin_import(
    'blackrose-primary', 1,
    '00000000-0000-4000-8000-000000000077',
    'local-test-writer-token', 'sha256:local-source',
    '00000000-0000-4000-8000-00000000000a',
    'manifest-a', 1, 1, 0, 'sha256:changed'
  )$$,
  'PT409',
  'MEMORY_IDEMPOTENCY_CONFLICT',
  'same manifest identity with changed counts or hash is rejected'
);
select lives_ok(
  $$select * from public.memory_accept_import_chunk(
    'blackrose-primary', 1,
    '00000000-0000-4000-8000-000000000077',
    'local-test-writer-token', 'sha256:local-source',
    '00000000-0000-4000-8000-00000000000a',
    'manifest-a', 0, 'chunk-event-a', 0, 'sha256:empty',
    12, 'client-event-12', 'journal', '2026-07-28T00:00:00Z'
  )$$,
  'chunk acceptance and watermark update are one transaction'
);
select lives_ok(
  $$select * from public.memory_accept_import_chunk(
    'blackrose-primary', 1,
    '00000000-0000-4000-8000-000000000077',
    'local-test-writer-token', 'sha256:local-source',
    '00000000-0000-4000-8000-00000000000a',
    'manifest-a', 0, 'chunk-event-a', 0, 'sha256:empty',
    12, 'client-event-12', 'journal', '2026-07-28T00:00:00Z'
  )$$,
  'content-equivalent chunk replay returns the existing row'
);
select throws_ok(
  $$select * from public.memory_accept_import_chunk(
    'blackrose-primary', 1,
    '00000000-0000-4000-8000-000000000077',
    'local-test-writer-token', 'sha256:local-source',
    '00000000-0000-4000-8000-00000000000a',
    'manifest-a', 0, 'chunk-event-a', 0, 'sha256:changed',
    12, 'client-event-12', 'journal', '2026-07-28T00:00:00Z'
  )$$,
  'PT409',
  'MEMORY_IDEMPOTENCY_CONFLICT',
  'same chunk identity with changed content is rejected'
);
select throws_ok(
  $$select * from public.memory_accept_import_chunk(
    'blackrose-primary', 1,
    '00000000-0000-4000-8000-000000000077',
    'local-test-writer-token', 'sha256:local-source',
    '00000000-0000-4000-8000-00000000000a',
    'manifest-a', 1, 'chunk-event-b', 0, 'sha256:empty-2',
    12, 'different-event-at-12', 'journal', '2026-07-28T00:02:00Z'
  )$$,
  'PT409',
  'MEMORY_SOURCE_WATERMARK_CONFLICT',
  'equal watermark sequence with a different event ID is rejected'
);
select is(
  (
    select highest_client_sequence
    from public.memory_source_watermarks
    where owner_id = '00000000-0000-4000-8000-00000000000a'
      and source_kind = 'journal'
  ),
  12::bigint,
  'source high watermark is durable'
);
select lives_ok(
  $$select * from public.memory_record_deletion(
    'blackrose-primary', 1,
    '00000000-0000-4000-8000-000000000077',
    'local-test-writer-token', 'sha256:local-source',
    '00000000-0000-4000-8000-00000000000a',
    'journal', 'entry-deleted', 1, 'delete-event-1',
    '2026-07-28T00:01:00Z', 'USER_DELETE'
  )$$,
  'deletion ledger append is fenced'
);
select lives_ok(
  $$select * from public.memory_record_deletion(
    'blackrose-primary', 1,
    '00000000-0000-4000-8000-000000000077',
    'local-test-writer-token', 'sha256:local-source',
    '00000000-0000-4000-8000-00000000000a',
    'journal', 'entry-deleted', 1, 'delete-event-1',
    '2026-07-28T00:01:00Z', 'USER_DELETE'
  )$$,
  'content-equivalent deletion replay returns the existing tombstone'
);
select throws_ok(
  $$select * from public.memory_record_deletion(
    'blackrose-primary', 1,
    '00000000-0000-4000-8000-000000000077',
    'local-test-writer-token', 'sha256:local-source',
    '00000000-0000-4000-8000-00000000000a',
    'journal', 'entry-deleted', 1, 'delete-event-1',
    '2026-07-28T00:01:00Z', 'CHANGED_REASON'
  )$$,
  'PT409',
  'MEMORY_IDEMPOTENCY_CONFLICT',
  'same deletion identity with changed content is rejected'
);
select is(
  (
    select verification_status
    from public.memory_deletion_ledger
    where owner_id = '00000000-0000-4000-8000-00000000000a'
      and client_event_id = 'delete-event-1'
  ),
  'pending',
  'Phase 0 records but does not falsely verify deletion'
);
select is(
  (
    select count(*)
    from public.memory_jobs
    where owner_id = '00000000-0000-4000-8000-00000000000a'
      and job_type = 'verify_deletion'
      and idempotency_key = 'deletion:delete-event-1'
  ),
  1::bigint,
  'deletion atomically enqueues exactly one verification job'
);

select lives_ok(
  $$select * from public.memory_enqueue_job(
    'blackrose-primary', 1,
    '00000000-0000-4000-8000-000000000077',
    'local-test-writer-token', 'sha256:local-source',
    '00000000-0000-4000-8000-00000000000a',
    'capture_source', 'same', 'v1', '{"sourceId":"entry-a"}'::jsonb, 20, 2
  )$$,
  'first enqueue succeeds'
);
select lives_ok(
  $$select * from public.memory_enqueue_job(
    'blackrose-primary', 1,
    '00000000-0000-4000-8000-000000000077',
    'local-test-writer-token', 'sha256:local-source',
    '00000000-0000-4000-8000-00000000000a',
    'capture_source', 'same', 'v1', '{"sourceId":"entry-a"}'::jsonb, 20, 2
  )$$,
  'content-equivalent duplicate enqueue returns existing row at priority 20'
);
select throws_ok(
  $$select * from public.memory_enqueue_job(
    'blackrose-primary', 1,
    '00000000-0000-4000-8000-000000000077',
    'local-test-writer-token', 'sha256:local-source',
    '00000000-0000-4000-8000-00000000000a',
    'capture_source', 'same', 'v1', '{"sourceId":"different"}'::jsonb, 20, 2
  )$$,
  'PT409',
  'MEMORY_IDEMPOTENCY_CONFLICT',
  'same job identity with different content is rejected'
);
select is(
  (select count(*) from public.memory_jobs where idempotency_key = 'same'),
  1::bigint,
  'duplicate enqueue creates one row'
);

select is(
  (select count(*) from public.memory_claim_jobs(
    'blackrose-primary', 1,
    '00000000-0000-4000-8000-000000000077',
    'local-test-writer-token', 'sha256:local-source',
    'worker-a', 1, 15
  )),
  1::bigint,
  'first claim leases one job'
);
update public.memory_jobs set lease_expires_at = now() - interval '1 second';
select is(
  (select count(*) from public.memory_claim_jobs(
    'blackrose-primary', 1,
    '00000000-0000-4000-8000-000000000077',
    'local-test-writer-token', 'sha256:local-source',
    'worker-b', 1, 15
  )),
  1::bigint,
  'expired leased job is reclaimed'
);
select is(
  (select worker_id from public.memory_jobs where idempotency_key = 'same'),
  'worker-b',
  'reclaim changes worker'
);

select throws_ok(
  format(
    $$select * from public.memory_finish_job(
      'blackrose-primary', 1,
      '00000000-0000-4000-8000-000000000077',
      'local-test-writer-token', 'sha256:local-source',
      %s, 'worker-a', %L::uuid,
      'succeeded', null, 15, null, null, '{}'::jsonb, null, 1, now(), '{}'::jsonb
    )$$,
    (select id from public.memory_jobs where idempotency_key = 'same'),
    gen_random_uuid()
  ),
  'P0001',
  'MEMORY_STALE_JOB_LEASE',
  'stale worker/token cannot finish reclaimed job'
);

select lives_ok(
  format(
    $$select * from public.memory_finish_job(
      'blackrose-primary', 1,
      '00000000-0000-4000-8000-000000000077',
      'local-test-writer-token', 'sha256:local-source',
      %s, 'worker-b', %L::uuid,
      'retryable', 'TRANSIENT', 15, null, null, '{}'::jsonb, 503, 1,
      now() - interval '1 second', '{}'::jsonb
    )$$,
    (select id from public.memory_jobs where idempotency_key = 'same'),
    (select lease_token from public.memory_jobs where idempotency_key = 'same')
  ),
  'current lease finishes atomically'
);
select is(
  (select status from public.memory_jobs where idempotency_key = 'same'),
  'dead_letter',
  'max attempts convert retry to dead letter'
);
select is(
  (select count(*) from public.memory_job_attempts),
  2::bigint,
  'expired lease and final transition each record one attempt atomically'
);
select is(
  (
    select count(*)
    from public.memory_job_attempts
    where error_code = 'JOB_LEASE_EXPIRED'
  ),
  1::bigint,
  'expired lease recovery preserves the abandoned attempt history'
);

insert into public.turn_traces (
  owner_id, id, conversation_id, authority_state, route, status
) values (
  '00000000-0000-4000-8000-00000000000a',
  'trace-a', 'conversation-a', 'LOCAL', 'local', 'complete'
);
delete from public.memory_conversations
where owner_id = '00000000-0000-4000-8000-00000000000a'
  and id = 'conversation-a';
select is(
  (select owner_id from public.turn_traces where id = 'trace-a'),
  '00000000-0000-4000-8000-00000000000a'::uuid,
  'trace owner survives parent delete'
);
select is(
  (select conversation_id from public.turn_traces where id = 'trace-a'),
  null,
  'only conversation_id is nulled'
);

select * from finish();
rollback;
```

- [ ] **Step 2: Run pgTAP red/green**

```powershell
npx supabase db reset --local --no-seed
npx supabase test db supabase/tests/cloud_memory_foundation.test.sql --local
```

Expected: PASS. If any newly added lifecycle assertion is red, repair the exact Task 3 SQL source, regenerate the unapplied foundation migration, rerun reset, and keep the new assertion; never weaken or delete it.

- [ ] **Step 3: Write a real concurrent PostgREST integration test**

Create `backend/src/__tests__/localPostgrest.integration.test.ts`. It is skipped unless `RUN_SUPABASE_LOCAL_TESTS=1`, uses the local service key supplied by the invoking command, and makes real parallel RPC calls:

```ts
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

const run = process.env.RUN_SUPABASE_LOCAL_TESTS === '1' ? describe : describe.skip;
const baseUrl = process.env.SUPABASE_LOCAL_URL ?? '';
const serviceKey = process.env.SUPABASE_LOCAL_SERVICE_ROLE_KEY ?? '';
const headers = {
  apikey: serviceKey,
  Authorization: `Bearer ${serviceKey}`,
  'Content-Type': 'application/json',
};
const ownerA = '00000000-0000-4000-8000-00000000000a';
const writerLeaseId = '00000000-0000-4000-8000-000000000077';
const writerLeaseToken = 'local-test-writer-token';
const sourceCredentialFingerprint = 'sha256:local-source';

async function rpc<T>(name: string, body: object): Promise<T> {
  const response = await fetch(`${baseUrl}/rest/v1/rpc/${name}`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });
  assert.equal(response.ok, true, await response.text());
  return response.json() as Promise<T>;
}

run('local PostgREST concurrency', () => {
  it('returns disjoint leases to parallel workers', { timeout: 5_000 }, async () => {
    const directWrite = await fetch(
      `${baseUrl}/rest/v1/memory_jobs`,
      {
        method: 'POST',
        headers,
        body: JSON.stringify({
          owner_id: ownerA,
          job_type: 'capture_source',
          idempotency_key: 'forbidden-direct-write',
          source_version: 'v1',
        }),
      },
    );
    assert.equal(directWrite.ok, false);
    assert.equal([401, 403].includes(directWrite.status), true);

    for (const idempotencyKey of ['parallel-a', 'parallel-b']) {
      await rpc('memory_enqueue_job', {
        p_deployment_id: 'blackrose-primary',
        p_writer_epoch: 1,
        p_writer_lease_id: writerLeaseId,
        p_writer_lease_token: writerLeaseToken,
        p_source_credential_fingerprint: sourceCredentialFingerprint,
        p_owner_id: ownerA,
        p_job_type: 'capture_source',
        p_idempotency_key: idempotencyKey,
        p_source_version: 'v1',
        p_payload_reference: {},
        p_priority: 0,
        p_max_attempts: 5,
      });
    }
    const [a, b] = await Promise.all([
      rpc<Array<{ id: number; lease_token: string }>>('memory_claim_jobs', {
        p_deployment_id: 'blackrose-primary',
        p_writer_epoch: 1,
        p_writer_lease_id: writerLeaseId,
        p_writer_lease_token: writerLeaseToken,
        p_source_credential_fingerprint: sourceCredentialFingerprint,
        p_worker_id: 'parallel-worker-a',
        p_limit: 1,
        p_lease_seconds: 60,
      }),
      rpc<Array<{ id: number; lease_token: string }>>('memory_claim_jobs', {
        p_deployment_id: 'blackrose-primary',
        p_writer_epoch: 1,
        p_writer_lease_id: writerLeaseId,
        p_writer_lease_token: writerLeaseToken,
        p_source_credential_fingerprint: sourceCredentialFingerprint,
        p_worker_id: 'parallel-worker-b',
        p_limit: 1,
        p_lease_seconds: 60,
      }),
    ]);
    assert.equal(a.length, 1);
    assert.equal(b.length, 1);
    assert.notEqual(a[0]?.id, b[0]?.id);
    assert.notEqual(a[0]?.lease_token, b[0]?.lease_token);
  });
});
```

Run with values parsed without printing secrets:

```powershell
npx supabase db reset --local --no-seed
$statusJson = npx supabase status -o json | ConvertFrom-Json
$psql = 'C:\Program Files\PostgreSQL\17\bin\psql.exe'
& $psql $statusJson.DB_URL -X -v ON_ERROR_STOP=1 `
  -f backend/sql/tests/local_postgrest_lock_helper.sql
$env:SUPABASE_LOCAL_URL = $statusJson.API_URL
$env:SUPABASE_LOCAL_SERVICE_ROLE_KEY = $statusJson.SERVICE_ROLE_KEY
$env:RUN_SUPABASE_LOCAL_TESTS = '1'
npm --prefix backend test -- --testPathPattern=localPostgrest
Remove-Item Env:SUPABASE_LOCAL_URL,Env:SUPABASE_LOCAL_SERVICE_ROLE_KEY,Env:RUN_SUPABASE_LOCAL_TESTS
```

The checked-in helper is test-only: it provisions the active local lease, truncates
prior job rows, creates and grants the held-row lock helper, and requests a PostgREST
schema reload. A clean database reset removes it.

Expected: PASS with two different job IDs and lease tokens, denied direct table DML,
and the locked high-priority row skipped in favor of the next eligible row.

- [ ] **Step 4: Sabotage and commit**

Sabotage: remove `FOR UPDATE SKIP LOCKED`, reset, and run the parallel integration. Confirm red or blocking failure within the test timeout; restore, reset, rerun.

```powershell
git add supabase/tests/cloud_memory_foundation.test.sql backend/src/__tests__/localPostgrest.integration.test.ts
git commit -m "test(memory): prove writer fencing isolation and lease recovery"
```

---

### Task 5: Supabase Auth, Runtime Config, and Portable PostgREST Gateway

**Files:**
- Create: `backend/src/auth/supabaseAuth.ts`
- Create: `backend/src/memory/config.ts`
- Create: `backend/src/memory/gateway/postgrestGateway.ts`
- Modify: `backend/src/config/serverConfig.ts`
- Test: `backend/src/__tests__/supabaseAuth.test.ts`
- Test: `backend/src/__tests__/memoryConfig.test.ts`
- Test: `backend/src/__tests__/postgrestGateway.test.ts`

**Interfaces:**
- Produces: `verifySupabaseAccessToken(token, config, fetchImpl)`.
- Produces: `createMemoryAuthMiddleware(deps)`.
- Produces: `readMemoryConfig(env): MemoryConfigResult`.
- Produces: `PostgrestGateway.rpc<T>(name, body)`.
- Uses UUID owner IDs only.

- [ ] **Step 1: Write failing auth tests with real UUID shapes**

Test these exact cases in `backend/src/__tests__/supabaseAuth.test.ts`:

```ts
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  createMemoryAuthMiddleware,
  verifySupabaseAccessToken,
} from '../auth/supabaseAuth';

const ownerId = '00000000-0000-4000-8000-00000000000a';
const config = {
  supabaseUrl: 'https://project.supabase.co',
  supabasePublishableKey: 'publishable-test-key',
  timeoutMs: 100,
};

describe('Supabase memory auth', () => {
  it('forwards the user token and accepts only a UUID subject', async () => {
    let headers = new Headers();
    const result = await verifySupabaseAccessToken(
      'user-token',
      config,
      async (_input, init) => {
        headers = new Headers(init?.headers);
        return new Response(JSON.stringify({ id: ownerId }), { status: 200 });
      },
    );
    assert.deepEqual(result, {
      status: 'verified',
      user: { ownerId, accessToken: 'user-token' },
    });
    assert.equal(headers.get('apikey'), 'publishable-test-key');
    assert.equal(headers.get('authorization'), 'Bearer user-token');
  });

  it('distinguishes invalid auth from upstream unavailability', async () => {
    assert.deepEqual(
      await verifySupabaseAccessToken('bad', config, async () => new Response('{}', {
        status: 401,
      })),
      { status: 'invalid' },
    );
    assert.deepEqual(
      await verifySupabaseAccessToken('token', config, async () => {
        throw new Error('private network detail');
      }),
      { status: 'unavailable' },
    );
    assert.deepEqual(
      await verifySupabaseAccessToken(
        'token',
        config,
        async () => new Response(JSON.stringify({ id: 'not-a-uuid' }), { status: 200 }),
      ),
      { status: 'invalid' },
    );
  });

  it('returns stable redacted middleware errors', async () => {
    const middleware = createMemoryAuthMiddleware({
      config,
      verify: async () => ({ status: 'unavailable' }),
    });
    const req = { headers: { authorization: 'Bearer token' } } as never;
    let status = 0;
    let payload: unknown;
    const res = {
      locals: {},
      status(code: number) { status = code; return this; },
      json(value: unknown) { payload = value; return this; },
    } as never;
    await middleware(req, res, () => assert.fail('next not expected'));
    assert.equal(status, 503);
    assert.deepEqual(payload, {
      error: { code: 'MEMORY_AUTH_UNAVAILABLE', message: 'Authentication unavailable.' },
    });
  });
});
```

- [ ] **Step 2: Write failing config/gateway tests**

`memoryConfig.test.ts` must assert empty/partial config is `not_ready`, the redacted not-ready result contains no secret values, and a valid new secret or legacy service-role key plus a complete writer lease is accepted. The ready result is an internal server-only configuration object and must never be serialized. `postgrestGateway.test.ts` must assert:

```ts
assert.equal(headers.get('apikey'), 'sb_secret_test');
assert.equal(headers.get('authorization'), null);
assert.equal(seenUrl, 'https://gateway.example.test/rest/v1/rpc/memory_get_bootstrap');
assert.deepEqual(JSON.parse(seenBody), {});
```

For a legacy JWT key it must assert the same key appears in `apikey` and `Authorization: Bearer`. A failed request must throw `PostgrestGatewayError` containing only status and stable code, never the response body.

- [ ] **Step 3: Run red**

```powershell
npm --prefix backend test -- --testPathPattern=supabaseAuth
npm --prefix backend test -- --testPathPattern=memoryConfig
npm --prefix backend test -- --testPathPattern=postgrestGateway
```

Expected: FAIL with missing modules.

- [ ] **Step 4: Implement exact public types**

Use these exact public contracts; tests may inject `fetch`.

```ts
// supabaseAuth.ts public surface
export interface MemoryAuthConfig {
  supabaseUrl: string;
  supabasePublishableKey: string;
  timeoutMs: number;
}
export interface MemoryAuthUser { ownerId: string; accessToken: string }
export type VerifyResult =
  | { status: 'verified'; user: MemoryAuthUser }
  | { status: 'invalid' }
  | { status: 'unavailable' };
export type VerifyAccessToken = (
  token: string,
  config: MemoryAuthConfig,
) => Promise<VerifyResult>;
```

Implement UUID validation with:

```ts
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
```

Use `AbortSignal.timeout(config.timeoutMs)` in the fetch request; return `invalid` for non-2xx and invalid body, `unavailable` for thrown fetch/timeout/JSON errors. The middleware maps missing/invalid to `401`, unavailable to `503`, attaches only verified `{ ownerId, accessToken }` to `res.locals.memoryAuth`, and never logs the token or upstream body.

Use these config/gateway contracts:

```ts
export interface MemoryRuntimeConfig {
  postgrestBaseUrl: string;
  postgrestServerKey: string;
  postgrestKeyKind: 'secret' | 'legacy_service_role';
  deploymentId: string;
  writerLeaseId: string;
  writerLeaseToken: string;
  sourceCredentialFingerprint: string;
  auth: MemoryAuthConfig;
}

export type MemoryConfigResult =
  | { ready: true; config: MemoryRuntimeConfig }
  | {
      ready: false;
      dependencies: { supabaseAuth: boolean; postgrestGateway: boolean; deployment: boolean };
    };

export interface PostgrestGateway {
  rpc<T>(name: string, body: Readonly<Record<string, unknown>>): Promise<T>;
}
```

`readMemoryConfig` reads:

- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `MEMORY_POSTGREST_URL`, falling back to `SUPABASE_URL`
- `SUPABASE_SECRET_KEY` or `SUPABASE_SERVICE_ROLE_KEY`
- `MEMORY_DEPLOYMENT_ID`
- `MEMORY_WRITER_LEASE_ID`
- `MEMORY_WRITER_LEASE_TOKEN`
- `MEMORY_SOURCE_CREDENTIAL_FINGERPRINT`

It validates the lease ID as UUID, requires a nonempty opaque token, and requires a nonempty source-credential fingerprint. It returns booleans only when incomplete and never places the raw token in a redacted readiness object. `createPostgrestGateway` allowlists the nine Task 3 public RPC names, rejects `/`, `?`, and non-allowlisted names, sends new `sb_secret_` keys only as `apikey`, and sends legacy JWTs in both headers. `memory_assert_writer` is internal-only and never appears in the gateway allowlist.

- [ ] **Step 5: Verify, sabotage, and commit**

```powershell
npm --prefix backend test -- --testPathPattern=supabaseAuth
npm --prefix backend test -- --testPathPattern=memoryConfig
npm --prefix backend test -- --testPathPattern=postgrestGateway
npm --prefix backend run build
```

Sabotage: forward the publishable key as the user bearer token; confirm auth test red; restore.

```powershell
git add backend/src/auth backend/src/memory/config.ts backend/src/memory/gateway backend/src/config/serverConfig.ts backend/src/__tests__/supabaseAuth.test.ts backend/src/__tests__/memoryConfig.test.ts backend/src/__tests__/postgrestGateway.test.ts
git commit -m "feat(backend): add validated auth and portable PostgREST gateway"
```

---

### Task 6: Domain Repositories and Production App Composition

**Files:**
- Create: `backend/src/memory/repositories/memoryRepository.ts`
- Create: `backend/src/memory/routes/memoryRoutes.ts`
- Create: `backend/src/app.ts`
- Modify: `backend/src/index.ts`
- Test: `backend/src/__tests__/memoryRepository.test.ts`
- Test: `backend/src/__tests__/memoryRoutes.test.ts`
- Test: `backend/src/__tests__/appComposition.test.ts`

**Interfaces:**
- Produces: `MemoryRepository`.
- Produces routes: `GET /v1/memory/bootstrap`, `/state`, `/inventory`.
- Produces: `createApp(deps)` without listening.
- Leaves legacy API-key auth on only `/v1/chat`, `/v1/ask-rosebud`, and `/v1/insights`.

- [ ] **Step 1: Write failing repository tests**

Test exact RPC mapping with verified owner UUID:

```ts
const ownerId = '00000000-0000-4000-8000-00000000000a';
assert.deepEqual(calls, [
  { name: 'memory_get_bootstrap', body: {} },
  { name: 'memory_get_owner_state', body: { p_owner_id: ownerId } },
  { name: 'memory_get_source_inventory', body: { p_owner_id: ownerId } },
]);
```

Test malformed bootstrap/state rows fail closed with `MemoryRepositoryError('MEMORY_DATA_INVALID')`; absent owner state returns `null`; timestamps are strings or null.

- [ ] **Step 2: Write failing real-app composition test**

Create `appComposition.test.ts` with an ephemeral HTTP server from `createApp`. Assert:

- `Bearer valid-user-token` reaches `/v1/memory/state` without `AGENT_API_KEY`;
- `x-api-key: legacy-key` alone cannot reach memory routes;
- legacy `/v1/chat/completions` still rejects without the legacy key;
- query string `?owner_id=<other UUID>` never changes the repository owner;
- `/bootstrap` returns deployment ID, epoch, mode, base URL, database fingerprint, writer lease ID/expiry/issuer/key ID, and source-credential fingerprint; it never returns the writer lease token or token digest;
- all three memory responses include `Cache-Control: no-store`.

- [ ] **Step 3: Run red**

```powershell
npm --prefix backend test -- --testPathPattern=memoryRepository
npm --prefix backend test -- --testPathPattern=memoryRoutes
npm --prefix backend test -- --testPathPattern=appComposition
```

Expected: FAIL with missing modules.

- [ ] **Step 4: Implement repository and route contracts**

Use:

```ts
export interface BootstrapState {
  deploymentId: string;
  writerEpoch: number;
  mode: 'active' | 'maintenance' | 'read_only' | 'retired';
  backendBaseUrl: string | null;
  databaseFingerprint: string;
  writerLeaseId: string | null;
  writerLeaseExpiresAt: string | null;
  writerLeaseIssuer: string | null;
  writerLeaseKeyId: string | null;
  sourceCredentialFingerprint: string | null;
}

export interface OwnerMemoryState {
  authorityState: 'LOCAL' | 'MIRROR' | 'SHADOW' | 'CLOUD';
  authorityVersion: number;
  featureFlags: MemoryFeatureFlags;
}

export interface SourceInventoryCounts {
  conversationCount: number;
  messageCount: number;
  oldestAuthoredAt: string | null;
  newestAuthoredAt: string | null;
}

export interface MemoryRepository {
  getBootstrap(): Promise<BootstrapState>;
  getOwnerState(ownerId: string): Promise<OwnerMemoryState | null>;
  getSourceInventory(ownerId: string): Promise<SourceInventoryCounts>;
}
```

`createMemoryRepository(gateway)` calls only Task 3 RPCs and validates every response at runtime. `registerMemoryRoutes(app, deps)` always obtains owner ID from `res.locals.memoryAuth`, never from params/body/query. Missing owner state returns `LOCAL`, version `0`, and all flags false. Invalid/missing bootstrap returns `503 MEMORY_AUTHORITY_UNAVAILABLE`; other gateway failures return `503 MEMORY_DATA_UNAVAILABLE`. Responses never include keys, tokens, or upstream bodies.

- [ ] **Step 5: Implement the production composition root**

`backend/src/app.ts` exports:

```ts
export interface AppDeps {
  serverConfig: ServerConfig;
  memoryAuthMiddleware: RequestHandler;
  memoryRepository: MemoryRepository;
}

export function createApp(deps: AppDeps): express.Application;
```

The registration order is exact:

```ts
registerHealthRoutes(app, deps.serverConfig.readiness);
registerMemoryRoutes(app, {
  authMiddleware: deps.memoryAuthMiddleware,
  repository: deps.memoryRepository,
});

const legacyAuth = createAuthMiddleware(deps.serverConfig.agentApiKey);
app.use(['/v1/chat', '/v1/ask-rosebud', '/v1/insights'], legacyAuth);
registerChatRoutes(app);
registerAskRosebudRoutes(app);
registerInsightsRoutes(app);
```

`backend/src/index.ts` loads config, constructs adapters/repositories/app, creates the HTTP server/WebSocket server, and listens. It contains no route definitions. Do not call `loadConfig()` before `createApp`; AI validation belongs in readiness and request-time AI code so a misconfigured process can still expose liveness/readiness.

- [ ] **Step 6: Verify, sabotage, and commit**

```powershell
npm --prefix backend test -- --testPathPattern=memoryRepository
npm --prefix backend test -- --testPathPattern=memoryRoutes
npm --prefix backend test -- --testPathPattern=appComposition
npm --prefix backend run build
```

Sabotage: mount legacy auth at `/v1`; confirm the valid user-token memory test fails; restore and rerun.

```powershell
git add backend/src/memory/repositories/memoryRepository.ts backend/src/memory/routes/memoryRoutes.ts backend/src/app.ts backend/src/index.ts backend/src/__tests__/memoryRepository.test.ts backend/src/__tests__/memoryRoutes.test.ts backend/src/__tests__/appComposition.test.ts
git commit -m "feat(backend): compose owner-scoped memory foundation routes"
```

---

### Task 7: Durable Job Repository Over Transactional RPCs

**Files:**
- Create: `backend/src/memory/repositories/jobRepository.ts`
- Test: `backend/src/__tests__/jobRepository.test.ts`

**Interfaces:**
- Consumes: `PostgrestGateway`, `DeploymentWriteRequest`.
- Produces: `JobRepository.enqueue`, `.claim`, `.finish`.
- Does not issue direct table writes.

- [ ] **Step 1: Write failing exact-RPC tests**

Use these exact calls and assert the body property names:

```ts
await repository.enqueue(authority, {
  ownerId: '00000000-0000-4000-8000-00000000000a',
  jobType: 'capture_source',
  idempotencyKey: 'source:entry-a:v1',
  sourceVersion: 'v1',
  payloadReference: { sourceId: 'entry-a' },
  priority: 0,
  maxAttempts: 5,
});
await repository.claim(authority, {
  workerId: 'web-1',
  limit: 10,
  leaseSeconds: 60,
});
await repository.finish(authority, {
  jobId: 1,
  workerId: 'web-1',
  leaseToken: '00000000-0000-4000-8000-0000000000aa',
  outcome: 'retryable',
  errorCode: 'PROVIDER_RATE_LIMIT',
  retryDelaySeconds: 30,
  provider: 'openrouter',
  model: 'model-id',
  tokenUsage: {},
  statusCode: 429,
  schemaVersion: 1,
  startedAt: '2026-07-28T00:00:00.000Z',
  redactedDiagnostics: { category: 'rate_limit' },
});
```

Assert calls are exactly `memory_enqueue_job`, `memory_claim_jobs`, and `memory_finish_job`. Assert no URL/table request method exists. Assert payload references and diagnostics reject keys matching `/content|prompt|journal|token|secret/i`.

- [ ] **Step 2: Run red**

```powershell
npm --prefix backend test -- --testPathPattern=jobRepository
```

Expected: FAIL with missing module.

- [ ] **Step 3: Implement exact interface**

```ts
export interface JobRepository {
  enqueue(
    authority: DeploymentWriteRequest,
    input: EnqueueJobInput,
  ): Promise<MemoryJobRecord>;
  claim(
    authority: DeploymentWriteRequest,
    input: ClaimJobsInput,
  ): Promise<MemoryJobRecord[]>;
  finish(
    authority: DeploymentWriteRequest,
    input: FinishJobInput,
  ): Promise<MemoryJobRecord>;
}
```

Map camelCase to the Task 3 `p_*` RPC names. `retryDelaySeconds` is calculated by the worker as `Math.min(3600, 2 ** attemptCount * 15)` and passed to the atomic finish RPC; the repository never increments `attemptCount`. Validate job rows, UUID lease tokens, timestamps, statuses, and numeric bounds at runtime. Map PostgREST RPC error messages `MEMORY_STALE_WRITER_EPOCH`, `MEMORY_WRITES_DISABLED`, and `MEMORY_STALE_JOB_LEASE` to stable typed repository error codes without copying upstream response bodies.

Every one of the three RPC bodies begins with this exact mapping:

```ts
{
  p_deployment_id: authority.deploymentId,
  p_writer_epoch: authority.writerEpoch,
  p_writer_lease_id: authority.writerLeaseId,
  p_writer_lease_token: authority.writerLeaseToken,
  p_source_credential_fingerprint: authority.sourceCredentialFingerprint,
}
```

Add `MEMORY_WRITER_LEASE_MISMATCH`, `MEMORY_WRITER_LEASE_EXPIRED`,
`MEMORY_WRITER_LEASE_TOKEN_INVALID`, and `MEMORY_SOURCE_CREDENTIAL_MISMATCH`
to the stable repository error-code mapping. Never include
`authority.writerLeaseToken` in an error, diagnostic, trace, or logger argument.

- [ ] **Step 4: Verify, sabotage, and commit**

```powershell
npm --prefix backend test -- --testPathPattern=jobRepository
npm --prefix backend run build
```

Sabotage: replace `memory_finish_job` with a direct `/memory_jobs` request; confirm the exact-call test fails; restore.

```powershell
git add backend/src/memory/repositories/jobRepository.ts backend/src/__tests__/jobRepository.test.ts
git commit -m "feat(memory): use fenced transactional job RPCs"
```

---

### Task 8: Read-Only Legacy Source Inventory With Honest Time Provenance

**Files:**
- Create: `services/memory/cloud/sourceInventory.ts`
- Test: `__tests__/services/cloudSourceInventory.test.ts`

**Interfaces:**
- Consumes: current `JournalEntry[]`, `IntentionCheckIn[]`, and `generatedAt`.
- Produces: `buildMemorySourceInventory(input): MemorySourceInventory`.
- Legacy records always emit `temporalProvenance: 'legacy_unknown'`, null timezone/local date/week start/settled time.

- [ ] **Step 1: Write the failing complete test**

Create fixtures with two completed entries whose messages reuse the same raw message ID, one draft entry, one completed check-in, and one draft check-in. Assert:

```ts
expect(inventory.conversations[0]).toMatchObject({
    status: 'settled',
    settledAt: null,
    timezone: null,
    weekStartsOn: null,
    temporalProvenance: 'legacy_unknown',
});
expect(inventory.messages[0]).toMatchObject({
    authoredTimezone: null,
    localDate: null,
    temporalProvenance: 'legacy_unknown',
});
expect(new Set(inventory.messages.map((message) => message.id)).size)
    .toBe(inventory.messageCount);
expect(inventory.messages.map((message) => message.content))
    .toEqual(['first exact text', 'second exact text', 'check-in exact text']);
```

Also assert draft exclusion, stable deterministic sorting, exact UTC conversion from each `Message.timestamp`, exact oldest/newest instants, no input mutation, invalid timestamp rejection, empty ID rejection, and global canonical ID uniqueness even when raw message IDs repeat across conversations.

- [ ] **Step 2: Run red**

```powershell
npx jest --runInBand __tests__/services/cloudSourceInventory.test.ts
```

Expected: FAIL with missing module.

- [ ] **Step 3: Implement exact mapping**

Use:

```ts
export interface BuildMemorySourceInventoryInput {
    entries: readonly JournalEntry[];
    checkIns: readonly IntentionCheckIn[];
    generatedAt: Date;
}

export function buildMemorySourceInventory(
    input: BuildMemorySourceInventoryInput,
): MemorySourceInventory;
```

Mapping rules:

- include only `status === 'completed'`;
- conversation ID is `conversationSourceId('journal', entry.id)` or `conversationSourceId('intention_checkin', checkIn.id)`;
- canonical message ID and client-event ID are both `messageClientEventId(conversationId, rawMessage.id)`, preventing cross-conversation collision;
- `startedAt` is the source `createdAt` UTC ISO string;
- `settledAt`, `timezone`, and `weekStartsOn` are null;
- each message `authoredAt` is its own timestamp UTC ISO string;
- `authoredTimezone` and `localDate` are null;
- all legacy temporal provenance is `legacy_unknown`;
- conversation status is `settled`, message revision `1`, message status `active`;
- conversations sort by `startedAt`, then ID; messages sort by conversation order, sequence, then ID;
- check-ins with absent messages produce a zero-message settled conversation;
- throw `MemorySourceInventoryError` with `INVALID_ID`, `INVALID_TIMESTAMP`, or `DUPLICATE_CANONICAL_ID`; never include source content in the error.

- [ ] **Step 4: Verify, sabotage, and commit**

```powershell
npx jest --runInBand __tests__/services/cloudSourceInventory.test.ts
```

Sabotage: derive `localDate` from UTC slicing; confirm the provenance/null assertion fails; restore.

```powershell
git add services/memory/cloud/sourceInventory.ts __tests__/services/cloudSourceInventory.test.ts
git commit -m "feat(memory): inventory legacy sources without invented time"
```

---

### Task 9: Memory Quality Constitution and Repository Constitution

**Files:**
- Create: `benchmarks/memory/qualityConstitution.ts`
- Create: `benchmarks/memory/fixtures/phase0Isolation.ts`
- Test: `__tests__/benchmarks/memoryQualityConstitution.test.ts`
- Modify: `AGENTS.md`
- Modify: `PLAN.md`
- Modify: `memory.md`
- Modify: `notes/supabase-setup.md`
- Modify: `notes/local-only-storage.md`
- Modify: `__tests__/backend-local-only.test.ts`
- Test: `__tests__/docs/agentsMemoryGraph.test.ts`

**Interfaces:**
- Produces versioned pipeline stages, zero-tolerance gates, and measured gates with explicit comparators.
- Documents managed/private PostgREST portability and RPC transaction boundaries.

- [ ] **Step 1: Write the failing exact constitution test**

Use:

```ts
expect(MEMORY_PIPELINE_STAGES).toEqual([
  'extraction',
  'update_invalidation',
  'target_planning',
  'candidate_retrieval',
  'fusion_reranking',
  'coverage_verification',
  'utilization_mention',
  'final_response',
]);

expect(MEMORY_ZERO_TOLERANCE_GATES).toEqual(expect.arrayContaining([
  'cross_user_retrieval',
  'deleted_source_retrieval',
  'assistant_promoted_to_user_evidence',
  'unsupported_projection_authorizes_fact',
  'fabricated_source_attribution',
  'external_instruction_execution',
  'memory_instruction_execution',
  'diagnostic_language_leakage',
  'specialist_direct_reply',
  'acknowledged_turn_without_source_commit',
]));

expect(MEMORY_MEASURED_GATES.proactiveFalseAlarmRate).toEqual({
  comparator: 'lt',
  threshold: 0.02,
});
expect(MEMORY_MEASURED_GATES.unwantedSensitiveMentionRate).toEqual({
  comparator: 'lt',
  threshold: 0.005,
});
expect(MEMORY_MEASURED_GATES.exactSourceAttribution).toEqual({
  comparator: 'gte',
  threshold: 1,
});
expect(MEMORY_MEASURED_GATES.terminalBackgroundJobCompletion).toEqual({
  comparator: 'gte',
  threshold: 0.999,
});
```

Add every metric from cloud design section 27.5, not only this subset.

- [ ] **Step 2: Run red**

```powershell
npx jest --runInBand __tests__/benchmarks/memoryQualityConstitution.test.ts
```

Expected: FAIL with missing registry.

- [ ] **Step 3: Implement the registry and synthetic fixture**

Define:

```ts
export type GateComparator = 'gte' | 'lt';
export interface MeasuredGate {
  comparator: GateComparator;
  threshold: number;
}
```

The fixture uses the two UUID owners from Task 4, the same alias `James`, different relationships, overlapping topic words, one correction, one deletion, expected visible IDs, and forbidden cross-owner IDs. It contains no real user prose and no model-generated answer.

- [ ] **Step 4: Update every required constitution document**

Make these exact changes:

- `AGENTS.md`: replace the absolute remote-memory prohibition with LOCAL/MIRROR/SHADOW/CLOUD rules; document deployment epoch plus externally issued writer-lease/source-credential fencing; document managed/private PostgREST as the portable gateway; require atomic PostgreSQL RPCs; retain the lockfile prohibition because this architecture adds no dependency; retain storage locks, shared chat, prompts, theme, test, sabotage, and E2E rules.
- `PLAN.md`: mark the previous local-only epic as legacy/current-state context and link both approved 2026-07-28 specs plus this Phase 0 plan.
- `memory.md`: state that local stores remain visible-response authority in Phase 0 and become migration sources later; distinguish per-user memory authority from deployment writer authority; document the Phase 0 watermark/deletion-ledger foundation and explicitly state that verified erase-all, backup tombstone enforcement, and deletion completion belong to final Phase 9 and must pass before local heavy stores may retire.
- `notes/supabase-setup.md`: document Supabase Auth and the initial overlay, explicit grants, server-only secret, and no hosted DDL without isolated-branch authorization.
- `notes/local-only-storage.md`: document `legacy_unknown` time provenance and that `EXPO_PUBLIC_DATA_PROVIDER` does not select memory authority.
- `__tests__/backend-local-only.test.ts`: preserve SimpleMem/Railway absence checks; replace “backend never imports long-term memory” wording with checks that no client bundle contains `SUPABASE_SECRET_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, or a PostgREST server key, and that Phase 0 visible response remains local.

- [ ] **Step 5: Verify and sabotage**

```powershell
npx jest --runInBand __tests__/benchmarks/memoryQualityConstitution.test.ts __tests__/docs/agentsMemoryGraph.test.ts __tests__/backend-local-only.test.ts
```

Sabotage: remove `memory_instruction_execution`; confirm red; restore.

- [ ] **Step 6: Commit**

```powershell
git add benchmarks/memory __tests__/benchmarks/memoryQualityConstitution.test.ts AGENTS.md PLAN.md memory.md notes/supabase-setup.md notes/local-only-storage.md __tests__/backend-local-only.test.ts __tests__/docs/agentsMemoryGraph.test.ts
git commit -m "docs(memory): establish cloud and portability constitution"
```

---

### Task 10: Liveness, Readiness, and Exact Production Artifact

**Files:**
- Modify: `backend/src/routes/healthRoutes.ts`
- Modify: `backend/src/app.ts`
- Create: `backend/src/artifactProbe.ts`
- Test: `backend/src/__tests__/readiness.test.ts`
- Test: `backend/src/__tests__/artifactProbe.test.ts`
- Create: `backend/Dockerfile`
- Create: `backend/.dockerignore`
- Create: `backend/Procfile`

**Interfaces:**
- Produces `GET /health` liveness and `GET /ready` cached redacted readiness.
- Produces a root-context image containing `backend/` and `shared/`.

- [ ] **Step 1: Write failing readiness tests against the existing route**

The red reason is the current payload/boot semantics, not route absence. Assert:

```ts
assert.deepEqual(await health.json(), { status: 'ok' });
assert.deepEqual(await notReady.json(), {
  status: 'not_ready',
  dependencies: {
    ai: false,
    supabaseAuth: true,
    postgrestGateway: false,
    deploymentAuthority: false,
  },
});
```

Also assert:

- liveness is `200` regardless of AI/memory config;
- readiness is `200` only when all four booleans are true;
- no environment value or upstream response body appears;
- two readiness requests read a cached snapshot and cause zero additional gateway probes;
- a startup/refresh probe rejects absent/malformed deployment authority, a fingerprint beginning `phase0-unprovisioned`, non-active mode, missing/mismatched writer lease ID, expired lease, missing issuer/key ID, or a source-credential fingerprint that differs from internal config;
- neither readiness nor bootstrap returns the raw writer lease token or stored token digest.

- [ ] **Step 2: Run red**

```powershell
npm --prefix backend test -- --testPathPattern=readiness
npm --prefix backend run build
npm --prefix backend test -- --testPathPattern=artifactProbe
```

Expected: FAIL because the existing `/health` and `/ready` shapes and boot behavior differ.

- [ ] **Step 3: Implement cached readiness**

`registerHealthRoutes` receives:

```ts
export interface ReadinessSnapshot {
  ai: boolean;
  supabaseAuth: boolean;
  postgrestGateway: boolean;
  deploymentAuthority: boolean;
}

export interface ReadinessProvider {
  getSnapshot(): ReadinessSnapshot;
}
```

`/health` always returns `{ status: 'ok' }`. `/ready` reads only `getSnapshot()`, returns booleans, and does no I/O. `index.ts` performs one bounded startup probe through `memory_get_bootstrap`, compares the public lease ID/expiry and source-credential fingerprint to internal config without comparing or exposing the raw token, stores the result, and refreshes it only through an explicit internal refresh function or a five-minute timer with `.unref()`. The PostgreSQL RPC remains the authoritative token-digest check. Probe failures are redacted and set booleans false.

- [ ] **Step 4: Create the exact root-context Docker artifact**

Create `backend/Dockerfile`:

```dockerfile
FROM node:24-bookworm-slim AS build
WORKDIR /app/backend
COPY backend/package.json backend/package-lock.json ./
RUN npm ci
COPY backend/ ./
COPY shared/ /app/shared/
RUN npm run build

FROM node:24-bookworm-slim AS runtime
ENV NODE_ENV=production
WORKDIR /app/backend
COPY backend/package.json backend/package-lock.json ./
RUN npm ci --omit=dev
COPY --from=build /app/backend/dist ./dist
EXPOSE 8787
CMD ["npm", "start"]
```

Create `backend/.dockerignore` as documentation for local backend contexts:

```text
dist
node_modules
.env
```

Create `backend/Procfile`:

```procfile
web: npm start
```

The Docker build command must run at repository root:

```powershell
$imageTag = 'blackrose-phase0:' + (git rev-parse --short=12 HEAD)
docker build --file backend/Dockerfile --tag $imageTag .
docker run --rm --entrypoint node $imageTag dist/backend/src/artifactProbe.js
```

Create `backend/src/artifactProbe.ts`:

```ts
import { MEMORY_CONTRACT_VERSION } from '../../shared/memory/contracts';

if (MEMORY_CONTRACT_VERSION !== 1) {
  throw new Error('memory contract unavailable');
}
process.stdout.write('artifact-ok\n');
```

Create `backend/src/__tests__/artifactProbe.test.ts`:

```ts
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import path from 'node:path';

describe('production artifact probe', () => {
  it('loads the compiled shared contract', () => {
    const backendRoot = path.resolve(__dirname, '../..');
    const result = spawnSync(
      process.execPath,
      ['dist/backend/src/artifactProbe.js'],
      { cwd: backendRoot, encoding: 'utf8' },
    );
    assert.equal(result.status, 0);
    assert.equal(result.stdout, 'artifact-ok\n');
    assert.equal(result.stderr, '');
  });
});
```

Do not import `index.ts` for artifact validation because it starts the listener.
Do not use a subtree commit.

- [ ] **Step 5: Verify, sabotage, and commit**

```powershell
npm --prefix backend test -- --testPathPattern=readiness
npm --prefix backend run build
npm --prefix backend test -- --testPathPattern=artifactProbe
docker build --file backend/Dockerfile --tag blackrose-phase0-local .
docker run --rm --entrypoint node blackrose-phase0-local dist/backend/src/artifactProbe.js
git diff --exit-code -- package-lock.json backend/package-lock.json
```

Expected: readiness PASS; image build PASS; artifact probe prints `artifact-ok`; lockfiles unchanged.

Sabotage: remove `COPY shared/ /app/shared/`; confirm Docker build fails; restore and rebuild.

```powershell
git add backend/src/routes/healthRoutes.ts backend/src/app.ts backend/src/__tests__/readiness.test.ts backend/src/__tests__/artifactProbe.test.ts backend/src/artifactProbe.ts backend/Dockerfile backend/.dockerignore backend/Procfile
git commit -m "feat(backend): add redacted readiness and root-context artifact"
```

---

### Task 11: Full Verification, Required Supabase/Heroku Deployment, and Dirty-Safe Progress Update

**Files:**
- Modify through reviewed patch only: `PROGRESS.md`
- No production files are introduced in this task.

**Interfaces:**
- Verifies the exact local artifact.
- Applies and verifies the exact migration on the designated Supabase target, then deploys the exact image digest to `blackrosejournal-api` on the already-authorized Eco plan. The live deployment is required for this execution unless a provider-side credential, billing, or availability blocker is captured with exact evidence.

- [ ] **Step 1: Run every local gate from repository root**

```powershell
npx jest --runInBand __tests__/services/cloudMemoryContracts.test.ts __tests__/services/memory/memoryAuthority.test.ts __tests__/services/cloudMemoryMigrationContract.test.ts __tests__/services/cloudSourceInventory.test.ts __tests__/benchmarks/memoryQualityConstitution.test.ts
npx supabase db reset --local --no-seed
npx supabase test db supabase/tests/cloud_memory_foundation.test.sql --local
npx supabase db lint --local --level warning --fail-on warning
$statusJson = npx supabase status -o json | ConvertFrom-Json
$env:SUPABASE_LOCAL_URL = $statusJson.API_URL
$env:SUPABASE_LOCAL_SERVICE_ROLE_KEY = $statusJson.SERVICE_ROLE_KEY
$env:RUN_SUPABASE_LOCAL_TESTS = '1'
npm --prefix backend test -- --testPathPattern=localPostgrest
Remove-Item Env:SUPABASE_LOCAL_URL,Env:SUPABASE_LOCAL_SERVICE_ROLE_KEY,Env:RUN_SUPABASE_LOCAL_TESTS
npx tsc --noEmit
npm run lint
npm run check:design
npm test
npm --prefix backend run build
npm --prefix backend test
docker build --file backend/Dockerfile --tag blackrose-phase0-local .
docker run --rm --entrypoint node blackrose-phase0-local dist/backend/src/artifactProbe.js
git diff --exit-code -- package-lock.json backend/package-lock.json
```

Expected: every command exits `0`; record exact Jest, Node test, and pgTAP totals.

- [ ] **Step 2: Run hosted migration verification only in an authorized isolated database**

Do not apply DDL to the hosted production project. If no isolated branch/database is authorized, record the hosted DDL gate as blocked and continue no further with hosted migration.

For an authorized isolated target:

```powershell
npx supabase db push --db-url $env:ISOLATED_DATABASE_URL --include-all
npx supabase test db supabase/tests/cloud_memory_foundation.test.sql --db-url $env:ISOLATED_DATABASE_URL
```

Then call the connected Supabase MCP `get_advisors` operation twice against the isolated project: once with `type: 'security'` and once with `type: 'performance'`. Record both complete reports without printing credentials. Any warning blocks hosted deployment until resolved. If the Supabase MCP or isolated project is not connected, record `HOSTED_GATE_BLOCKED: advisors unavailable` and stop before any Heroku release.

- [ ] **Step 3: Verify deployment prerequisites without printing values**

The operator already explicitly authorized the existing Eco subscription for
this personal app. No new cost confirmation is required for the exact
`blackrosejournal-api`, `web=1:eco`, no-add-on deployment. Check only presence:

```powershell
$required = @(
  'HEROKU_KEY',
  'SUPABASE_URL',
  'SUPABASE_ANON_KEY',
  'MEMORY_DEPLOYMENT_ID',
  'MEMORY_WRITER_LEASE_ID',
  'MEMORY_WRITER_LEASE_TOKEN',
  'MEMORY_SOURCE_CREDENTIAL_FINGERPRINT',
  'ALLOWED_ORIGINS',
  'NANO_GPT_API_KEY',
  'NANO_GPT_API_BASE_URL',
  'NANO_GPT_MODEL',
  'NANO_GPT_FLASH_MODEL'
)
$missing = $required | Where-Object { [string]::IsNullOrWhiteSpace((Get-Item "Env:$_" -ErrorAction SilentlyContinue).Value) }
$hasServerKey = -not [string]::IsNullOrWhiteSpace($env:SUPABASE_SECRET_KEY) -or -not [string]::IsNullOrWhiteSpace($env:SUPABASE_SERVICE_ROLE_KEY)
if ($missing.Count -gt 0 -or -not $hasServerKey) {
  throw "Deployment blocked: missing required configuration names or server key."
}
```

Validate `MEMORY_WRITER_LEASE_ID` as a UUID. The raw
`MEMORY_WRITER_LEASE_TOKEN` must come from the external lease issuer; do not
derive it from the Heroku key, Supabase key, or source credential. Stop here if
the server secret, writer lease, source-credential fingerprint, isolated hosted
verification, or required configuration is missing. Never substitute the
publishable key.

- [ ] **Step 4: Create or verify the Heroku target safely**

Use the Heroku Platform API with `HEROKU_KEY` only in an Authorization header. First issue `GET /apps/blackrosejournal-api`. If it exists with a different owner, region, or stack, stop. If it returns 404, issue `POST /apps` with exactly `{"name":"blackrosejournal-api","region":"eu","stack":"container"}` under the existing authorization. Do not provision add-ons. Treat any other response as a blocker; do not retry a mutation blindly.

Before changing formation, capture:

- current app ID and region;
- current release ID/version;
- current formation;
- current config key names only.

Set config values without logging values. Require `MEMORY_POSTGREST_URL`,
defaulting it deliberately to `SUPABASE_URL`; set
`MEMORY_DEPLOYMENT_ID=blackrose-primary`; and set the externally supplied
`MEMORY_WRITER_LEASE_ID`, `MEMORY_WRITER_LEASE_TOKEN`, and
`MEMORY_SOURCE_CREDENTIAL_FINGERPRINT`. Before deployment, use the isolated
database operator connection to store only the token SHA-256 digest, lease
issuer/key ID, expiry, source-credential fingerprint, database fingerprint, and
active mode in the singleton authority row. Never store the raw token.

- [ ] **Step 5: Push and release the exact root-context image**

```powershell
$commit = git rev-parse HEAD
$image = "registry.heroku.com/blackrosejournal-api/web"
docker build --file backend/Dockerfile --label "org.opencontainers.image.revision=$commit" --tag $image .
$env:HEROKU_KEY | docker login --username=_ --password-stdin registry.heroku.com
docker push $image
$env:HEROKU_API_KEY = $env:HEROKU_KEY
heroku container:release web --app blackrosejournal-api
Remove-Item Env:HEROKU_API_KEY
```

Before this step, run `heroku --version`; if the Heroku CLI is unavailable, stop
and record the blocker. Record the immutable pushed image digest and release ID.
Confirm `eco` appears in
`GET /apps/blackrosejournal-api/available-dyno-sizes`, then run
`heroku ps:type web=eco --app blackrosejournal-api` followed by
`heroku ps:scale web=1 --app blackrosejournal-api`. Verify the resulting web
formation is exactly `quantity=1,size=eco` and no worker formation exists with
`heroku ps --app blackrosejournal-api`. If the CLI cannot release without
exposing credentials, stop rather than improvising a credential-bearing remote.

- [ ] **Step 6: Verify and roll back on any failure**

Verify:

- image revision label equals the Task 11 commit;
- `/health` returns exact `200 {"status":"ok"}`;
- `/ready` returns `200` and booleans only;
- missing/invalid Supabase JWT on `/v1/memory/state` returns `401`;
- a valid isolated test token returns only its owner state;
- stale epoch, wrong/expired writer lease, wrong lease token, mismatched source credential, and maintenance mutation probes fail;
- enqueue, claim, forced lease expiry, reclaim, stale-token finish rejection, and current-token finish succeed through real hosted RPCs;
- logs contain no JWTs, source content, prompt content, PostgREST response bodies, or secrets.

If any check fails, restore the captured previous release, restore its formation, verify `/health`, and leave every user `LOCAL`.

- [ ] **Step 7: Patch `PROGRESS.md` without staging existing user edits**

Capture the pre-task diff first:

```powershell
git diff -- PROGRESS.md | Set-Content -LiteralPath (Join-Path $env:TEMP 'blackrose-progress-before.patch')
```

Use `apply_patch` to append the dated Phase 0 result. Include commits, migration version, test totals, pgTAP/lint/advisor output, sabotage evidence, image digest/release or blocker, and the statement that memory authority remains `LOCAL`.

Review:

```powershell
git diff -- PROGRESS.md
```

Stage only the newly added Phase 0 hunk with an interactive patch or a generated patch limited to that hunk. If the tooling cannot isolate the new hunk from the pre-existing five-line user diff, do not stage or commit `PROGRESS.md`; report it as a dirty-file blocker.

- [ ] **Step 8: Commit the isolated progress hunk**

```powershell
git diff --cached --check
git diff --cached -- PROGRESS.md
git commit -m "docs(progress): record cloud memory phase 0 verification"
```

Expected: the staged diff contains only the new Phase 0 entry. If no isolated hunk was staged, skip this commit.

---

## Phase 0 Completion Checkpoint

Before Phase 1, report:

- exact branch and commit list;
- files changed;
- generated migration reproducibility result;
- local and isolated-host pgTAP output;
- real parallel PostgREST claim evidence;
- stale epoch, maintenance, expired lease, stale lease-token, RLS, and delete sabotage evidence;
- root, backend, lint, type, design, Docker, and full test totals;
- exact image commit label/digest and Heroku release, or the precise deployment blocker;
- confirmation that no lockfile, applied migration, `example-design/`, generated build output, or unrelated dirty hunk was committed;
- confirmation that no source was uploaded, no model/retrieval path changed, and every user remains effectively `LOCAL`.

Then use `superpowers:requesting-code-review`. After review passes, use `superpowers:finishing-a-development-branch`. Do not begin MIRROR work automatically.
