# Cloud Memory Phase 9 Portability and Disaster-Recovery Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** After completed Phase 0 and Phases 1–8, make Rosebud's authoritative PostgreSQL memory recoverable across Supabase, Heroku, a Windows laptop, and the documented managed PostgreSQL destinations while preserving one externally leased writer, deletion history, owner isolation, and verifiable rollback. Phase 9 is the final delivery phase and the only phase that may authorize local heavy-store retirement.

**Architecture:** Canonical application migrations live under `db/migrations/core`; Supabase and bare-PostgreSQL behavior is supplied by narrow overlays under `db/overlays`. The backend verifies Supabase sessions, exchanges them for short-lived internal PostgREST JWTs, and presents an externally signed writer lease to every mutating RPC. Portable tooling creates a snapshot-consistent, application-data-only, signed and encrypted backup set, restores only into a newly created marked database, replays the independent deletion ledger, verifies the destination, and performs cutover or rollback through fresh targets rather than merging into retained stale databases.

**Tech Stack:** Node.js 24 and built-in `node:crypto`, TypeScript 5.9, Express 4, PostgreSQL 17-compatible client tools, PostgREST 14.16, Supabase CLI 2.72.8, age 1.3.1, Windows PowerShell 5.1 bootstrap plus PowerShell 7 runtime scripts, Jest, Node test runner, pgTAP, and Playwright. No npm dependency or lockfile change is permitted.

## Global Constraints

- The approved portability source of truth is `docs/superpowers/specs/2026-07-28-rosebud-backend-database-portability-design.md`; the Phase 8/9 boundary is controlled by `docs/superpowers/plans/2026-07-28-cloud-memory-master-roadmap.md` and `docs/superpowers/specs/2026-07-29-portability-final-phase-sequencing-design.md`.
- Phase 0 is complete, and Phases 1–8 execute before this plan. Task 1 revalidates the completed Phase 0 contracts, routes, jobs, migrations, Supabase local stack, and review evidence before any Phase 9 portability mutation, provider change, or retirement work begins.
- Phase 8 may stage CLOUD authority, but it retains complete local memory sources read-only. Only Phase 9 may authorize local heavy-store retirement after every gate in this plan passes.
- A Phase 9 failure blocks heavy local-store retirement and activation of any alternate provider or second writer; the healthy Supabase service may remain active under the user's current valid authority, and full local sources stay retained.
- Exactly one unexpired externally signed writer lease may authorize mutations. A database-local epoch is not a sufficient fence.
- Every mutating RPC checks deployment ID, decimal-string writer epoch converted to `bigint`, lease ID, SHA-256 lease-token digest, lease expiry, database mode, and source-credential fingerprint in the same transaction as the mutation.
- Planned cutover revokes the source writer credential or applies provider-level read-only fencing before the final snapshot. Emergency cutover waits for the old external lease to expire unless independent fencing is proven.
- Generic PostgREST accepts only short-lived internal JWTs minted by the backend. It never receives a Supabase refresh token or a Supabase secret key.
- Generic roles are `rosebud_authenticator` (`LOGIN`, no inheritance), `rosebud_user` and `rosebud_worker` (`NOLOGIN`, `NOBYPASSRLS`), plus a non-login schema owner. Canonical memory tables use `FORCE ROW LEVEL SECURITY`.
- The canonical database contains no foreign key to `auth.users`, no `auth.uid()` default, and no dependency on `anon`, `authenticated`, or `service_role`.
- Supabase-specific Auth helpers, role grants, and managed-PostgREST integration exist only in `db/overlays/supabase`.
- Bare PostgreSQL roles, claim helpers, RLS policies, and PostgREST grants exist only in `db/overlays/generic`.
- Backups contain canonical Rosebud application schemas/data only. Supabase-owned `auth`, `storage`, realtime, extension-administration, and provider schemas are excluded.
- The custom archive, schema inspection SQL, counts, hashes, migration ledger, authority watermark, and deletion watermark must describe one PostgreSQL snapshot.
- Every restore target is newly created, empty, and marked with its operation UUID. Failed or interrupted restore targets are abandoned and a new database is created.
- Rollback restores a complete destination snapshot into a fresh target. It never applies an ad hoc delta to the retained stale source.
- The independent deletion receipt stream is hash chained, signed, encrypted, exported after deletion, and replayed after every restore.
- Backup manifests, deletion bundles, endpoint documents, writer leases, and verification reports use distinct Ed25519 keys. Private keys live outside the repository, backend slug, database, backup payload, and endpoint profile.
- All backup and report output defaults outside the repository. Repository-local report and artifact patterns are ignored and rejected by a Git-index guard.
- Commands use argument arrays and environment allowlists, never shell strings. Logs never contain journal prose, embeddings, JWTs, passwords, connection URLs, private keys, or lease tokens.
- No state-changing command accepts only a provider label. It requires a live database fingerprint, deployment ID, operation UUID, and explicit expected mode.
- Destructive cleanup requires both an operation-specific database name and a matching database marker. A name prefix alone is never sufficient.
- Provider teardown is manual and absent from the migration command surface.
- Static documentation validation cannot mark a provider `verified`; only a real report ID and report hash can.
- Real PostgreSQL, PostgREST, Auth, backup, restore, interruption, restart, endpoint, canary, deletion-replay, rollback, and recall drills are mandatory.
- Every red/green or sabotage claim is captured by `run-with-evidence.mjs` with commit, command array, exit status, failure category, timestamps, redacted output hash, and restored passing report.
- Never touch lockfiles, applied migrations, `example-design/`, generated build output, or unrelated dirty files.

## File Structure

### Tooling and evidence

- Modify `backend/scripts/run-tests.js` to normalize paths and fail when no test matches.
- Modify `.gitignore` to exclude portability artifacts, reports, decrypted dumps, key files, and tool caches.
- Create `ops/portability/tool-versions.json`.
- Create `scripts/portability/Bootstrap-RosebudTools.ps1`.
- Create `scripts/portability/run-with-evidence.mjs`.
- Create `scripts/portability/assert-phase0-ready.mjs`.
- Create `scripts/portability/safe-target.mjs`.

### Database

- Move the verified Phase 0 canonical migration source to `db/migrations/core/0001_memory_foundation.sql`.
- Create `db/migrations/core/0002_portability_control.sql`.
- Create `db/migrations/core/0003_deletion_receipts.sql`.
- Create `db/overlays/supabase/0001_memory_supabase.sql`.
- Create `db/overlays/generic/0001_memory_generic.sql`.
- Create `db/overlays/generic/postgrest.conf.template`.
- Create `scripts/portability/apply-database.mjs`.
- Populate the CLI-generated additive migrations `supabase/migrations/20260728120938_memory_portability_authority.sql`, `supabase/migrations/20260728123338_memory_writer_authority.sql`, and `supabase/migrations/20260728123342_memory_backup_schedule.sql`; do not edit an applied migration.
- Create pgTAP tests under `supabase/tests/database/`.

### Backend portability

- Create focused modules under `backend/src/memory/portability/` for runtime config, subprocesses, leases, manifests, artifact signing/encryption, snapshot backup, deletion export/replay, restore, verification, cutover state, scheduling, and CLI dispatch.
- Create `backend/src/memory/auth/internalGatewayJwt.ts`, `backend/src/memory/auth/internalJwks.ts`, and `backend/src/memory/auth/signedBootstrap.ts`.
- Create `backend/src/memory/routes/portabilityCanaryRoutes.ts`.
- Modify the Phase 0 memory transport/routes so all generic requests use internal JWTs and all writes use versioned RPCs.
- Create `backend/src/portableMain.ts` so `migration-verify` never imports or starts the HTTP listener.

### Runtime and application

- Modify the Phase 0 `backend/Dockerfile` and `backend/Procfile`; create sidecar build/supervision scripts under `backend/scripts/portability/`.
- Create Windows scripts under `scripts/portability/`.
- Create endpoint-profile service, hook, and settings component under the existing UI → hook → service boundary.
- Vendor only `tweetnacl` 1.0.3's audited `nacl-fast.js` and license under `services/crypto/vendor/tweetnacl/`, with npm SRI `sha512-6rt+RN7aOi1nGMyC4Xa5DdYiukl2UWCbcJft7YhxReBGQD7OAM8Pbxw6YMo4r2diNEA8FEmu32YOn9rhaiE5yw==`; do not add it to `package.json`.

### Operations

- Create eight provider descriptors, eight runbooks, one canonical protocol, seven agent wrappers, a scheduler runbook, and machine-readable support evidence.
- Store committed examples with synthetic identifiers only. Real reports and backup artifacts stay outside Git.

---

### Task 0: Safe Test Runner, Tool Bootstrap, Evidence Runner, and Artifact Denylist

**Files:**
- Modify: `backend/scripts/run-tests.js`
- Modify: `.gitignore`
- Create: `ops/portability/tool-versions.json`
- Create: `scripts/portability/Bootstrap-RosebudTools.ps1`
- Create: `scripts/portability/run-with-evidence.mjs`
- Create: `scripts/portability/verify-vendored-crypto.mjs`
- Test: `backend/src/__tests__/testRunner.test.ts`
- Test: `__tests__/services/portabilityArtifactGuard.test.ts`

**Interfaces:**
- `backend/scripts/run-tests.js --testPathPattern=<pattern>` normalizes `\` to `/` and exits `2` when zero files match.
- `run-with-evidence.mjs --operation <uuid> --phase <name> --expect pass|fail --report-dir <absolute-path> -- <exe> <args...>` writes one redacted JSON report plus a `.sha256` file.
- `Bootstrap-RosebudTools.ps1 -ToolRoot <absolute-path> -WhatIf` runs in Windows PowerShell 5.1 and installs only PostgREST/age archives whose downloaded bytes match the registry.

- [ ] **Step 1: Write failing runner and artifact-guard tests**

Assert Windows-style discovered paths match POSIX-style patterns, a missing pattern exits `2`, secrets are redacted before report persistence, report output inside the repository is rejected, and Git-tracked files cannot match:

```text
*.age
*.dump
*.sql.plain
*.identity
*.private.pem
*.lease
ops/portability/reports/*
ops/portability/artifacts/*
```

- [ ] **Step 2: Run red**

```powershell
npm --prefix backend test -- --testPathPattern=portability/does-not-exist
npx jest --runInBand __tests__/services/portabilityArtifactGuard.test.ts
```

Expected: the backend command currently exits `0` after matching nothing, and the root guard is missing.

- [ ] **Step 3: Add the exact registry**

`ops/portability/tool-versions.json` must contain:

```json
{
  "schemaVersion": 1,
  "node": { "major": 24 },
  "npm": { "major": 11 },
  "supabaseCli": { "version": "2.72.8" },
  "postgresClient": { "minimumMajor": 17, "downloadedByBootstrap": false },
  "postgrest": {
    "version": "14.16",
    "windowsX64": {
      "asset": "postgrest-v14.16-windows-x86-64.zip",
      "url": "https://github.com/PostgREST/postgrest/releases/download/v14.16/postgrest-v14.16-windows-x86-64.zip",
      "sha256": "2f13f2ad54d44bcb9d0ec5c2bde111477349979cf17c70e3b69b25f59ceeb192"
    },
    "linuxX64": {
      "asset": "postgrest-v14.16-linux-static-x86-64.tar.xz",
      "url": "https://github.com/PostgREST/postgrest/releases/download/v14.16/postgrest-v14.16-linux-static-x86-64.tar.xz",
      "sha256": "36b8ae140f188cfcd6003494805bf35a41e895f88c12be9183d60f91782145c6"
    }
  },
  "age": {
    "version": "1.3.1",
    "windowsX64": {
      "asset": "age-v1.3.1-windows-amd64.zip",
      "url": "https://github.com/FiloSottile/age/releases/download/v1.3.1/age-v1.3.1-windows-amd64.zip",
      "sha256": "c56e8ce22f7e80cb85ad946cc82d198767b056366201d3e1a2b93d865be38154"
    },
    "linuxX64": {
      "asset": "age-v1.3.1-linux-amd64.tar.gz",
      "url": "https://github.com/FiloSottile/age/releases/download/v1.3.1/age-v1.3.1-linux-amd64.tar.gz",
      "sha256": "bdc69c09cbdd6cf8b1f333d372a1f58247b3a33146406333e30c0f26e8f51377"
    }
  },
  "tweetnacl": {
    "version": "1.0.3",
    "tarball": "https://registry.npmjs.org/tweetnacl/-/tweetnacl-1.0.3.tgz",
    "integrity": "sha512-6rt+RN7aOi1nGMyC4Xa5DdYiukl2UWCbcJft7YhxReBGQD7OAM8Pbxw6YMo4r2diNEA8FEmu32YOn9rhaiE5yw=="
  }
}
```

Bootstrap downloads into a fresh operation directory, hashes before extraction, rejects redirects away from `github.com`/`objects.githubusercontent.com`, and atomically renames the verified tool directory. It never downloads PostgreSQL: absent or incompatible `psql`, `pg_dump`, or `pg_restore` exits `78` with the missing executable names.

- [ ] **Step 4: Implement evidence reports**

Reports use:

```ts
interface CommandEvidenceReport {
  schemaVersion: 1;
  operationId: string;
  phase: string;
  commit: string;
  command: readonly string[];
  startedAt: string;
  finishedAt: string;
  exitStatus: number;
  expected: 'pass' | 'fail';
  observed: 'pass' | 'fail';
  failureCategory: string | null;
  redactedOutputSha256: string;
}
```

The runner rejects report directories inside the Git worktree, caps captured stdout/stderr at 64 KiB each, and never persists raw output.

- [ ] **Step 5: Run green and sabotage**

Use an external directory:

```powershell
$evidence = Join-Path $env:LOCALAPPDATA "Rosebud\portability-evidence"
node scripts/portability/run-with-evidence.mjs --operation 00000000-0000-4000-8000-000000000001 --phase runner-green --expect pass --report-dir $evidence -- node --version
npm --prefix backend test -- --testPathPattern=testRunner
npx jest --runInBand __tests__/services/portabilityArtifactGuard.test.ts
```

Temporarily restore the old zero-match exit behavior, capture the expected failing runner test through `run-with-evidence`, restore the fix, and capture the passing report.

- [ ] **Step 6: Commit**

```powershell
git add .gitignore backend/scripts/run-tests.js backend/src/__tests__/testRunner.test.ts ops/portability/tool-versions.json scripts/portability/Bootstrap-RosebudTools.ps1 scripts/portability/run-with-evidence.mjs scripts/portability/verify-vendored-crypto.mjs __tests__/services/portabilityArtifactGuard.test.ts
git commit -m "test(memory): make portability evidence fail closed"
```

### Task 1: Revalidate Completed Phase 0 Evidence

**Files:**
- Create: `scripts/portability/assert-phase0-ready.mjs`
- Test: `__tests__/services/phase0PortabilityGate.test.ts`

**Interfaces:**
- `assert-phase0-ready.mjs --mode static|real --report-dir <absolute-path>` exits `78` for missing prerequisites and `1` for a failing required check.
- Later tasks consume its signed-off `phase0-ready.json` report hash.

- [ ] **Step 1: Write the Phase 0 evidence revalidation gate test**

The static gate requires non-empty:

```text
shared/memory/contracts.ts
shared/memory/deploymentAuthority.ts
backend/src/memory/gateway/postgrestGateway.ts
backend/src/memory/routes/memoryRoutes.ts
backend/src/memory/repositories/jobRepository.ts
supabase/config.toml
supabase/migrations/20260728144157_cloud_memory_foundation_20260728112723.sql
supabase/tests/cloud_memory_foundation.test.sql
```

It also requires the Phase 0 report to prove two real Supabase-authenticated users with RLS isolation, transactional stale-epoch and expired-lease rejection, real job reclaim, exact deployment-artifact health, and an independent review with no critical/important issue. Internal gateway JWT evidence is intentionally excluded here because Task 4 creates it.

- [ ] **Step 2: Revalidate the completed Phase 0 static evidence**

```powershell
$evidence = Join-Path $env:LOCALAPPDATA "Rosebud\portability-evidence"
node scripts/portability/run-with-evidence.mjs --operation 00000000-0000-4000-8000-000000000002 --phase phase0-revalidation --expect pass --report-dir $evidence -- node scripts/portability/assert-phase0-ready.mjs --mode static --report-dir $evidence
```

Expected: exit `0` with a signed-off `phase0-ready.json` report hash covering the recorded Phase 0 evidence. A missing or failing prerequisite still fails closed and stops Phase 9, but it does not reopen or resequence the completed Phase 0 delivery phase.

- [ ] **Step 3: Revalidate the exact real Phase 0 gate**

```powershell
npx supabase start
npx supabase db reset --local --no-seed
npx supabase test db supabase/tests/cloud_memory_foundation.test.sql --local
npx supabase db lint --local --level error --fail-on error
npx jest --runInBand __tests__/services/cloudMemoryContracts.test.ts __tests__/services/cloudMemoryMigrationContract.test.ts
npm --prefix backend run build
npm --prefix backend test -- --testPathPattern=memory
node scripts/portability/assert-phase0-ready.mjs --mode real --report-dir $evidence
```

No later task may start unless the final command exits `0`.

- [ ] **Step 4: Commit**

```powershell
git add scripts/portability/assert-phase0-ready.mjs __tests__/services/phase0PortabilityGate.test.ts
git commit -m "test(memory): gate portability on phase zero"
```

### Task 2: Canonical Core Migrations and Supabase/Generic Overlays

**Files:**
- Move: `backend/sql/migrations/0001_memory_foundation.sql` to `db/migrations/core/0001_memory_foundation.sql`
- Move: `backend/sql/overlays/supabase/0001_memory_foundation.sql` to `db/overlays/supabase/0001_memory_supabase.sql`
- Create: `db/migrations/core/0002_portability_control.sql`
- Create: `db/migrations/core/0003_deletion_receipts.sql`
- Create: `db/overlays/generic/0001_memory_generic.sql`
- Create: `db/overlays/generic/postgrest.conf.template`
- Modify: `scripts/build-cloud-memory-migration.mjs`
- Create: `scripts/portability/apply-database.mjs`
- Populate: `supabase/migrations/20260728120938_memory_portability_authority.sql`
- Test: `__tests__/services/portableMigrationContract.test.ts`
- Test: `supabase/tests/database/portable_overlays.test.sql`
- Test: `scripts/portability/Test-CoreMigrations.ps1`

**Interfaces:**
- `apply-database.mjs --db-url-env <name> --overlay supabase|generic --mode apply|verify --operation <uuid>`.
- `public.memory_assert_writer(text,bigint,uuid,text,text)` is called inside every mutating RPC.
- Migration ledger: `public.rosebud_schema_migrations(version text primary key, sha256 text not null, applied_at timestamptz not null)`.

- [ ] **Step 1: Write static and real failing tests**

Static tests reject `auth.`, `auth.uid`, `service_role`, `authenticated`, `anon`, `BYPASSRLS`, and cross-owner foreign keys in `db/migrations/core`. They require every owner-linked foreign key to include `owner_id`.

Real tests apply core plus each overlay to separate fresh PostgreSQL 17 databases and assert:

- identical canonical table/function fingerprints;
- no canonical FK reaches `auth.users`;
- generic runtime roles are `NOBYPASSRLS`;
- every canonical table has RLS enabled and forced;
- user and worker claim helpers read transaction-local JWT claims;
- Supabase and generic overlays expose the same versioned RPC names.

- [ ] **Step 2: Define the canonical migration contents**

`0001_memory_foundation.sql` owns the canonical Phase 0 tables: authority, owner state, source watermarks, conversations, messages, immutable revisions, jobs, job attempts, evidence spans, imports, import chunks, and turn traces.

`0002_portability_control.sql` owns:

```sql
create table public.memory_portability_operations (
  operation_id uuid primary key,
  operation_type text not null,
  state text not null,
  version bigint not null default 1,
  source_fingerprint text not null,
  destination_fingerprint text,
  created_at timestamptz not null,
  updated_at timestamptz not null,
  final_verdict text
);

create table public.memory_portability_events (
  event_id bigint generated always as identity primary key,
  operation_id uuid not null references public.memory_portability_operations(operation_id),
  event_index bigint not null,
  state text not null,
  event_code text not null,
  redacted_details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null,
  unique (operation_id, event_index)
);
```

The operation head is CAS-mutable; events are append-only and update/delete is revoked.

`0003_deletion_receipts.sql` upgrades `memory_deletion_ledger` to include monotonically increasing `receipt_sequence`, `previous_receipt_hash`, `receipt_hash`, `exported_at`, and `backup_key_version`. `memory_record_deletion` computes the chain inside the same transaction as source deletion.

- [ ] **Step 3: Implement overlays**

The generic overlay creates `rosebud_schema_owner`, `rosebud_authenticator`, `rosebud_user`, and `rosebud_worker`; sets `rosebud_user` and `rosebud_worker` to `NOLOGIN NOBYPASSRLS`; grants the authenticator only those roles; forces RLS; and scopes policies with:

```sql
current_setting('request.jwt.claim.owner_id', true)::uuid
```

The Supabase overlay maps verified Supabase subject claims to the same owner UUID and uses only Supabase-specific grants/helpers. The additive Supabase migration contains the same canonical schema hashes and overlay version in `rosebud_schema_migrations`; it never edits an earlier applied migration.

Move the Phase 0 canonical and overlay sources without changing their bytes, update `scripts/build-cloud-memory-migration.mjs` to read the new paths, regenerate into a temporary file, and prove the result byte-matches `supabase/migrations/20260728144157_cloud_memory_foundation_20260728112723.sql`. The historical byte-empty `20260728112723_cloud_memory_foundation.sql` and the applied Phase 0 migration are never rewritten. `20260728120938_memory_portability_authority.sql` contains only `0002`, `0003`, and their Supabase overlay additions.

- [ ] **Step 4: Run real migrations**

```powershell
npx supabase db reset --local --no-seed
npx supabase test db --local supabase/tests/database/portable_overlays.test.sql
npx supabase db lint --local --level error --fail-on error
pwsh -NoProfile -File scripts/portability/Test-CoreMigrations.ps1
```

- [ ] **Step 5: Sabotage forced RLS**

Remove `FORCE ROW LEVEL SECURITY` from the disposable generic fixture only, capture the expected two-role isolation failure, recreate the database from clean SQL, and capture pass evidence.

- [ ] **Step 6: Commit**

```powershell
git add db supabase/migrations/20260728120938_memory_portability_authority.sql supabase/tests/database/portable_overlays.test.sql scripts/build-cloud-memory-migration.mjs scripts/portability/apply-database.mjs scripts/portability/Test-CoreMigrations.ps1 __tests__/services/portableMigrationContract.test.ts
git commit -m "feat(memory): separate portable schema and overlays"
```

### Task 3: External Writer Lease, Authority CAS, and Transactional Canary

**Files:**
- Create: `backend/src/memory/portability/writerLease.ts`
- Create: `backend/src/memory/portability/authorityRepository.ts`
- Create: `backend/src/memory/routes/portabilityCanaryRoutes.ts`
- Create: `backend/src/memory/portability/leaseCli.ts`
- Create: `db/migrations/core/0004_writer_authority.sql`
- Create: `db/overlays/supabase/0002_writer_authority.sql`
- Create: `db/overlays/generic/0002_writer_authority.sql`
- Populate: `supabase/migrations/20260728123338_memory_writer_authority.sql`
- Test: `backend/src/__tests__/portability/writerLease.test.ts`
- Test: `backend/src/__tests__/portability/authorityRepository.test.ts`
- Test: `backend/src/__tests__/portability/portabilityCanaryRoutes.test.ts`
- Test: `supabase/tests/database/portability_authority.test.sql`

**Interfaces:**

```ts
export interface WriterLeasePayload {
  schemaVersion: 1;
  deploymentId: string;
  writerEpoch: string;
  leaseId: string;
  databaseFingerprint: string;
  sourceCredentialFingerprint: string;
  issuedAt: string;
  expiresAt: string;
  keyId: string;
}

export function signWriterLease(
  payload: WriterLeasePayload,
  privateKeyPem: string,
): string;

export function verifyWriterLease(
  compactJws: string,
  publicKeyPem: string,
  now: Date,
): WriterLeasePayload;
```

- [ ] **Step 1: Write failing unit, SQL, and HTTP tests**

Tests cover signature, audience-independent canonical JWS encoding, decimal-string epoch parsing, maximum 24-hour lease duration, wrong database fingerprint, expired lease, stale epoch, token-digest mismatch, source-credential mismatch, and a real HTTP 409 response.

- [ ] **Step 2: Add authority RPCs**

Create:

```sql
public.memory_transition_authority(
  p_expected_deployment_id text,
  p_expected_writer_epoch bigint,
  p_expected_mode text,
  p_next_mode text,
  p_next_deployment_id text,
  p_next_database_fingerprint text,
  p_writer_lease_id uuid,
  p_writer_lease_token_digest text,
  p_writer_lease_expires_at timestamptz,
  p_writer_lease_issuer text,
  p_writer_lease_key_id text,
  p_source_credential_fingerprint text,
  p_reason text
)
```

CAS conflicts raise `PT409` with message `MEMORY_AUTHORITY_CONFLICT`. Invalid transitions raise `PT422`. The RPC locks the singleton row, updates the operation head, and appends an immutable event in one transaction.

Generate `supabase/migrations/20260728123338_memory_writer_authority.sql` deterministically from `0004_writer_authority.sql` plus the Supabase overlay; the generic overlay is tested separately and is not concatenated into the Supabase migration.

- [ ] **Step 3: Add a real canary RPC and route**

Create an owner-scoped canary table with operation UUID, canary UUID, owner UUID, version, nonce hash, created/updated times, and tombstone time. Versioned RPCs `memory_portability_canary_create`, `memory_portability_canary_read`, `memory_portability_canary_edit`, and `memory_portability_canary_delete` enforce owner scope; every mutation calls `memory_assert_writer` in its transaction.

Expose authenticated `POST`, `GET`, `PATCH`, and `DELETE /v1/memory/portability/canary/:id` only when `ROSEBUD_PORTABILITY_DRILL=1`. The routes accept only nonce/hash/version metadata—never journal text. Tests prove create/read/edit/delete, stale-version rejection, tombstone behavior, cross-owner denial, stale/expired lease rejection, and that disabled drill mode returns `404`.

- [ ] **Step 4: Run and sabotage**

```powershell
npm --prefix backend test -- --testPathPattern=portability/writerLease
npm --prefix backend test -- --testPathPattern=portability/authorityRepository
npm --prefix backend test -- --testPathPattern=portability/portabilityCanaryRoutes
npx supabase test db --local supabase/tests/database/portability_authority.test.sql
```

In the disposable SQL fixture only, bypass lease expiry and confirm the expired-lease sabotage fails; recreate cleanly and capture pass evidence.

- [ ] **Step 5: Commit**

```powershell
git add backend/src/memory/portability/writerLease.ts backend/src/memory/portability/authorityRepository.ts backend/src/memory/portability/leaseCli.ts backend/src/memory/routes/portabilityCanaryRoutes.ts backend/src/__tests__/portability supabase/tests/database/portability_authority.test.sql db/migrations/core/0004_writer_authority.sql db/overlays/supabase/0002_writer_authority.sql db/overlays/generic/0002_writer_authority.sql supabase/migrations/20260728123338_memory_writer_authority.sql
git commit -m "feat(memory): fence writes with external leases"
```

### Task 4: Internal Gateway JWTs, Local JWKS, and Private PostgREST

**Files:**
- Create: `backend/src/memory/auth/internalGatewayJwt.ts`
- Create: `backend/src/memory/auth/internalJwks.ts`
- Create: `backend/src/memory/portability/postgrestConfig.ts`
- Modify: `backend/src/memory/db/postgrest.ts`
- Modify: `db/overlays/generic/postgrest.conf.template`
- Test: `backend/src/__tests__/portability/internalGatewayJwt.test.ts`
- Test: `backend/src/__tests__/portability/postgrestConfig.test.ts`
- Create: `scripts/portability/Test-GenericPostgrest.ps1`

**Interfaces:**

```ts
export interface GatewayClaims {
  role: 'rosebud_user' | 'rosebud_worker';
  sub: string;
  owner_id: string;
  deployment_id: string;
  writer_epoch: string;
  writer_lease_id: string;
  aud: 'rosebud-postgrest';
  iat: number;
  exp: number;
}

export function mintGatewayJwt(
  claims: GatewayClaims,
  activePrivateKeyPem: string,
  keyId: string,
): string;
```

User tokens live at most 120 seconds; worker tokens live at most 300 seconds. Old and new public keys overlap for twice the maximum token lifetime.

- [ ] **Step 1: Write failing JWT/config tests**

Assert Supabase access tokens are verified by Phase 0 Auth before exchange; refresh tokens and Supabase secret keys are rejected; internal tokens require `aud`, `role`, `owner_id`, deployment, epoch, lease ID, `iat`, `exp`, and `kid`.

- [ ] **Step 2: Generate exact PostgREST config**

The generated config sets loopback `server-host`, explicit API/admin ports, `db-anon-role = "rosebud_anon"`, `jwt-secret = "@<absolute-jwks-file>"`, role claim `.role`, audience `rosebud-postgrest`, bounded pool size, statement timeout, and disabled public OpenAPI. Secrets enter through `PGRST_DB_URI`; generated config contains no connection URL.

- [ ] **Step 3: Update transports**

Managed Supabase mode retains the Phase 0 managed transport. Generic mode mints an internal user/worker JWT and sends it only as `Authorization: Bearer`; it never sends `apikey`, `sb_secret_`, or the upstream Supabase token to the sidecar.

- [ ] **Step 4: Run a real sidecar test**

```powershell
pwsh -NoProfile -File scripts/portability/Test-GenericPostgrest.ps1
```

The script starts PostgREST 14.16, verifies `Server: postgrest/14.16`, checks private binding plus admin `/ready`, performs two-user reads, rejects cross-owner access, performs leased canary create/read/edit/delete, rotates JWKS with overlap, and proves the expired old key fails after the overlap window.

- [ ] **Step 5: Commit**

```powershell
git add backend/src/memory/auth backend/src/memory/portability/postgrestConfig.ts backend/src/memory/db/postgrest.ts backend/src/__tests__/portability db/overlays/generic/postgrest.conf.template scripts/portability/Test-GenericPostgrest.ps1
git commit -m "feat(memory): authenticate the private data gateway"
```

### Task 5: Signed Bootstrap and Runtime Endpoint Transport

**Files:**
- Create: `backend/src/memory/auth/signedBootstrap.ts`
- Modify: `backend/src/memory/routes/memoryRoutes.ts`
- Create: `services/memory/cloud/memoryBackendTransport.ts`
- Test: `backend/src/__tests__/portability/signedBootstrap.test.ts`
- Test: `__tests__/services/memoryBackendTransport.test.ts`

**Interfaces:**

```ts
export interface BootstrapPayload {
  schemaVersion: 1;
  deploymentId: string;
  writerEpoch: string;
  mode: 'active' | 'maintenance' | 'read_only' | 'retired';
  baseUrl: string;
  databaseFingerprint: string;
  writerLeaseId: string | null;
  writerLeaseExpiresAt: string | null;
  issuedAt: string;
  expiresAt: string;
}

export interface SignedBootstrapDocument {
  payload: BootstrapPayload;
  keyId: string;
  signature: string;
}
```

- [ ] **Step 1: Write failing backend and client-transport tests**

The signature covers RFC 8785-style canonical JSON bytes. Bootstrap lifetime is at most five minutes. The backend reads an endpoint-signing private-key file; it never accepts the key in a URL or response.

- [ ] **Step 2: Implement signing and transport injection**

`memoryBackendTransport.ts` owns the active base URL for every `/v1/memory` request and atomically replaces it after endpoint activation. It obtains the current Supabase access token from the existing auth service at request time and never persists the token in a profile.

- [ ] **Step 3: Run focused tests**

```powershell
npm --prefix backend test -- --testPathPattern=portability/signedBootstrap
npx jest --runInBand __tests__/services/memoryBackendTransport.test.ts
```

- [ ] **Step 4: Commit**

```powershell
git add backend/src/memory/auth/signedBootstrap.ts backend/src/memory/routes/memoryRoutes.ts backend/src/__tests__/portability/signedBootstrap.test.ts services/memory/cloud/memoryBackendTransport.ts __tests__/services/memoryBackendTransport.test.ts
git commit -m "feat(memory): sign backend discovery metadata"
```

### Task 6: Process Runner, Signed Manifest, Snapshot-Consistent Backup, and Deletion Export

**Files:**
- Create: `backend/src/memory/portability/processRunner.ts`
- Create: `backend/src/memory/portability/manifest.ts`
- Create: `backend/src/memory/portability/artifactCrypto.ts`
- Create: `backend/src/memory/portability/snapshotBackup.ts`
- Create: `backend/src/memory/portability/deletionExport.ts`
- Create: `backend/src/memory/portability/portabilityCli.ts`
- Test: `backend/src/__tests__/portability/processRunner.test.ts`
- Test: `backend/src/__tests__/portability/manifest.test.ts`
- Test: `backend/src/__tests__/portability/snapshotBackup.test.ts`
- Test: `backend/src/__tests__/portability/deletionExport.test.ts`
- Create: `scripts/portability/Test-RealBackup.ps1`

**Interfaces:**
- CLI commands: `preflight`, `backup`, `verify-backup`, `export-deletions`.
- `BackupManifest.writerEpoch` and deletion watermarks are decimal strings.
- The backup signer, deletion signer, writer authority, and endpoint authority key IDs must all differ.

- [ ] **Step 1: Write failing process and manifest tests**

Assert shell-free spawn, environment allowlist, 64 KiB bounded capture, Windows descendant termination, timeout code `PROCESS_TIMEOUT`, secret redaction, stable canonical JSON, detached Ed25519 signature, age encryption through file paths, and cleanup of plaintext in `finally`.

- [ ] **Step 2: Define the artifact set**

One backup set contains:

```text
manifest.json.age
manifest.sig
rosebud.dump.age
schema.sql.age
config-template.json.age
deletions-through-<decimal-watermark>.jsonl.age
deletions.sig
checksums.sha256
checksums.sig
```

The plaintext manifest contains content hashes for the dump/schema/config/deletion payloads plus the snapshot ID, source/database/deployment fingerprints, lease/epoch metadata without the token, tool versions, schema/overlay hashes, global/per-owner counts, normalized sample hashes, extension inventory, PostgREST config fingerprint, deletion watermark, recovery timestamp, and restore protocol version. `manifest.sig` signs that plaintext canonical manifest before `manifest.json.age` is produced.

To avoid a circular hash, the manifest does not contain hashes of `manifest.json.age`, `manifest.sig`, `checksums.sha256`, or `checksums.sig`. After all encrypted artifacts and detached signatures exist, `checksums.sha256` covers each of them except the checksum files themselves, and `checksums.sig` signs the canonical checksum file. Verification checks `checksums.sig` first, then ciphertext hashes, then decrypts and verifies `manifest.sig`, then compares the manifest's content hashes to decrypted payloads.

- [ ] **Step 3: Implement one-snapshot backup**

Open one repeatable-read transaction with `pg_export_snapshot()`. Run application-schema/data-only custom dump with `--snapshot`, derive schema inspection SQL from the custom archive, and query counts/hashes/watermarks using the same snapshot. Exclude Supabase-owned schemas explicitly. Abort if any child process cannot use the exported snapshot.

- [ ] **Step 4: Implement independent deletion export**

Export receipts newer than the last exported watermark, verify the chain back to the recorded prior hash, sign and age-encrypt the stream, copy it to two configured absolute destinations, and only then mark receipts exported. One destination must be outside the backend/laptop. No command marks export complete from a single copy.

An `erase_all` receipt also records the erased owner and current backup-key version without content. It initiates per-owner backup-key retirement and creates a purge obligation for every indexed backup set containing that owner. If a shared backup cannot be selectively cryptographically erased, erase-all remains `pending_backup_purge` until both offsite copies are deleted, absence is verified, and a fresh backup excluding the owner is complete. Tests prove the API never reports erase-all complete while an obligated artifact remains.

- [ ] **Step 5: Run the real backup and corruption sabotage**

```powershell
pwsh -NoProfile -File scripts/portability/Test-RealBackup.ps1
```

The script writes concurrent canaries while taking a rehearsal backup and proves manifest counts match the archive snapshot, not a later source state. It mutates one ciphertext byte, captures `verify-backup` failure before decryption, recreates the backup, and captures pass evidence.

- [ ] **Step 6: Commit**

```powershell
git add backend/src/memory/portability backend/src/__tests__/portability scripts/portability/Test-RealBackup.ps1
git commit -m "feat(memory): create signed consistent backups"
```

### Task 7: Fresh-Target Restore, Deletion Replay, and Layered Verifier

**Files:**
- Create: `backend/src/memory/portability/safeTarget.ts`
- Create: `backend/src/memory/portability/restoreService.ts`
- Create: `backend/src/memory/portability/deletionReplay.ts`
- Create: `backend/src/memory/portability/restoreVerifier.ts`
- Create: `scripts/portability/safe-target.mjs`
- Test: `backend/src/__tests__/portability/safeTarget.test.ts`
- Test: `backend/src/__tests__/portability/restoreService.test.ts`
- Test: `backend/src/__tests__/portability/deletionReplay.test.ts`
- Test: `backend/src/__tests__/portability/restoreVerifier.test.ts`
- Create: `scripts/portability/Test-RealRestore.ps1`

**Interfaces:**
- CLI commands: `restore`, `verify-restore`.
- Disposable database names are `rosebud_dr_<32 lowercase hex operation id>_<attempt integer>`.
- Marker table: `public.rosebud_disposable_target(operation_id uuid primary key, attempt integer, created_at timestamptz, source_fingerprint text)`.

- [ ] **Step 1: Write failing target-safety and verifier tests**

Reject an existing database, a missing/mismatched marker, a control connection pointed at the target, a production-like deployment without exact fingerprint confirmation, a destination older than the source, and a `pg_dump` client older than the source.

- [ ] **Step 2: Implement fresh restore**

Create from `template0`, connect, create the marker, apply core plus selected overlay, decrypt to a restricted operation directory, and run:

```text
pg_restore --exit-on-error --single-transaction --no-owner --no-privileges --data-only
```

An interrupted restore marks that attempt failed and creates the next fresh attempt. It never resumes in the partial database.

- [ ] **Step 3: Replay deletion receipts**

Load the newest independent deletion bundle, verify signature, hash chain, and high-watermark, replay receipts newer than the backup watermark, prove deleted source/revisions/projections are absent or ineligible, then create a fresh post-restore backup.

- [ ] **Step 4: Implement all required verifier checks**

The signed report includes artifact, environment, canonical schema, overlay semantic equivalence, global/per-owner counts, ownership/orphans, revisions/tombstones, job/lease/idempotency, content samples, deletion watermark, semantic evidence sets, authenticated API read/write/edit/delete/recall, restart reclaim, and fresh-target rollback readiness. Any required failure makes the verdict `fail`; warnings never pass.

- [ ] **Step 5: Run real interruption, owner, and deletion sabotage**

```powershell
pwsh -NoProfile -File scripts/portability/Test-RealRestore.ps1
```

Interrupt attempt 1, prove attempt 2 uses a new empty database, remove one child row and prove verification fails, restore cleanly, replay a deletion newer than the backup, and prove deleted evidence remains absent.

- [ ] **Step 6: Commit**

```powershell
git add backend/src/memory/portability backend/src/__tests__/portability scripts/portability/safe-target.mjs scripts/portability/Test-RealRestore.ps1
git commit -m "feat(memory): restore only into verified fresh targets"
```

### Task 8: Resumable Quiesced Cutover, Emergency Cutover, and Fresh-Target Rollback

**Files:**
- Create: `backend/src/memory/portability/cutoverMachine.ts`
- Create: `backend/src/memory/portability/cutover.types.ts`
- Create: `ops/portability/cutover-protocol.schema.json`
- Test: `backend/src/__tests__/portability/cutoverMachine.test.ts`
- Create: `scripts/portability/Test-LocalCutover.ps1`

**Interfaces:**
- CLI commands: `enter-maintenance`, `fence-source`, `drain`, `issue-lease`, `smoke`, `cutover`, `emergency-cutover`, `rollback`, `drill`.
- Every state transition CAS-updates the operation head and appends an event.

- [ ] **Step 1: Write failing state-machine tests**

Required states are:

```ts
export const CUTOVER_STATES = [
  'planned',
  'preflight_passed',
  'rehearsal_verified',
  'source_maintenance',
  'source_credential_revoked',
  'source_drained',
  'final_backup_verified',
  'destination_created',
  'destination_restored',
  'deletions_replayed',
  'destination_verified',
  'destination_smoke_read_only',
  'old_lease_expired_or_source_fenced',
  'destination_lease_issued',
  'endpoint_switched',
  'writes_open',
  'observing',
  'completed',
  'rollback_required',
  'rollback_snapshot_verified',
  'rollback_fresh_target_restored',
  'rolled_back',
  'failed',
] as const;
```

Tests prove no final backup before independent source fencing, no lease issue before verification, emergency writes wait for old lease expiry, no repeated backup/epoch on resume, and rollback never selects the retained source database as target.

- [ ] **Step 2: Implement idempotent side effects**

Every external side effect receives `<operation UUID>:<state>` as idempotency key. Provider credential revocation must return a provider receipt that is hashed into the event. A missing revocation receipt permits progress only after the old external lease expiry.

- [ ] **Step 3: Run real local cutover and rollback**

```powershell
pwsh -NoProfile -File scripts/portability/Test-LocalCutover.ps1
```

Use source, destination, and rollback databases. Write canary A through source, fence source, restore destination, write canary B, snapshot destination, create a third fresh rollback target, restore the complete destination snapshot there, and prove A+B plus the deletion watermark through the rollback backend.

- [ ] **Step 4: Run crash sabotage**

Terminate the process after `final_backup_verified`, resume the same operation, and prove the artifact ID, writer epoch, and event index are not duplicated. Capture fail/pass evidence.

- [ ] **Step 5: Commit**

```powershell
git add backend/src/memory/portability/cutoverMachine.ts backend/src/memory/portability/cutover.types.ts backend/src/__tests__/portability/cutoverMachine.test.ts ops/portability/cutover-protocol.schema.json scripts/portability/Test-LocalCutover.ps1
git commit -m "feat(memory): perform leased fresh-target cutovers"
```

### Task 9: Portable Runtime, Heroku Sidecar Packaging, and Windows Launchers

**Files:**
- Create: `backend/src/memory/portability/runtimeConfig.ts`
- Create: `backend/src/portableMain.ts`
- Modify: `backend/src/index.ts`
- Modify: `backend/Dockerfile`
- Modify: `backend/Procfile`
- Create: `backend/scripts/portability/build-postgrest.mjs`
- Create: `backend/scripts/portability/supervise.mjs`
- Create: `scripts/portability/Initialize-RosebudLocal.ps1`
- Create: `scripts/portability/Start-RosebudLocal.ps1`
- Create: `scripts/portability/Backup-RosebudMemory.ps1`
- Create: `scripts/portability/Restore-RosebudMemory.ps1`
- Create: `scripts/portability/Test-RosebudRecovery.ps1`
- Create: `scripts/portability/Return-RosebudToCloud.ps1`
- Create: `scripts/portability/Test-PortabilityScripts.ps1`
- Test: `backend/src/__tests__/portability/runtimeConfig.test.ts`

**Interfaces:**

```ts
type RuntimeMode = 'cloud' | 'local-compute' | 'local-data-runtime' | 'maintenance' | 'migration-verify';
type GatewayMode = 'supabase-managed' | 'generic-private';
```

Runtime and gateway mode are independent. `local-compute` may use Supabase managed PostgREST; `maintenance` and `migration-verify` may target either gateway.

- [ ] **Step 1: Write failing runtime and PowerShell tests**

Assert `migration-verify` never imports `backend/src/index.ts`, maintenance serves reads/health and rejects writes, generic mode requires loopback API/admin URLs, and database fingerprints are fetched/verified rather than trusted from an arbitrary environment label.

- [ ] **Step 2: Implement Heroku packaging**

Build downloads the exact Linux PostgREST archive from Task 0, verifies SHA-256, extracts only the `postgrest` entry, and records its hash in the slug. The supervisor starts PostgREST, waits on its admin `/ready` for at most 30 seconds, then starts Node on `$PORT`. It propagates `SIGTERM`/`SIGINT`, kills both processes on either child failure, and never prints environment values.

- [ ] **Step 3: Implement Windows bootstrap and runtime**

`Initialize-RosebudLocal.ps1` is PowerShell 5.1-compatible and verifies PowerShell 7, Node 24, PostgREST 14.16, age 1.3.1, and compatible PostgreSQL client tools. It may download checksum-pinned portable PostgREST/age assets only into the explicit tool root. It never silently installs or upgrades PowerShell, Node, or PostgreSQL; when one is absent it exits `78` and prints the exact official operator action.

`Start-RosebudLocal.ps1` starts hidden children, writes PIDs only below the operation directory, verifies command lines before stop, and exposes the backend only through HTTPS. Supported real-phone paths are a valid local certificate installed through an explicit pairing ceremony or Tailscale HTTPS/Serve. Plain HTTP is test-only and rejects Authorization headers outside loopback.

- [ ] **Step 4: Run runtime tests**

```powershell
npm --prefix backend test -- --testPathPattern=portability/runtimeConfig
npm --prefix backend run build
pwsh -NoProfile -File scripts/portability/Test-PortabilityScripts.ps1
```

- [ ] **Step 5: Run Heroku process sabotage**

Delay PostgREST readiness beyond 30 seconds and prove the web process exits before Heroku's 60-second bind deadline; restore normal readiness and prove one web process supervises both children.

- [ ] **Step 6: Commit**

```powershell
git add backend/src/memory/portability/runtimeConfig.ts backend/src/portableMain.ts backend/src/index.ts backend/src/__tests__/portability/runtimeConfig.test.ts backend/Dockerfile backend/Procfile backend/scripts/portability scripts/portability
git commit -m "feat(memory): run the portable backend on Heroku and Windows"
```

### Task 10: Signed Mobile Endpoint Profiles and Explicit Migration Handoff

**Files:**
- Create: `services/crypto/vendor/tweetnacl/nacl-fast.js`
- Create: `services/crypto/vendor/tweetnacl/LICENSE`
- Create: `services/memory/cloud/endpointProfiles.types.ts`
- Create: `services/memory/cloud/endpointProfiles.ts`
- Create: `hooks/memory/useMemoryEndpointProfiles.ts`
- Create: `components/settings/MemoryEndpointProfiles.tsx`
- Modify: `components/settings/MemorySettingsSection.tsx`
- Modify: `components/settings/index.ts`
- Modify: `app/(tabs)/settings.tsx`
- Test: `__tests__/services/endpointProfiles.test.ts`
- Test: `__tests__/hooks/useMemoryEndpointProfiles.test.ts`
- Test: `__tests__/components/MemoryEndpointProfiles.test.tsx`

**Interfaces:**
- Profiles are schema-versioned public metadata in AsyncStorage; they are not falsely described as encrypted.
- `verifyAndActivateEndpoint(profileId, migrationAuthorization?): Promise<ActivationResult>`.
- A migration authorization names old/new deployment, old/new epoch, operation UUID, expiry, and is signed by the endpoint-authority key.

- [ ] **Step 1: Vendor and verify the detached-signature verifier**

Fetch the exact tweetnacl 1.0.3 tarball, verify Task 0's npm SRI, copy only `nacl-fast.js` and `LICENSE`, and make `verify-vendored-crypto.mjs` reject byte changes. Do not modify `package.json` or a lockfile.

- [ ] **Step 2: Write failing service/hook/component tests**

Test serialized safe parsing, one storage-key owner, concurrent writes, HTTPS requirement, signed bootstrap, key ID/fingerprint, lease/epoch/expiry, signer-key overlap rotation, explicit pairing, explicit migration handoff, and atomic transport/profile activation.

An active profile may switch to a different active deployment only with a valid unexpired migration authorization matching the current profile and operation. An unreachable current endpoint does not weaken this rule; emergency activation requires a signed emergency authorization issued after source fencing or lease expiry.

- [ ] **Step 3: Implement UI through hook boundary**

The component shows endpoint, deployment, lease expiry, last health, current mode, and recovery-point warning. It never displays keys/tokens. Every `<Text>` uses both schemes and layout uses `gap-*`.

- [ ] **Step 4: Run focused and design gates**

```powershell
node scripts/portability/verify-vendored-crypto.mjs
npx jest --runInBand __tests__/services/endpointProfiles.test.ts __tests__/hooks/useMemoryEndpointProfiles.test.ts __tests__/components/MemoryEndpointProfiles.test.tsx __tests__/services/memoryBackendTransport.test.ts
npx tsc --noEmit
npm run lint
npm run check:design
```

- [ ] **Step 5: Run real Playwright endpoint switching**

Start two HTTPS backends with signed bootstrap documents. Activate the valid current writer, perform a memory request through the switched transport, reject an unauthorized conflicting writer, then activate the destination with a valid migration authorization. Record visible status and actual rejection text.

- [ ] **Step 6: Commit**

```powershell
git add services/crypto/vendor services/memory/cloud hooks/memory components/settings 'app/(tabs)/settings.tsx' __tests__/services/endpointProfiles.test.ts __tests__/hooks/useMemoryEndpointProfiles.test.ts __tests__/components/MemoryEndpointProfiles.test.tsx
git commit -m "feat(memory): switch trusted backend endpoints"
```

### Task 11: Durable Backup Schedule, Retention, Offsite Copies, and Alerts

**Files:**
- Create: `backend/src/memory/portability/backupSchedule.ts`
- Create: `backend/src/memory/portability/retention.ts`
- Create: `backend/src/memory/portability/offsiteStore.ts`
- Create: `backend/src/memory/routes/maintenanceRoutes.ts`
- Create: `db/migrations/core/0005_backup_schedule.sql`
- Create: `db/overlays/supabase/0003_backup_schedule.sql`
- Create: `db/overlays/generic/0003_backup_schedule.sql`
- Populate: `supabase/migrations/20260728123342_memory_backup_schedule.sql`
- Test: `backend/src/__tests__/portability/backupSchedule.test.ts`
- Test: `backend/src/__tests__/portability/retention.test.ts`
- Test: `backend/src/__tests__/portability/offsiteStore.test.ts`

**Interfaces:**
- Durable due-at table records daily backup, weekly restore verification, monthly drill, last success, next due, lease owner, and lease expiry.
- Retention classes are exactly 14 daily, 8 weekly, and 12 monthly verified sets.

- [ ] **Step 1: Write failing schedule and retention tests**

Prove overlapping startup/request/scheduler triggers claim one operation through advisory lock plus durable CAS, missed work catches up, failed verification is never retention-eligible, rollback-window artifacts are retained, erase-all purge obligations override normal retention and complete only after both-copy absence plus replacement backup, and a missed verified backup surfaces an operator alert.

- [ ] **Step 2: Implement bounded wake behavior**

Backend startup and authenticated maintenance requests check due work. Heroku Scheduler is only a trigger. Long backups produce an explicit one-off command and are not executed inside a normal web request.

Generate `supabase/migrations/20260728123342_memory_backup_schedule.sql` deterministically from `0005_backup_schedule.sql` plus the Supabase overlay; verify the generated file before applying it.

- [ ] **Step 3: Implement offsite requirements**

`offsiteStore.ts` accepts two configured absolute destinations, one marked `offHost: true`; it verifies post-copy hashes. Retention deletes only immutable verified sets that are superseded, outside the rollback window, and present in both destinations. Provider-native PITR/snapshot IDs are recorded when available but never replace the portable set.

Maintain a signed artifact-owner index so erase-all can locate every shared portable set containing an owner. Key retirement, two-copy purge receipts, provider-native snapshot/PITR purge instructions, and the replacement-backup ID are required before the deletion completion report can become `complete`.

- [ ] **Step 4: Run tests and overlapping-trigger sabotage**

```powershell
npm --prefix backend test -- --testPathPattern=portability/backupSchedule
npm --prefix backend test -- --testPathPattern=portability/retention
npm --prefix backend test -- --testPathPattern=portability/offsiteStore
```

Launch three due triggers concurrently and prove one operation. Remove one offsite copy in the fixture and prove retention refuses deletion.

- [ ] **Step 5: Commit**

```powershell
git add backend/src/memory/portability/backupSchedule.ts backend/src/memory/portability/retention.ts backend/src/memory/portability/offsiteStore.ts backend/src/memory/routes/maintenanceRoutes.ts backend/src/__tests__/portability db/migrations/core/0005_backup_schedule.sql db/overlays/supabase/0003_backup_schedule.sql db/overlays/generic/0003_backup_schedule.sql supabase/migrations/20260728123342_memory_backup_schedule.sql
git commit -m "feat(memory): schedule and retain verified backups"
```

### Task 12: Destination Descriptors, Runbooks, and Agent Wrappers

**Files:**
- Create: `ops/portability/provider.schema.json`
- Create: `ops/portability/providers/{supabase,heroku,neon,aws-rds,gcp-cloud-sql,azure-postgresql,railway,generic-local}.json`
- Create: matching `ops/portability/runbooks/*.md`
- Create: `ops/portability/agent-prompts/canonical-protocol.md`
- Create: `ops/portability/agent-prompts/{codex,claude-code,gemini-cli,github-copilot,cursor,cline,chatgpt}.md`
- Create: `ops/portability/support-evidence.json`
- Create: `scripts/portability/validate-portability-docs.mjs`
- Test: `__tests__/services/portabilityDocs.test.ts`

**Interfaces:**
- Provider `supportStatus` is `experimental | verified`.
- `verified` requires a real report ID, SHA-256, tested commit, provider database version, TLS mode, sidecar version/config hash, internal-JWT test ID, forced-RLS test ID, backup/restore IDs, rollback ID, and drill timestamp.

- [ ] **Step 1: Write failing schema/validator tests**

Every descriptor contains provisioning, direct backup connection, TLS, version matrix, extensions, import permissions, connection limits, overlay, PostgREST/JWKS/private binding, backup, fresh restore, verify, credential fencing, fresh-target rollback, manual teardown, and support evidence.

- [ ] **Step 2: Write exact provider commands**

Commands are argument arrays. AWS selects RDS PostgreSQL rather than conflating it with Aurora; GCP selects Cloud SQL rather than conflating it with AlloyDB. Alternatives are documented as separate experimental variants, not claimed by one command set. Supabase backup uses a direct/session connection compatible with `pg_dump`, never a transaction pooler.

- [ ] **Step 3: Write canonical protocol and wrappers**

Wrappers point to the canonical protocol by relative path and SHA-256 and contain only platform tool syntax. The canonical protocol requires inspection, credential redaction, no invented output, no dual write, lease/fence verification, snapshot-consistent signed backup, deletion replay, fresh restore/rollback, actual exit evidence, retained source, and performed-versus-suggested reporting.

- [ ] **Step 4: Run validation and status sabotage**

```powershell
npx jest --runInBand __tests__/services/portabilityDocs.test.ts
node scripts/portability/validate-portability-docs.mjs
```

Mark an evidence-free temporary descriptor `verified`, capture rejection, restore, and rerun.

- [ ] **Step 5: Commit**

```powershell
git add ops/portability scripts/portability/validate-portability-docs.mjs __tests__/services/portabilityDocs.test.ts
git commit -m "docs(memory): define evidenced portability targets"
```

### Task 13: Full Local, Heroku Eco, Managed-Provider, Endpoint, and Recall Proof

**Files:**
- Create: `scripts/portability/run-cloud-drill.mjs`
- Create: `ops/portability/reports/.gitkeep`
- Modify: `ops/portability/README.md`
- Modify: `PROGRESS.md`
- Test: `__tests__/services/cloudDrillRunner.test.ts`

**Interfaces:**
- Real reports are written to an absolute external report directory and referenced only by ID/hash.
- The drill runner refuses production data and requires an exact live deployment ID, database fingerprint, operation UUID, and `ROSEBUD_PORTABILITY_DRILL=1`.

- [ ] **Step 1: Write failing drill-runner tests**

Require report IDs for Phase 0, schema/overlay, internal JWT, source fencing, backup, deletion export/replay, restore, API, canary, endpoint, restart, rollback, recall, and sabotage. Verify no report path is inside Git and all configured sentinel secrets are absent from stored report JSON.

- [ ] **Step 2: Run the complete local gate**

```powershell
$evidence = Join-Path $env:LOCALAPPDATA "Rosebud\portability-evidence"
npx supabase start
npx supabase db reset --local --no-seed
npx supabase test db --local supabase/tests/database
npx supabase db lint --local --level error --fail-on error
npm test
npx tsc --noEmit
npm run lint
npm run check:design
npm --prefix backend run build
npm --prefix backend test
pwsh -NoProfile -File scripts/portability/Test-CoreMigrations.ps1
pwsh -NoProfile -File scripts/portability/Test-GenericPostgrest.ps1
pwsh -NoProfile -File scripts/portability/Test-RealBackup.ps1
pwsh -NoProfile -File scripts/portability/Test-RealRestore.ps1
pwsh -NoProfile -File scripts/portability/Test-LocalCutover.ps1
pwsh -NoProfile -File scripts/portability/Test-PortabilityScripts.ps1
node scripts/portability/validate-portability-docs.mjs
```

Every command is wrapped by `run-with-evidence` in the final drill invocation.

- [ ] **Step 3: Run Heroku Eco proof**

Deploy the exact commit and slug containing the verified PostgREST binary. Verify `web=1`, `worker=0`, no pinger, natural sleep after at least 30 traffic-free minutes, cold authenticated wake, `$PORT` binding, sidecar private readiness, restart, and exactly-once expired-job reclaim. Record remaining Eco-hour limitations and the release-phase one-hour limit.

- [ ] **Step 4: Run one managed-provider proof**

Use an isolated fresh Heroku Postgres or Neon database. Apply core plus generic overlay, start private PostgREST, prove internal-JWT claims and forced RLS with two users, restore the encrypted fixture, replay deletions, verify, switch a test endpoint with migration authorization, write/read canaries, snapshot destination, roll back into a third fresh database, and retain all old databases read-only through the rollback window.

- [ ] **Step 5: Run local data/runtime and cloud-return proof**

Use cleared fixture/application storage. Start the Windows backend and local PostgreSQL through HTTPS, activate its signed profile, finish one journal through the running app, verify the persisted source and digest, restart laptop services, ask a recall question, and paste the verbatim assistant reply. Then fence local, back up, restore into a fresh Supabase target, replay deletions, switch with signed handoff, and verify read/write.

- [ ] **Step 6: Measure RTO/RPO correctly**

RTO starts at the first documented recovery command and ends after authenticated read/write probes pass. RPO is the interval between the newest recovered committed mutation and the fencing instant. Store phase timestamps in the signed report and replace estimates in `ops/portability/README.md`.

- [ ] **Step 7: Independent review and final verification**

Review the full branch against the current spec. Fix every critical/important finding, rerun affected real reports, and perform a scoped re-review. Confirm no backup, report, key, lease, dump, JWT, or connection URL is tracked:

```powershell
npx jest --runInBand __tests__/services/portabilityArtifactGuard.test.ts
node scripts/portability/run-with-evidence.mjs --operation $env:ROSEBUD_DRILL_OPERATION_ID --phase artifact-index-guard --expect pass --report-dir $env:ROSEBUD_EVIDENCE_DIR -- npx jest --runInBand __tests__/services/portabilityArtifactGuard.test.ts
git diff --check
git status --short
```

- [ ] **Step 8: Commit durable non-secret records**

```powershell
git add ops/portability/README.md ops/portability/support-evidence.json PROGRESS.md scripts/portability/run-cloud-drill.mjs __tests__/services/cloudDrillRunner.test.ts
git commit -m "test(memory): prove leased portable disaster recovery"
```

## Completion Checkpoint

Phase 9 portability is complete only when:

- Task 1's Phase 0 gate passes with real evidence.
- The same canonical migration hashes run on Supabase and generic PostgreSQL.
- The same backend build runs on Heroku and Windows.
- Generic PostgREST proves internal-JWT claim propagation, local JWKS overlap rotation, private binding, and non-bypass forced RLS.
- Every mutation rejects stale epoch, expired lease, wrong lease token, wrong database, and wrong source credential transactionally.
- Snapshot-consistent signed/encrypted backup and independent deletion export pass with real tools.
- Interrupted restore restarts in a new marked database.
- Deletion replay prevents deleted evidence from returning after an older backup restore.
- Planned cutover independently fences the source before final backup.
- Emergency cutover waits for old lease expiry unless provider fencing is proven.
- Rollback restores the full destination snapshot into a fresh target and preserves destination-era writes.
- Signed endpoint switching changes the actual memory transport and rejects unauthorized conflicting writers.
- Daily/weekly/monthly scheduling, missed-work catch-up, two-copy offsite verification, and 14/8/12 retention pass.
- Supabase-to-local, local-to-Supabase, and one non-Supabase managed-provider rehearsal have signed redacted report IDs/hashes.
- A cleared-data live recall probe records verbatim assistant output.
- Actual RTO/RPO replaces estimates.
- Unsupported provider descriptors remain `experimental`.
- No source database was automatically deleted.
- No secret-bearing report or artifact is tracked.
- Phase 8's current valid per-user authority remains unchanged unless Phase 9 executes a separately fenced cutover; full local sources remain retained until every Phase 9 retirement gate passes.
- Independent review has no unresolved critical or important issue.
