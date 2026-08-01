# Cloud Memory Phase 1 MIRROR Ingestion Implementation Plan

> **For Codex:** REQUIRED SUB-SKILL: Use `superpowers:executing-plans` to
> execute this plan task-by-task. Use `superpowers:test-driven-development`
> for every behavior change, `superpowers:systematic-debugging` for every
> unexpected failure, `superpowers:subagent-driven-development` for bounded
> independent implementation/review tasks, and
> `superpowers:verification-before-completion` before every completion claim.

**Goal:** Build and deploy a lossless, owner-isolated MIRROR ingestion path
from the Expo app to the fixed Heroku/Supabase backend while preserving the
existing local stores as the only visible-response memory authority.

**Architecture:** The phone retains complete journal/check-in sources and all
existing local memory behavior. A dedicated, content-free, schema-versioned
outbox records only owner-bound work references, retry state, source cursors,
and tombstones; it never duplicates journal/check-in text. When an explicit
Supabase session and a server-issued MIRROR enrollment/state permit uploads, a
single-flight coordinator reads the current local source snapshot into memory,
builds deterministic bounded chunks, and sends them over authenticated HTTPS
to Heroku. Heroku derives the owner from the verified JWT, computes canonical
SHA-256 hashes, and calls fenced, atomic PostgreSQL RPCs. PostgreSQL persists
the source rows, message revisions, manifest/chunk membership, watermarks, and
parity receipt in one transaction per mutation. A verified import changes only
that owner's memory authority from `LOCAL` to `MIRROR`; cloud reads, cloud
visible-response authority, projection builds, shadow retrieval, and cloud AI
orchestration remain disabled.

**Tech stack:** Expo SDK 54, React Native 0.81, TypeScript 5.9, AsyncStorage,
Supabase JS/Auth, Express 4 on one Heroku Eco web dyno, PostgreSQL 17.6,
Supabase PostgREST/RLS, Node `crypto`, Jest, Node test runner, pgTAP, Docker,
Playwright, and the connected Supabase management tools.

---

## 1. Fixed Phase Boundary

Phase 1 delivers only exact source mirroring and its operational safety
boundary.

Phase 1 visible-response read authority remains LOCAL for every enrolled owner.
Phase 1 source prose is upload-only. No server-to-client source-content download
is added. Keep Phases 2–8 mapped to the master roadmap and Phase 9 last.

It may:

- mirror completed journal entries and completed intention check-ins;
- preserve exact user/assistant content, role, order, authored instant, and
  honestly available timezone/local-date metadata;
- capture immutable source/message revision history needed to make retries and
  later edits safe;
- create and verify manifests, chunks, source membership, watermarks,
  tombstones, and parity receipts;
- show the user non-technical sync status and a retry action;
- move an enrolled owner from `LOCAL` to `MIRROR` after verified source parity.

It must not:

- read cloud memory into any prompt, tool, digest, history result, or visible
  response;
- upload local atoms, identity profiles, day digests, session digests, or
  rollups as source truth;
- enable projection builds, shadow retrieval, cloud read authority, cloud
  write authority, backend chat orchestration, or model calls;
- couple memory mirroring to `EXPO_PUBLIC_DATA_PROVIDER`;
- let a client environment variable, successful HTTP response, database
  location, or valid database credential grant visible-response authority;
- put a Supabase secret/service-role key, deployment lease token, or other
  server credential in the Expo bundle;
- edit any already-applied migration;
- retire, truncate, or weaken any complete local source;
- claim provider-independent backup, cross-provider recovery, old-backup
  deletion replay, or safe local retirement. Those remain final Phase 9 work.

The fixed rollback is: set the Heroku mirror-write kill switch off, stop
client upload attempts, retain the hosted source rows for inspection, and keep
all local behavior unchanged.

---

## 2. Privacy and Outbox Confidentiality Decision

The master roadmap originally said "encrypted offline outbox." The current
repository has no authenticated-encryption/key-custody primitive, and repo
rules forbid an unreviewed dependency or lockfile change. AsyncStorage is
explicitly unencrypted. Storing a key beside ciphertext would be security
theater.

For this personal/trusted-friends release, the product owner explicitly asked
not to add heavyweight security and delegated subsequent architecture choices
to the recommended quality-first path. Phase 1 therefore amends the approved
design and uses the honest data-minimization boundary available without
inventing cryptography:

- the durable outbox contains no journal/check-in title, summary, message
  content, reasoning, analysis, prompt, token, or bearer credential;
- it stores only opaque source IDs, source kind, monotonic generation/cursor,
  timestamps, retry metadata, parity metadata, and tombstone intent;
- exact source text is read from the still-authoritative local source store
  only into process memory immediately before authenticated HTTPS upload;
- logs and diagnostics contain counts, hashes, IDs, durations, and stable error
  codes only;
- owner UUIDs, opaque source IDs, work timestamps, retry/error state, parity
  metadata, and tombstone activity remain plaintext metadata at rest in
  AsyncStorage; this residual exposure is accepted for the trusted-circle scope;
- no code or documentation may call this application-layer encryption;
- the roadmap result is updated from "encrypted outbox" to "content-free
  durable outbox";
- application-layer encryption can be revisited only through a separately
  approved dependency/key-custody plan. It is not required to complete MIRROR
  for the accepted trusted-circle scope because the outbox creates no second
  source-prose or credential copy; its residual metadata exposure remains
  explicit above.

This decision does not claim that the existing journal/check-in AsyncStorage
stores or local backups are encrypted. Phase 1 preserves that posture, prevents
source prose from entering the separate outbox, and retains only the current
local source plus compact revision counters/tombstones; it does not claim
forensic secure erasure from the device's underlying storage.

---

## 3. Authority, Enrollment, and Identity Rules

### 3.1 Explicit session

- Memory mirroring uses the current Supabase session independently of the
  legacy general-data provider.
- It may refresh an existing session.
- It must not silently create an anonymous user.
- A pre-existing anonymous Supabase session is not an explicit identity and
  cannot enroll or write. Both the client mirror session adapter and backend
  mirror-write authorization reject `is_anonymous`/the equivalent verified
  claim while leaving ordinary local app behavior unchanged.
- Because a signed-out Supabase access JWT otherwise remains cryptographically
  valid until its expiry, Heroku also extracts the verified JWT `session_id`
  after `GET /auth/v1/user` succeeds, requires its `sub` to equal the returned
  user ID, and passes it into every mutation RPC. The RPC verifies a matching
  live `auth.sessions(id,user_id)` row in the same transaction. A revoked
  session therefore cannot mutate memory during the JWT's remaining lifetime.
- No session means `waiting_for_sign_in`; local journaling continues and the
  outbox/reconciler retain work references.
- Tokens live only in Supabase Auth/session storage and in request headers.
  They never enter the outbox, diagnostics, or logs.

### 3.2 Dataset-to-owner binding

- The first explicit signed-in owner may bind an unbound local dataset.
- Enrollment returns a server-issued, owner-bound `datasetId`. The local
  binding persists it with a schema version, greatest accepted authority
  version, and greatest known import generation.
- An account switch never uploads the already-bound local dataset to the new
  owner.
- A mismatched owner produces `owner_mismatch` and requires the original owner
  or an explicit later migration flow. Phase 1 does not guess.
- If the local dataset is empty and no pending tombstone exists, rebinding is
  allowed only through the coordinator's explicit empty-dataset path.
- A local backup contains only a non-secret dataset commitment
  `(boundOwnerId, datasetId, greatestKnownGeneration)`, not tokens, work items,
  retry state, or receipts. Restoring a nonempty backup under a different
  signed-in owner enters `restored_owner_confirmation_required` and performs no
  upload. Phase 1 permits resuming as the recorded owner; cross-owner migration
  remains a later explicit flow.

### 3.3 Bootstrap enrollment

The initial `LOCAL -> MIRROR` path must not deadlock:

1. The client has a fixed public Heroku endpoint/deployment profile and a
   current explicit Supabase session. Its only public mirror fields are
   `EXPO_PUBLIC_MEMORY_MIRROR_BASE_URL`,
   `EXPO_PUBLIC_MEMORY_DEPLOYMENT_ID`, `EXPO_PUBLIC_MEMORY_WRITER_EPOCH`, and
   the enable switch below.
2. The client build has the non-secret `EXPO_PUBLIC_MEMORY_MIRROR_ENABLED=1`
   request switch, and this exact local dataset/owner has a durable, current
   user-granted mirror-consent record. Build enablement, sign-in, and operator
   allowlisting are not consent.
3. Heroku has `MEMORY_MIRROR_WRITES_ENABLED=true`.
4. `POST /v1/memory/mirror/enroll` derives the owner from the JWT and calls a
   writer-fenced RPC.
5. The RPC creates or updates an owner row in `LOCAL` with only
   `cloudSourceMirroring=true`; all four other cloud flags remain false.
6. Enrollment returns a narrow, owner/dataset/deployment/epoch/version-bound
   `MirrorEnrollmentUploadPermit`. The client may upload source data under that
   permit while enrollment is pending, but the existing
   `MemoryRuntimeRoute`/visible authority resolver remains exactly `LOCAL` with
   `mirrorWrites=false`; it is not weakened to represent bootstrap traffic.
   Phase 1 visible-response read authority remains LOCAL for every enrolled
   owner until a later phase explicitly stages cloud read authority.
7. Only a completed manifest with server-verified count/hash parity changes
   the owner to `MIRROR`.
8. `MIRROR` still means `readFromCloud=false` and `writeToCloud=false` for
   visible-response generation. `mirrorWrites=true` means source-copy traffic
   only.

Before the first enrollment request, the app presents a plain-language opt-in:
completed journal/check-in text will be copied through the private Heroku
backend into Supabase for future memory work; Phase 1 responses still use local
memory; the separate outbox contains metadata but no prose; turning the switch
off stops future uploads but does not claim to delete an already hosted copy.
Consent is versioned and bound to the current owner/local dataset commitment.
It defaults off, is excluded from backup/restore, and must be granted again
after restore or owner mismatch. Revocation cancels any active import if
reachable and then makes every source-copy/enroll/chunk/complete/upsert path
zero-request; it retains local work/deletion commitments and directs actual
removal through the existing clear history/delete controls rather than
pretending stop-sync deleted cloud data. For a dataset already enrolled, the
coordinator retains a narrow privacy-safety egress permission for authenticated
state/parity, cancel, and explicit tombstone reconciliation only. Therefore a
delete/clear performed after revocation can still make the hosted copy
ineligible without re-enabling source upload.

### 3.4 Monotonic state

- Cache the greatest accepted `authorityVersion` for the bound owner,
  deployment ID, and writer epoch.
- Reject stale versions, wrong owner, expired session, wrong deployment,
  wrong epoch, malformed flags, or impossible state/flag combinations.
- A failed state check pauses uploads and never changes local visible behavior.

### 3.5 Trusted-circle enrollment and abuse bounds

An ordinary confirmed Supabase signup does not grant cloud-memory enrollment.
Phase 1 adds a server/database-held `memory_mirror_owner_allowlist`; only an
operator-connected SQL action may add or disable an exact owner UUID. No invite
list, allowlist, or bypass is shipped in an Expo environment variable. Enroll
and every later mutation recheck that the verified owner is enabled, returning
stable `OWNER_NOT_TRUSTED`/`OWNER_DISABLED` failures while local journaling
continues.

Every mutation also enforces database-time, transaction-local backpressure:

- one active manifest per owner;
- no more than 20,000 staged unique messages and 2,560 staged conversations for
  the active manifest;
- no more than four unexpired, unused completion permits per owner;
- at most 30 successful/attempted mirror mutations in a rolling minute and
  1,000 in a database calendar day per owner;
- no more than 200,000 retained observed source/message revision rows per
  owner; crossing the cap blocks further mirror work without dropping local
  data;
- no more than 4,096 compact historical verified/cancelled receipts plus one
  active/prepared manifest membership per owner; the owner-current-source-set
  row and its eligible source/message rows are current state, not historical
  manifest membership. Phase 1 blocks additional mirroring rather than evicting
  idempotency evidence.

Cancellation atomically preserves a compact idempotent manifest cancellation
receipt but removes that manifest's unverified staged membership/revision rows,
staged-only conversation/message identities with no verified revision or other
manifest membership, and staged watermark state while preserving the last
verified watermark.
Heavy validation stores at most 160 compact ordered chunk hash/count receipts
plus final mutation/parity fields and removes chunk rows. Verified completion
applies that manifest's accepted mutations to the cumulative owner source set,
stores the resulting version/receipt/count/hash, and compacts the completed
manifest's import-item membership. A later identical chunk retry is
reconstructed from the compact receipt; changed input conflicts.
Permit preparation atomically deletes expired unused permits and completed
manifests may delete their consumed permits after the durable completion
receipt exists. These maintenance actions never remove verified source
revisions, current rows, deletion commitments, or completion receipts. Tests
use a disposable allowlist fixture and prove a non-allowlisted confirmed user
cannot allocate owner/import rows or consume Eco work.

---

## 4. Canonical Source and Hash Contract

### 4.1 Source scope

- Upload only `status === "completed"` journal entries and check-ins.
- Drafts never enter manifests or chunks.
- `journal` and `intention_checkin` remain the canonical source kinds.
- Local derived memory is never source truth.

### 4.2 Stable identity

- Conversation ID remains
  `conversationSourceId(sourceKind, sourceRecordId)`.
- Message `clientEventId` remains
  `messageClientEventId(conversationId, localMessageId)`.
- Every completed source has a persisted, positive, monotonically increasing
  `sourceRevision`. Creation starts at `1`; a source-content/message/order
  change increments it in the same source-owner write; mirror bookkeeping does
  not.
- Each message revision is likewise persisted and monotonic for a stable
  message ID. A changed message never overwrites its previous cloud evidence
  without an immutable revision row.
- The device retains only the current canonical source plus compact revision
  counters. It does not retain a second plaintext copy of every intermediate
  source revision.
- Each uploaded source/message snapshot carries `previousAcceptedRevision`
  from the last verified server receipt and its current positive local
  revision. The server locks the current row and accepts only:
  - an identical replay at the current revision with identical canonical bytes;
  - a first observed snapshot when no cloud revision exists; or
  - a higher revision whose `previousAcceptedRevision` exactly equals the
    locked current cloud revision.
- A first observed local revision greater than `1` is stored honestly as
  `first_observed`; a jump of more than one after a verified cloud revision is
  stored as `coalesced_gap` with the missing numeric interval; an adjacent
  update is `contiguous`. Missing intermediate prose is never invented.
- `(owner_id, client_event_id)` remains retry-safe unique identity.
- Tombstones are keyed by owner plus stable source/message identity. A higher
  tombstone dominates every device and restore holding an older revision; the
  server never infers a deletion or identity match from ordinary omission.
- No cross-dataset logical equivalence is inferred from prose or model output.
  Stable source/message IDs and explicit owner-scoped tombstones are the only
  identity and deletion authority.
- Manifest ID is deterministic from owner, server-issued dataset ID, contract
  version, and a persisted import generation greater than both the local and
  server-reported greatest generation. It contains no source text and cannot be
  reused after outbox loss or backup restore.
- Chunk identity is `(owner_id, manifest_id, chunk_index)`.
- The mirror sequencing authority is the per-source/per-message revision
  cursors defined above (`sourceRevision` plus per-message revision),
  `previousAcceptedRevision`, and the manifest's staged revision-cursor
  watermark fields. The Phase 0 `memory_source_watermarks` table is not the
  mirror sequencing authority: it is not extended, not superseded, and is
  reused only for legacy client sequencing (`highest_client_sequence` /
  `highest_client_event_id`) on the older `EXPO_PUBLIC_DATA_PROVIDER` sync
  path. Mirror RPCs never read or write it. Everywhere this plan says
  "watermark" it means the active manifest's staged per-source revision-cursor
  state, never the Phase 0 table.

### 4.3 Temporal truth

- Existing legacy messages preserve their absolute `timestamp` and report
  unavailable timezone/local date as `null` with
  `temporalProvenance="legacy_unknown"`.
- New user and assistant messages capture:
  - the authored UTC instant;
  - the IANA timezone available at message creation;
  - local calendar date computed in that timezone.
- No timezone or event date is inferred from prose.
- Exact message array order is authoritative for sequence.
- New optional temporal fields must survive session autosave/resume and source
  storage migration.

### 4.4 Canonical server hash

- Heroku canonicalizes validated source objects with an explicit,
  versioned UTF-8 line format.
- Field order, null marker, integer format, timestamp format, length-prefixing,
  newline preservation, and Unicode byte encoding are specified in shared
  golden vectors.
- Heroku computes `sha256:<lowercase hex>` using Node `crypto`.
- PostgreSQL independently canonicalizes the accepted JSONB fields and computes
  `sha256:<lowercase hex>` with `extensions.digest`.
- A mismatch aborts the complete RPC transaction.
- The manifest hash is the SHA-256 of ordered server-verified chunk hashes plus
  counts and contract version.
- Client-side non-cryptographic cursors may detect local change, but are never
  accepted as parity evidence.

### 4.5 Bounds

Use constants, not route-local magic numbers:

- at most 16 conversations per chunk;
- at most 128 messages per chunk;
- at most 256 KiB encoded request JSON per chunk;
- at most 160 chunks per manifest;
- at most 20,000 messages per initial Phase 1 manifest;
- one active import per owner;
- one client flush in flight per owner;
- client invocation processes at most 4 chunks or 20 seconds, whichever comes
  first, then persists its cursor and yields.

An over-limit source set remains local and reports a stable blocked status; it
is never truncated or silently dropped.

A conversation may span chunks. Each chunk repeats the exact immutable
conversation envelope and carries one contiguous message slice; the RPC
requires identical repeated conversation metadata. Distinct conversation
counts are computed from membership, not by summing repeated envelopes. A
single encoded message or envelope larger than the byte ceiling is blocked
without truncation.

---

## 5. PostgreSQL Transaction Contracts

The Supabase CLI created the provisional new migration at:

`supabase/migrations/20260729062655_cloud_memory_phase_1_mirror.sql`

The linked CLI is not authenticated in this unattended workspace
(`SUPABASE_ACCESS_TOKEN` is absent), so Task 14 uses the connected migration
operation and then reconciles this filename to the single exact remote-assigned
version before the final implementation commit. The SQL bytes are immutable
across that move.

Generate it deterministically from:

- `backend/sql/migrations/0003_memory_mirror_ingestion.sql`;
- `backend/sql/overlays/supabase/0002_memory_mirror_ingestion.sql`;
- `scripts/build-cloud-memory-phase1-migration.mjs`.

Do not edit:

- `supabase/migrations/202601240001_init.sql`;
- `supabase/migrations/20260728112723_cloud_memory_foundation.sql`;
- `supabase/migrations/20260728120938_memory_portability_authority.sql`;
- `supabase/migrations/20260728123338_memory_writer_authority.sql`;
- `supabase/migrations/20260728123342_memory_backup_schedule.sql`;
- `supabase/migrations/20260728144157_cloud_memory_foundation_20260728112723.sql`;
- `supabase/migrations/20260728144711_cloud_memory_fk_indexes_20260728145000.sql`.

### 5.1 Additive schema

Add:

- Phase 1 parity/completion fields and a bounded compact ordered chunk-receipt
  summary to import manifests;
- server count/hash fields to import chunks;
- operator-managed `memory_mirror_owner_allowlist` and per-owner
  `memory_mirror_rate_limits` rows, both forced-RLS with no client/direct
  service-role table mutation;
- a server-issued dataset ID and greatest completed/import generation for each
  owner;
- an owner `current_source_manifest_id` value retained only as
  last-applied-manifest audit metadata plus manifest `prepared` state;
- `memory_conversation_revisions` for immutable, source-revision-scoped
  conversation metadata;
- additive role/sequence/status/source-revision fields on
  `memory_message_revisions` so a revision is a complete canonical record, not
  content alone;
- first-observed/contiguous/coalesced-gap provenance plus nullable numeric gap
  bounds on conversation and message revision rows;
- `memory_import_items` for exact owner/manifest/chunk mutation membership and
  stored hashes while a manifest is active/prepared;
- positive current `source_revision` on mirrored conversations and the fields
  required to reject stale source/message revisions;
- explicit `staged/eligible/deleted` mirror eligibility on conversations and
  messages; newly accepted rows remain `staged` until verified completion;
- an owner-current-source-set version/receipt/count/hash contract advanced once
  per successful logical manifest completion. Current eligible rows are
  authoritative for the mirrored owner union;
- current-source/parity views that resolve those eligible current rows minus
  accepted higher owner-scoped tombstones. `current_source_manifest_id` must not
  define read membership;
- owner-first indexes for active import, chunk cursor, membership, eligible
  source inventory, and deletion lookup;
- a partial unique index enforcing only one active manifest per owner across
  `created/uploading/receiving/prepared` states;
- `memory_import_completion_permits` for short-lived,
  owner/manifest/generation/authority-version-bound completion permits issued
  from database time;
- composite owner foreign keys everywhere;
- forced RLS and explicit grants on the new table;
- no direct mutation grant to `anon`, `authenticated`, or `service_role`.

Use additive Phase 1 schema only: do not rewrite or edit any applied Phase 0
schema or migration to introduce this owner-current-source-set contract.

### 5.2 Unique non-overloaded RPCs

Add service-only functions with unique names:

- `memory_enroll_mirror_v1`;
- `memory_reserve_mirror_request_v1`;
- `memory_begin_source_import_v1`;
- `memory_accept_source_chunk_v1`;
- `memory_get_source_import_v1`;
- `memory_cancel_source_import_v1`;
- `memory_validate_source_import_v1`;
- `memory_prepare_source_completion_v1`;
- `memory_complete_source_import_v1`;
- `memory_apply_source_tombstone_v1`;
- `memory_get_source_parity_v1`.

Every mutation takes the complete Phase 0 deployment fence:

- deployment ID;
- writer epoch;
- lease ID;
- raw lease token;
- source credential fingerprint;
- owner ID and session ID derived by Heroku from the verified bearer token,
  never trusted from a client body.

The backend's single mirror-mutation wrapper first calls
`memory_reserve_mirror_request_v1`, which atomically verifies the allowlist and
reserves the rolling-minute/day request budget using database time, then invokes
the requested mutation RPC. All mutation RPCs independently recheck allowlist
enablement and enforce active/staging/revision/permit quotas in their own
transaction, so a missing wrapper cannot bypass trust or storage bounds.

### 5.3 Atomic chunk acceptance

`memory_accept_source_chunk_v1` must, in one transaction:

1. assert the deployment writer fence;
2. lock the owner/active manifest in a stable order;
3. reject a completed/cancelled/foreign/out-of-order/over-limit manifest;
4. validate exact JSONB shapes and source-kind consistency;
5. compute and compare the chunk SHA-256;
6. insert missing conversation/message identity rows without overwriting a
   previously verified current view;
7. append a staged immutable conversation revision;
8. insert the staged immutable current local revision for every first-observed
   message without inventing earlier rows; on a later manifest, accept changed
   canonical role/order/time/content/status only when both source/message
   revision fences permit it, then append a complete immutable revision row
   with honest contiguous/coalesced-gap provenance;
9. refuse any resurrection covered by a tombstone;
10. insert exact import membership;
11. insert or content-equivalently replay the chunk receipt;
12. advance the source watermark monotonically;
13. return the same receipt for an identical retry;
14. raise a stable conflict for the same identity with changed content.

Any exception rolls back all fourteen effects.

For a stable source/message identity:

- equal revision plus equal canonical bytes is an identical replay;
- equal revision plus different canonical bytes is a conflict;
- lower revision is stale and rejected;
- a higher revision is accepted only when `previousAcceptedRevision` equals the
  locked server current revision. Adjacent revisions are `contiguous`; larger
  jumps are `coalesced_gap` with exact missing revision-number bounds. The
  server records only observed canonical snapshots and never synthesizes
  missing content;
- apply source/message revision CAS under row locks. A stale shared-source
  snapshot cannot overwrite accepted revisions, while disjoint sources merge
  independently without contending on unrelated source/message rows;
- individual chunks and completed manifests never infer deletion from omission.
  Manifest omission is a no-op; cancel/failure leaves the last verified current
  rows byte-identical, and only an explicit accepted higher stable-ID tombstone
  removes eligibility;
- role, sequence, timestamp, timezone/local date, content, and status changes
  are all revision-worthy;
- sequence reorder uses a lock plus a collision-safe two-step temporary ordinal
  range inside the RPC so the existing non-deferrable unique sequence
  constraint cannot partially fail or swap the wrong rows.

`memory_cancel_source_import_v1` is fenced and idempotent. It locks owner then
manifest, changes only an active manifest to `cancelled`, never alters authority,
and returns the same compact cancellation receipt on retry. In that same
transaction it removes the cancelled manifest's membership/chunks and any
unverified staged revision/identity rows no longer referenced by another
manifest, and clears only that manifest's staged watermark fields back to the
last verified watermark. It never touches eligible/current verified rows,
immutable verified revisions, deletion commitments, or authority; the next
generation reconciles from the current local snapshot.

### 5.4 Atomic tombstone

`memory_apply_source_tombstone_v1` must, in one transaction:

1. assert the deployment writer fence;
2. content-equivalently insert/replay the deletion-ledger row;
3. set the matching conversation to `deleted`;
4. set matching conversation revisions to `deleted`;
5. set matching messages to `deleted`;
6. set matching message revisions/evidence eligibility to `deleted`;
7. ensure future imports cannot make that source eligible;
8. enqueue the existing `verify_deletion` job idempotently;
9. advance the owner-current-source-set version and persist its resulting
   eligible source/message count/hash/receipt;
10. persist and return a stable tombstone receipt containing the original
    ineligibility counts and resulting owner-union receipt.

An identical tombstone retry returns those original receipts/counts without
advancing the source-set version again. The same event/revision with changed
immutable fields conflicts. A tombstone revision
is accepted as first observed only when no cloud source revision exists and
`previousAcceptedRevision` is null; otherwise it must be higher than the locked
current source revision and name that revision as `previousAcceptedRevision`.
Lower/equal changed revisions or a mismatched predecessor fail. If the current
local deletion revision skipped locally coalesced edits, it is recorded with
exact `coalesced_gap` numeric provenance; removed prose is never retained or
uploaded merely to fill that gap.

This is immediate cloud ineligibility on accepted tombstone. While a phone is
offline, the locally committed tombstone remains durable and cloud data never
influences Phase 1 responses; reconnect sends deletion before ordinary source
chunks.

### 5.5 Atomic completion and transition

`memory_validate_source_import_v1` performs the heavy, retryable work before the
short completion permit exists. A manifest is an atomic, device-observed
mutation/reconciliation generation, not a replacement snapshot of the owner's
entire archive. Validation locks the owner/manifest, requires every declared
chunk for that generation, validates that mutation set's counts, hashes,
membership, and revision fences, computes the compact ordered chunk receipt,
marks the manifest `prepared`, and deletes bulky chunk rows while retaining the
prepared `memory_import_items`. It never requires a complete owner inventory,
changes owner authority/current source rows, or makes staging eligible. It may
use a separately bounded 30-second backend/database deadline. The client does
not hold the local source mutation gate during this step; it cancels/restarts if
the local generation drifts before permit issuance.

`memory_prepare_source_completion_v1` is then a small database-time operation:
it accepts only the prepared manifest and issues the short-lived permit after
all writer/session/allowlist/quota checks. The client acquires its local source
gate and rechecks the generation immediately before calling it.

`memory_complete_source_import_v1` must:

- lock the owner and manifest in the same stable order used by enroll, cancel,
  chunk, and tombstone mutations, then lock the touched current source/message
  rows and owner-current-source-set row in stable identity order;
- after writer/auth checks, first detect an already-verified manifest: identical
  immutable completion input returns its stored receipt even if the old permit
  is consumed/expired; changed input conflicts and never re-promotes;
- only for an active manifest, lock and validate an unexpired, unused
  database-issued completion permit bound to this
  owner/manifest/generation/expected authority version, then consume it in the
  same successful transaction;
- compare-and-set the expected owner authority version and require the manifest
  to be that owner's only active manifest;
- require the manifest still has the exact immutable prepared mutation counts,
  hashes, chunk receipt, and membership fingerprint validated above;
- recheck source/message revision CAS and accepted owner-scoped tombstones for
  every touched stable ID. A stale shared-source snapshot conflicts and cannot
  overwrite an accepted revision; a disjoint source applies independently;
- return the original receipt for an identical retry and conflict if a verified
  manifest identity is reused with changed completion inputs;
- apply the manifest's accepted current source/message revisions. The server's
  current owner view is the cumulative union of current verified source/message
  revisions accepted from every completed manifest, minus explicit
  owner-scoped higher tombstones;
- carry prior verified rows forward transactionally by leaving untouched
  eligible rows in the owner set while applying the manifest's mutations.
  Manifest omission is always a no-op. Only an explicit higher stable-ID
  tombstone removes eligibility;
- atomically increment the monotonic owner-current-source-set version, compute
  its eligible source/message counts and canonical hash, and store the resulting
  owner-union receipt. Current eligible rows are authoritative for read
  membership;
- mark the manifest `verified` with its mutation counts/hash/timestamp and the
  resulting source-set version/receipt/count/hash. Keep
  `current_source_manifest_id` only as last-applied-manifest audit metadata; it
  must not define read membership;
- compact the completed manifest's import items after their accepted mutations
  are reflected in authoritative current rows; leave cancelled/foreign staging
  ineligible;
- when and only when current state is `LOCAL`, compare-and-set it to `MIRROR`,
  set only `cloudSourceMirroring=true`, and leave every
  projection/read/write/shadow flag false;
- for an already-`MIRROR` owner, preserve state and flags exactly;
- for a future `SHADOW` or `CLOUD` owner, preserve the higher state and every
  flag exactly while accepting source parity, or reject an incompatible
  contract version; never demote or clear later-phase authority;
- increment `authorityVersion` only for an actual authority/flag transition;
  later source-set generations preserve it;
- return this manifest completion receipt, the resulting owner-union receipt/
  version/count/hash, and owner state.

A completion receipt is unique and idempotent per logical manifest completion.
The completion transaction enqueues fenced, idempotent compaction of that
verified manifest's import items and any now-unreferenced staging identities.
At most one active/prepared manifest membership may exist; begin blocks rather
than allowing another active owner manifest. Historical manifests retain only
bounded compact completion receipts plus their resulting source-set metadata,
so an identical old retry remains recognizable without retaining 20,000 items.

Each successful completion advances a monotonic owner source-set version and
returns the resulting owner-union receipt. An identical completion retry returns
that manifest's stored completion/owner-union receipt and does not increment any
version again. Different generations produce distinct receipts; concurrent
retries of one logical generation converge on its original receipt. Enrollment
is also idempotent and never demotes `MIRROR`, `SHADOW`, or `CLOUD` back to
`LOCAL`.

The same cumulative rule applies to empty and nonempty mutation generations. A
zero-item manifest leaves every prior eligible cloud row in the owner union; it
does not purge, detach, or make rows ineligible. Empty-dataset rebinding is a
client owner-binding rule, not a remote purge operation.

---

## 6. HTTP Contract

All routes:

- live under `/v1/memory/mirror/*`;
- inherit `Cache-Control: no-store`;
- require a verified Supabase bearer token;
- derive owner from `res.locals.memoryAuth`;
- reject a body/query owner field;
- never log request bodies;
- use stable JSON success/error envelopes;
- apply the global Heroku mirror-write kill switch to mutation routes only;
- use backend-held writer credentials only.

Add:

- `POST /v1/memory/mirror/enroll`;
- `POST /v1/memory/mirror/imports`;
- `GET /v1/memory/mirror/imports/:manifestId`;
- `PUT /v1/memory/mirror/imports/:manifestId/chunks/:chunkIndex`;
- `POST /v1/memory/mirror/imports/:manifestId/cancel`;
- `POST /v1/memory/mirror/imports/:manifestId/prepare-completion`;
- `POST /v1/memory/mirror/imports/:manifestId/complete`;
- `POST /v1/memory/mirror/tombstones`;
- `GET /v1/memory/mirror/parity`.

Status mapping:

- `400` malformed contract or item/count bound;
- `413` encoded request/chunk byte bound;
- `401` missing/invalid/expired Supabase identity;
- `403` owner/state/enrollment not permitted;
- `404` unknown manifest;
- `409` idempotency, cursor, revision, or active-manifest conflict;
- `422` hash/parity/shape mismatch;
- `429` retryable bounded backpressure, honoring `Retry-After`;
- `503` kill switch, writer fence, PostgREST, or dependency unavailable.

`MIRROR_WRITES_DISABLED` is a distinct `503` code, not a generic retryable
server failure. It moves the client to `paused_by_server`, cancels automatic
timers, and resumes only after a foreground/manual enrollment-state refresh
confirms availability. GET bootstrap/import/parity/status routes remain healthy
while writes are disabled. Ordinary transient `5xx` remains retryable.

Writer-fence failures likewise have stable non-hammering codes:
`WRITER_STALE_EPOCH`, `WRITER_LEASE_MISMATCH`, `WRITER_LEASE_EXPIRED`,
`WRITER_TOKEN_REJECTED`, `WRITER_CREDENTIAL_MISMATCH`, and
`WRITER_MODE_NOT_ACTIVE`. They enter `paused_by_server` and resume only after a
foreground/manual read-only readiness/state refresh proves a new compatible
deployment binding. Network loss, timeout, dependency outage, and explicitly
transient upstream `5xx` use bounded backoff.

Do not expose raw PostgreSQL/PostgREST bodies, lease values, service keys, or
journal text in errors.

---

## 7. Client Durability Contract

### 7.1 Storage owner

`services/memory/cloud/mirrorOutbox.ts` solely owns:

`@rosebud_cloud_memory_mirror_outbox`

`services/memory/cloud/datasetBinding.ts` solely owns:

`@rosebud_memory_dataset_binding`

`services/memory/cloud/sourceMaintenanceSaga.ts` solely owns:

`@rosebud_source_maintenance_saga`

The journal and intention source modules respectively own paged content-free
deletion commitments under:

- `@blackrose_journal_deletion_commitments:<00-ff>:<page>`;
- `@blackrose_checkin_deletion_commitments:<00-ff>:<page>`.

They also replace the legacy single-map payloads with copy-on-write source
shards while retaining `@journal_entries` / `@intention_checkins` as lightweight
versioned roots:

- `@blackrose_journal_source_index:<00-ff>:<page>`;
- `@blackrose_journal_source:<sourceId>`;
- `@blackrose_journal_source_messages:<sourceId>:<sourceRevision>:<page>`;
- `@blackrose_journal_source_write_intent`;
- `@blackrose_checkin_source_index:<00-ff>:<page>`;
- `@blackrose_checkin_source:<sourceId>`;
- `@blackrose_checkin_source_messages:<sourceId>:<sourceRevision>:<page>`;
- `@blackrose_checkin_source_write_intent`.

Add all exact keys/prefixes to `AGENTS.md`'s ownership table.

Envelope:

- `schemaVersion`;
- a replica of the authoritative dataset owner binding;
- versioned per-owner/local-dataset consent state and grant/revoke timestamps;
- deployment/epoch and greatest accepted authority version;
- monotonic local generation;
- active manifest/cursor;
- persisted completion guard
  `(permitId, manifestId, generation, serverExpiresAt, recordedAt,
  outcomeUnknown)` with no token or prose;
- per-source acknowledged cursor;
- content-free pending work references;
- tombstone delivery references copied from the authoritative source-owner
  tombstone ledgers;
- attempts, next-attempt time, and stable last error;
- last verified owner-union receipt/version/count/hash plus the current device's
  per-manifest completion receipt.

### 7.2 Safety properties

- Every read-modify-write uses one serialized module lock.
- Every parse is guarded.
- Legacy/malformed data is migrated or quarantined, never silently trusted.
- No queue capacity policy may discard the oldest item.
- Coalesce repeated upserts for the same source.
- Never coalesce away a committed tombstone.
- Tombstones are always selected before ordinary source work.
- Retry uses persisted exponential backoff with bounded jitter.
- `401` performs at most one refresh attempt, then suspends.
- `403`, owner mismatch, contract mismatch, or authority rollback suspends.
- `409` is reconciled against server receipt/state, not blindly retried.
- `429`, timeout, network, and explicitly transient `5xx` remain retryable;
  stable kill-switch/writer-fence `503` codes suspend as defined above.
- Invalid local source content is blocked with a redacted diagnostic; the
  source is retained.

### 7.3 Cross-key crash recovery

AsyncStorage cannot atomically mutate a source key and a separate outbox key.
Do not pretend otherwise:

- each versioned journal/check-in source envelope owns its current records,
  positive per-source/per-message revision counters, a versioned dataset-owner
  commitment replica, fixed 256-bucket source/deletion page heads, and a small
  inline deletion handoff slot. The legacy root no longer contains all source
  prose/messages;
- source index pages hold at most 256 content-free pointers and 64 KiB encoded
  JSON. A source metadata record is separate, and its ordered messages are
  copy-on-write pages of at most 128 messages/256 KiB encoded JSON. A single
  over-page message remains local in a dedicated at-most-1-MiB record but is
  marked mirror-blocked rather than truncated;
- create/edit first writes a content-free feature write intent, then all
  revision-scoped message pages and source metadata, then switches the small
  index pointer, then clears the intent and garbage-collects only unreachable
  old pages. A crash before the pointer switch leaves the old current source
  authoritative; a crash after it leaves the new complete revision
  authoritative. Startup finishes/cleans the intent before reads or network
  reconciliation;
- the copy-on-write target metadata/pages contain the new current record and
  incremented compact revision counters; the single lightweight index-pointer
  switch is the commit point. The content-free outbox may coalesce dirty
  references because startup/foreground reconciliation can reconstruct work
  from that current pointer and last verified server cursors;
- legacy completed records migrate honestly to one baseline revision `1`; no
  pre-migration edit history is invented;
- after the server acknowledges a snapshot, the outbox advances only the
  compact accepted-revision cursors. If several local edits occurred since the
  prior receipt, the next snapshot supplies that prior cursor plus the current
  higher revision and the server records an honest coalesced gap;
- deleting a source uses one lightweight root/index commit point in which the
  current pointer is absent and its stable ID/kind/revision/deleted-at
  commitment is in the inline handoff slot. Under the same module lock it then writes the
  commitment idempotently to a deterministic 8-bit bucket/page and only after
  that durable page write clears the inline slot/advances the page head. Bucket
  selection uses a tiny pure UTF-8 FNV-1a 32-bit function with exact golden
  vectors; it is distribution only, not cryptography, and requires no Node/
  WebCrypto/Hermes dependency. A crash leaves the commitment in at least one
  location and startup deduplicates it;
- each deletion page is limited to 256 commitments and 64 KiB encoded JSON.
  Overflow allocates the next page for that one hash bucket, so neither the
  source envelope nor a single commitment key grows with lifetime delete churn;
- clear does not attempt one oversized owner-key rewrite. The maintenance saga
  first durably stages all content-free commitment pages from the locked current
  inventory, then replaces the source records/page heads and advances its phase;
  mirror reconciliation stays blocked until the saga completes;
- a source-owner deletion commitment is never purged in Phase 1, even after all
  currently enabled sinks acknowledge it. Only per-sink retry/attempt state may
  be removed. This lets a future `local -> supabase` legacy-provider toggle,
  restore, or merge continue to suppress and delete an old remote row without
  depending on the lossy generic sync queue. Cross-provider compaction or
  retirement belongs to the final Phase 9;
- the mirror outbox holds delivery references/cursors only and may be rebuilt
  from inline and paged source-owner deletion commitments;
- best-effort dirty marking follows every successful source upsert, while
  startup/foreground full reconciliation compares stable source IDs,
  `sourceRevision`, message revisions, and last verified cursors;
- all journal/check-in source mutations and the coordinator's final completion
  recheck use one short-lived, stable-order mirror source mutation gate; local
  writes never wait on ordinary chunk uploads, only the bounded final
  completion request;
- while holding the local source-mutation gate, the client rechecks generation
  and requests a short-lived database-time completion permit, then invokes
  completion with that permit;
- before dispatching completion, the client durably records the permit guard in
  the content-free outbox. A completion request is never sent if that write
  fails;
- completion uses pinned layered deadlines: PostgreSQL
  `statement_timeout=2500ms`, backend RPC deadline `3500ms`, client request
  deadline `5000ms`, database completion-permit TTL `8000ms`, and the local gate
  remains held through permit expiry plus a `1000ms` safety margin. The
  completion RPC rechecks the permit immediately before its authority/current-
  view update and refuses to begin promotion unless at least `3000ms` remains;
  the shorter statement timeout plus the post-expiry gate margin prevents a
  commit after gate release;
- a lost response after an already completed database commit records
  `completion_outcome_unknown`, releases the gate only after the database
  permit plus safety margin has elapsed, and reconciles through the idempotent
  completion receipt/state. It never asserts that the owner stayed LOCAL;
- a source mutation arriving during this rare finalization window gets priority
  before a permit is issued; after issuance it may wait only for the bounded
  permit window, shows local-save progress, and then succeeds regardless of
  mirror outcome. No unbounded network wait is permitted;
- after process start, any persisted permit/outcome-unknown guard blocks
  source mutation for a fresh full `9000ms` quarantine window independent of
  wall-clock correctness, then fetches the idempotent completion receipt/state
  before clearing the guard. If offline, it may release after that full
  quarantine because every server permit is then expired, marks a new local
  generation, and reconciles later;
- a missing/corrupt/quarantined outbox with any nonempty source, deletion
  commitment, or dataset binding is treated as if an unknown completion permit
  may exist: source mutations wait a fresh full `9000ms` monotonic quarantine
  and the client queries owner state/active import by authenticated owner before
  rebuilding work. If offline after the full window, every old permit is
  expired, so a new local generation may proceed and later cancels/reconciles
  any obsolete manifest;
- never infer deletion from ordinary absence without an owner-key tombstone.

Dataset binding is replicated, never inferred from an outbox default:

- the primary binding key contains schema/binding version, random local dataset
  ID, explicit owner ID, optional server dataset ID, greatest known generation,
  and an in-progress replica-write phase; it contains no prose/token;
- journal envelope, check-in envelope, and outbox each carry the same
  versioned commitment. The binding module writes the primary intent first,
  copies replicas in fixed journal→check-in→outbox order under the global source
  gate, then marks the primary complete;
- startup repairs an interrupted replication only when every surviving
  commitment agrees. A corrupt/missing outbox cannot make a nonempty A dataset
  unbound and eligible for B;
- enrollment requires all nonempty source-envelope commitments to agree with
  the primary and current explicit session. If commitments conflict, or all
  commitments are lost while any source/tombstone exists, enter
  `binding_recovery_required` with zero enrollment/upload. Only the recorded
  owner plus a server-verified dataset binding may reconstruct a missing
  replica; current-session identity alone never rebinds data.

Clear and restore are durable cross-key sagas, not `Promise.all`:

- `sourceMaintenanceSaga` writes a versioned content-free intent containing
  operation ID/kind, ordered phase, expected source-envelope revisions, and for
  restore the existing backup ID/hash and binding commitment;
- it acquires the global source-mutation gate, then journal and check-in owner
  locks in one fixed order. Clear materializes commitment pages before removing
  each source set, then clears derived stores one idempotent phase at a time.
  Restore validates the complete stored backup before mutation, applies source
  keys first and derived keys sequentially, and marks
  `restore_reconciliation_required`;
- startup resumes/repairs the saga before mirror or legacy-provider
  reconciliation; concurrent edits wait for the bounded local saga and no
  intermediate mixed source set may upload;
- same-owner restore fetches server source/message revision cursors and hashes
  before source copy resumes. For each restored source not server-tombstoned,
  the source owner atomically rebases the local source revision above the
  server current revision; each differing message rebases above its server
  message revision, while equal messages adopt the verified cursor. The next
  upload is honestly `contiguous` or `coalesced_gap`;
- restore is an explicit snapshot replacement. Before overwriting sources, the
  saga diffs the validated backup inventory against the locked pre-restore local
  inventory; after reconnect it also diffs the same backup against the
  server-eligible inventory. Every current/server source omitted from the
  backup receives a higher content-free deletion commitment before it is
  removed or source copy resumes. Thus backup(A) after verified A+B produces a
  higher B tombstone and exact A-only parity rather than silent omission;
- a restored source ID covered by a higher server tombstone remains visible
  locally as `restored_deleted_source_local_only` but cannot reuse that ID or
  upload. Phase 1 does not silently resurrect it; a future explicit
  user-controlled “save as new entry” flow must allocate a new stable ID;
- force-stop tests interrupt every primary/replica, commitment-page,
  source-store, derived-store, rebase, and final-intent boundary and require
  deterministic startup completion before any network mutation.

Local source creation/update/delete remains the user-facing operation. Sync
failure changes only mirror status and later retry; it never blanks a screen,
blocks local chat completion, or removes local memory.

### 7.4 Two-device same-owner reconciliation

Phase 1 supports two independent devices for the same owner. Both devices keep
their own complete local source stores, revision counters, content-free
outboxes, dataset-binding commitments, and import generations; neither device
is a replica of the other. The maximum-quality contract below is enforced by
the server RPCs (§5) and must be proven by the Task 4 two-owner/device
fixtures and a dedicated two-device Task 16 probe:

- **Independent local generations.** Each device journals offline and
  generates sources, `sourceRevision` values, and message revisions
  independently. Manifest IDs are derived from owner, server-issued dataset ID,
  contract version, and that device's persisted import generation, so two
  devices never collide on manifest identity and cannot replay each other's
  manifest. They may start with shared stable IDs and create disjoint local
  additions while offline.
- **Serialization / one active manifest.** The partial unique index (§5.1)
  allows at most one active `created/uploading/receiving/prepared` manifest per
  owner across all devices. When device B begins an import while device A's
  manifest is active, B receives a stable `ACTIVE_IMPORT_EXISTS` conflict and
  must not cancel, supersede, or fork A's manifest; B persists its work
  references and retries after A completes or cancels.
- **Revision CAS.** Both devices upload `previousAcceptedRevision` plus their
  current local revision. The server accepts a higher revision only when
  `previousAcceptedRevision` exactly equals the locked server current revision
  (§4.2). Device B's stale snapshot therefore cannot overwrite device A's
  accepted rows; B gets a stable conflict, rebases above the server cursor
  (§7.3 restore-style rebase), and retries honestly as `contiguous` or
  `coalesced_gap`. Disjoint sources merge independently.
- **Cumulative owner union.** A manifest is one device-observed mutation/
  reconciliation generation. Device B can complete without possessing A-only
  prose because the server carries A's verified rows into the owner union while
  applying B's disjoint accepted rows. Manifest omission is a no-op; neither
  device needs to upload or download the other device's source content.
- **Per-generation receipts and convergence.** Device A's successful manifest
  completion receives its unique idempotent receipt and source-set version N.
  Device B's later successful manifest receives a distinct receipt and version
  N+1. Both devices converge on B's latest owner-union receipt/version through
  content-free state/parity reconciliation; retries of A or B return that
  logical manifest's original receipt, never a new or one-global receipt.
- **No lost accepted revisions.** Every accepted A and B revision remains
  visible in the resulting current view. Shared-source stale snapshots fail
  revision CAS, disjoint additions merge, and ordinary absence never deletes or
  excludes an accepted source.
- **No cross-device resurrection.** Tombstones are owner-scoped, not
  device-scoped. A deletion commitment accepted from device A suppresses the
  same stable source/message identity on device B and every restore; B's outbox,
  restore, and merge paths honor the higher tombstone and never re-upload or
  resurrect the tombstoned ID even if B still holds an older local copy. No
  cross-dataset equivalence is inferred from prose or model output. Legacy
  merge filters tombstoned IDs (§1 rollback, `memory_deletion_ledger`).

Both devices share the same owner/authority and owner-current-source-set
metadata. A device that falls behind reconciles receipt/version/count/hash only:
Phase 1 remains upload-only for source prose, adds no source-content download,
and visible-response read authority remains LOCAL. Phase 1 never accepts a
second active owner manifest or two receipts for one logical completion.

---

## 8. Task-by-Task Execution

### Task 0: Pin the Dedicated Plan and Roadmap Contract

**Files:**

- Create:
  `docs/superpowers/plans/2026-07-29-cloud-memory-phase-1-mirror-ingestion.md`
- Modify:
  `docs/superpowers/plans/2026-07-28-cloud-memory-master-roadmap.md`
- Modify:
  `docs/superpowers/specs/2026-07-28-cloud-authoritative-rosebud-memory-design.md`
- Modify:
  `docs/superpowers/specs/2026-07-29-portability-final-phase-sequencing-design.md`
- Modify: `scripts/validate-cloud-memory-roadmap.mjs`
- Modify: `test-fixtures/cloudMemoryRoadmapFixtures.ts`
- Modify: `test-fixtures/cloudMemoryRoadmapAdversarialFixtures.ts`
- Test: `__tests__/scripts/validateCloudMemoryRoadmap.test.ts`
- Create empty migration only through:
  `npx supabase migration new cloud_memory_phase_1_mirror`

**Steps:**

1. Change the fixture's Phase 1 plan pointer first.
2. Run the validator Jest file and capture the expected red mapping failure.
3. Create this plan, update the validator's exact mapping, and point the master
   roadmap Phase 1 row here.
4. Replace "encrypted outbox" in the Phase 1 result/deliverable with the honest
   content-free confidentiality contract in Section 2.
5. Keep Phases 2–8 mapped to the master roadmap and Phase 9 last.
6. Run:

```powershell
node scripts/validate-cloud-memory-roadmap.mjs
npx jest --runInBand __tests__/scripts/validateCloudMemoryRoadmap.test.ts
git diff --check
```

7. Commit:

```powershell
git add docs/superpowers/plans/2026-07-29-cloud-memory-phase-1-mirror-ingestion.md docs/superpowers/plans/2026-07-28-cloud-memory-master-roadmap.md docs/superpowers/specs/2026-07-28-cloud-authoritative-rosebud-memory-design.md docs/superpowers/specs/2026-07-29-portability-final-phase-sequencing-design.md scripts/validate-cloud-memory-roadmap.mjs test-fixtures/cloudMemoryRoadmapFixtures.ts test-fixtures/cloudMemoryRoadmapAdversarialFixtures.ts supabase/migrations/20260729062655_cloud_memory_phase_1_mirror.sql
git commit -m "docs(plan): pin cloud memory phase 1 execution"
```

### Task 1: Establish Baseline and Immutable-File Guard

**Files:**

- Create: `scripts/verify-cloud-memory-phase1-immutables.mjs`
- Create: `__tests__/scripts/verifyCloudMemoryPhase1Immutables.test.ts`
- Create: `scripts/phase1/run-mirror-evidence.mjs`
- Create: `scripts/phase1/mirror-fault-proxy.mjs`
- Create: `scripts/phase1/mirror-hosted-e2e.mjs`
- Create: `scripts/phase1/mirror-app-e2e.mjs`
- Create: `scripts/phase1/android-ui-driver.mjs`
- Create: `scripts/phase1/rotate-writer-lease.mjs`
- Create: `scripts/phase1/deploy-heroku.mjs`
- Create: `__tests__/scripts/phase1MirrorEvidence.test.ts`
- Create: `__tests__/scripts/phase1MirrorFaultProxy.test.ts`
- Create: `__tests__/scripts/phase1MirrorHostedE2E.test.ts`
- Create: `__tests__/scripts/phase1MirrorAppE2E.test.ts`
- Create: `__tests__/scripts/phase1AndroidUiDriver.test.ts`
- Create: `__tests__/scripts/phase1RotateWriterLease.test.ts`
- Create: `__tests__/scripts/phase1DeployHeroku.test.ts`
- Update: `PROGRESS.md` only after evidence exists

**Steps:**

1. Record base commit `ef2610f019c21a6b9c0652014d26f3e0fdfbb8b6`.
2. Add a validator that compares the protected migration, lockfile, and
   `example-design/` blobs to that base.
3. Make its test fail by including the new Phase 1 migration in the protected
   list; fix it to protect only applied migrations.
4. Run the existing focused cloud tests, root TypeScript, backend build/tests,
   and roadmap validator.
5. Query the live Supabase project read-only for version, authority, counts,
   lease validity, and migration history.
6. Query Heroku read-only for app ID, stack, region, Eco formation, release,
   config-key names, health, and readiness. Never print config values.
7. Verify hosted baseline is one active deployment, zero source rows, and zero
   non-LOCAL owners.
8. Write evidence/script tests first. Prove missing implementation, skipped
   child, nonzero child, wrong commit, dirty checkout, cleanup failure,
   secret-shaped output, and stale artifact all make the manifest incomplete.
9. Implement the harnesses so `local`, `hosted`, and `app` modes orchestrate
   their own fresh commands and never ingest prior console claims. The
   secret-safe lease helper retains old/new raw Heroku lease values only in
   process memory and emits only IDs/digests/status.
10. Commit the immutable guard and evidence harness before behavior work:
    `test(memory): establish phase 1 immutable evidence`.

### Task 2: Canonical Upload and Temporal Contracts

**Files:**

- Create: `shared/memory/mirrorContracts.ts`
- Create: `shared/memory/canonicalSourceFormat.ts`
- Modify: `shared/memory/contracts.ts`
- Modify: `services/ai/chatTypes.ts`
- Create: `services/ai/messageTemporalMetadata.ts`
- Modify: `features/chat/hooks/useChatOrchestration.ts`
- Modify: `services/ai/sessionStorage.ts`
- Modify: `services/intentions/intentionChatCompletion.ts`
- Modify: `services/memory/cloud/sourceInventory.ts`
- Create: `__tests__/services/memory/cloud/mirrorContracts.test.ts`
- Create: `__tests__/services/memory/cloud/canonicalSourceFormat.test.ts`
- Modify: `__tests__/services/cloudSourceInventory.test.ts`
- Modify the focused session/chat tests affected by the optional fields.
- Create: `backend/src/__tests__/canonicalSourceFormat.test.ts`

**TDD cases:**

- exact runtime rejection of unknown keys and invalid limits;
- deterministic source/chunk order;
- Unicode, combining marks, exact CR/LF/newline preservation, empty strings,
  and nulls;
- embedded NUL is rejected locally and by Heroku with a stable redacted
  `UNSUPPORTED_NUL` error because PostgreSQL JSONB/text cannot represent it;
- timestamp millisecond precision;
- legacy temporal fields remain null/unknown;
- new messages retain IANA timezone/local date through autosave/resume;
- exact message order is not reordered by authored timestamp;
- opener, normal response, fallback/error response, pending-input Finish, and
  autosave/resume all use one temporal message factory; no persisted message
  creation branch may omit captured metadata;
- same canonical vector produces the expected SHA-256 in Node and PostgreSQL
  fixtures;
- source/message revisions are positive, persisted, and monotonic; a stable ID
  with changed exact content increments its revision while mirror bookkeeping
  alone does not;
- source content never appears in validation error strings.

**Commit:** `feat(memory): define phase 1 mirror contracts`

### Task 3: Content-Free Outbox, Owner Binding, and Tombstones

**Files:**

- Create: `services/memory/cloud/mirrorOutbox.types.ts`
- Create: `services/memory/cloud/mirrorOutbox.ts`
- Create: `services/memory/cloud/mirrorStatus.ts`
- Create: `services/memory/cloud/datasetBinding.types.ts`
- Create: `services/memory/cloud/datasetBinding.ts`
- Create:
  `__tests__/services/memory/cloud/mirrorOutboxPersistence.test.ts`
- Create:
  `__tests__/services/memory/cloud/mirrorOutboxConcurrency.test.ts`
- Create:
  `__tests__/services/memory/cloud/mirrorOutboxRecovery.test.ts`
- Create:
  `__tests__/services/memory/cloud/datasetBinding.test.ts`

**TDD cases:**

- schema envelope and migration;
- corrupt envelope quarantines and fails closed;
- corrupt/missing outbox with a nonempty bound dataset enforces the full fresh
  permit quarantine and owner/active-import reconciliation before rebuild or
  source mutation;
- serialized concurrent dirty marks lose nothing;
- repeated source marks coalesce without losing the newest generation;
- coalescing work references retains the current local revision and last
  accepted server cursor without copying source prose;
- source-owner tombstone import/acknowledgement lifecycle;
- tombstone priority;
- restart preserves cursor/backoff/parity;
- restart preserves an active completion guard/outcome-unknown record and
  enforces the fresh quarantine before any source mutation;
- source text/title/summary/reasoning/tokens are structurally impossible and
  absent from serialized storage;
- create plus two edits before first upload leaves only the current canonical
  source and compact revision counters; the outbox contains no old revision
  phrase or intermediate payload;
- two offline edits after MIRROR retain the last accepted cursor and current
  higher revision so the server can record an honest coalesced gap;
- acknowledged deletion removes only per-sink retry state; the permanent
  content-free deletion commitment remains available for a later legacy
  provider toggle/merge;
- owner mismatch suspends and never rebinds a nonempty dataset;
- corrupt/missing outbox plus B sign-in/consent cannot rebind A's nonempty
  dataset because source-envelope/primary binding replicas survive; interrupted
  replica writes recover only for A after server verification;
- conflicting/all-lost binding commitments with nonempty sources fail closed as
  `binding_recovery_required`;
- consent defaults off; allowlisted plus signed-in without consent performs zero
  enroll/source-copy requests; revocation stops future source-copy requests
  without clearing local sources or claiming hosted deletion, while an already
  enrolled dataset may still send explicit cancel/tombstone/state/parity safety
  requests;
- capacity reports blocked and never evicts;
- subscriptions fire for meaningful state changes but do not loop on access
  bookkeeping.

**Commit:** `feat(memory): add durable mirror work outbox`

### Task 4: Atomic PostgreSQL MIRROR Ingestion

**Files:**

- Create: `backend/sql/migrations/0003_memory_mirror_ingestion.sql`
- Create:
  `backend/sql/overlays/supabase/0002_memory_mirror_ingestion.sql`
- Create: `scripts/build-cloud-memory-phase1-migration.mjs`
- Populate generated:
  `supabase/migrations/20260729062655_cloud_memory_phase_1_mirror.sql`
- Create: `supabase/tests/cloud_memory_phase1_mirror.test.sql`
- Create:
  `__tests__/services/cloudMemoryPhase1MigrationContract.test.ts`

**Steps:**

1. Write static migration contract tests first.
2. Generate the migration; never hand-edit generated output.
3. Reset local Supabase from clean state.
4. Run Phase 0 pgTAP and Phase 1 pgTAP.
5. Run local database lint.
6. Prove:
   - a confirmed but non-allowlisted owner cannot enroll, allocate owner/import
     rows, or reserve request budget; disabling an enrolled owner blocks every
     later mutation;
   - a verified JWT whose `session_id` row was revoked cannot mutate during its
     remaining access-token lifetime, while another still-live session for the
     same owner remains independently valid;
   - exact rolling-minute/day, staged conversation/message, observed revision,
     compact-manifest receipt, and live completion-permit quota boundaries
     return stable failures without partial rows;
   - two-owner RLS/ACL isolation;
   - direct table mutations remain denied;
   - identical manifest/chunk/event replay is identical;
   - verified completion applies the manifest mutation set to authoritative
     owner-current-source rows, records the resulting version/receipt/count/hash,
     and compacts chunks/import-items into the bounded manifest summary while an
     identical completed-chunk retry reconstructs the same receipt and a changed
     retry conflicts;
   - changed replay conflicts;
   - equal/lower/higher source and message revision semantics, including a first
     observed revision greater than `1`, adjacent append, accepted coalesced
     jump, wrong `previousAcceptedRevision`, removal, role/time change, and
     collision-safe sequence reorder;
   - create plus two edits before first upload stores only the observed current
     snapshot as `first_observed`; two offline edits after MIRROR append one
     `coalesced_gap` snapshot with exact numeric gap bounds; no missing
     intermediate revision/content row is invented;
   - out-of-order/over-limit chunks fail;
   - exact limits and limit-plus-one pass/fail, a conversation safely spans
     chunks, and one oversize message blocks without truncation;
   - payload/hash mismatch rolls back all rows;
   - concurrent different owners do not block each other;
   - same-owner manifest operations serialize;
   - two-device same-owner: device A and device B begin with shared stable IDs,
     create disjoint local additions while offline, and use different dataset
     commitments/generations; a second begin while A's manifest is active
     returns a stable `ACTIVE_IMPORT_EXISTS` conflict; after A completes, a stale
     shared-source B snapshot with an older `previousAcceptedRevision` is
     rejected by revision CAS and never overwrites A's accepted rows, while B's
     disjoint additions complete without A-only prose; the server carries A's
     verified rows into the owner union; A and B receive distinct logical-
     manifest receipts/versions, identical retries return each manifest's stored
     receipt, and both devices converge on B's latest owner-union receipt/version;
     every accepted A and B revision remains visible; a higher owner-scoped
     tombstone accepted from A suppresses the same stable identity from B and B
     cannot re-upload or resurrect it (§7.4);
   - tombstone-before-upload cannot resurrect;
   - tombstone acceptance immediately makes existing rows ineligible;
   - cancel/supersede survives process loss, never makes partial rows eligible,
     and safely prunes only unverified staging;
   - cancellation keeps its compact idempotent receipt while pruning only that
     manifest's unverified staged membership/revisions, orphan staged-only
     conversation/message identities, and staged watermark state; repeated
     unique-ID upload/cancel cycles cannot escape the retained-row quota, and
     expired/consumed permit cleanup cannot remove a completion receipt;
   - a cancelled edit never overwrites or de-eligibilizes the last verified
     current revision;
   - verified generation G followed by a partial edit/reorder G+1 and
     cancel/failure leaves G byte-identical; verified G+2 atomically applies
     touched revisions while omitted rows remain byte-identical and eligible;
   - finalization rejects every count/hash/membership mismatch;
   - after verified A, a nonempty manifest containing only B succeeds without
     A-only prose; the owner-union receipt/count/hash still includes A and B;
     ordinary absence never deletes or silently excludes A, while an explicit
     higher A tombstone removes A immediately;
   - repeated max-size completions with one changed revision do not retain
     20,000 membership rows per generation; only observed revisions plus one
     bounded compact manifest receipt per generation remain;
   - finalization alone changes `LOCAL -> MIRROR`;
   - completion at LOCAL, MIRROR, SHADOW, and CLOUD proves respectively
     bootstrap transition, exact preservation, exact preservation, and exact
     preservation; stale authority versions fail with zero state/flag change;
   - concurrent enroll/complete/tombstone requests return one stable receipt per
     logical operation, enroll never demotes, and an identical completion retry
     never double-increments either authority or source-set version; sequential
     manifest generations produce distinct monotonic owner-union receipts;
   - expired/reused/wrong-owner/wrong-generation completion permits cannot
     promote rows or authority, including a request delivered after permit
     expiry;
   - identical completion retry after permit consumption/expiry returns the
     stored receipt; changed retry and cross-manifest permit reuse conflict;
   - all non-mirroring flags remain false.
   - every exact new `SECURITY DEFINER` signature fixes an empty search path,
     revokes execution from `PUBLIC`, `anon`, `authenticated`, and
     `service_role`, then grants only the intended signature to `service_role`;
     pgTAP/static tests enumerate the whole set separately from RLS tests.
   - the migration-contract/pgTAP checks enumerate every new Phase 1 table from
     §5.1 by name — including `memory_import_completion_permits` (completion
     permits), `memory_mirror_owner_allowlist`, `memory_mirror_rate_limits`,
     `memory_import_items`, `memory_conversation_revisions`, plus the additive
     fields/views — and assert the Phase 0 `memory_source_watermarks` table is
     not extended and is never the mirror sequencing authority (§4.2); assert
     `current_source_manifest_id` is audit-only, eligible current rows define
     membership, and source-set version/receipt/count/hash advance atomically.
7. Run advisors locally where supported.

**Sabotage:** Capture each deliberate red result, restore, and rerun green:

- remove the writer assertion from the new chunk RPC;
- trust the client-supplied hash rather than recomputing it independently in
  PostgreSQL;
- move chunk receipt/membership writes outside the chunk transaction;
- move completion receipt/current-owner-union promotion outside the completion
  transaction;
- replace cumulative eligible-row membership with exact newest-manifest
  membership, or make omission delete a prior eligible conversation;
- allow an import to overwrite a deletion commitment.

The focused pgTAP/static/integration guard for each removed invariant must fail;
a fault-injection outcome alone is not a substitute.

**Commit:** `feat(memory): add atomic mirror ingestion schema`

### Task 5: Backend Hashing, Repository, Routes, and Kill Switch

**Files:**

- Create: `backend/src/memory/hashing/sourceHash.ts`
- Create:
  `backend/src/memory/repositories/sourceMirrorRepository.ts`
- Create: `backend/src/memory/routes/sourceMirrorRoutes.ts`
- Modify: `backend/src/memory/gateway/postgrestGateway.ts`
- Modify: `backend/src/memory/config.ts`
- Modify: `backend/src/auth/supabaseAuth.ts`
- Modify: `backend/src/app.ts`
- Modify: `backend/src/index.ts`
- Modify: `backend/src/readiness.ts`
- Modify: `backend/.env.example`
- Create: `backend/src/__tests__/sourceHash.test.ts`
- Create: `backend/src/__tests__/sourceMirrorRepository.test.ts`
- Create: `backend/src/__tests__/sourceMirrorRoutes.test.ts`
- Create: `backend/src/__tests__/sourceMirrorApp.integration.test.ts`
- Modify: `backend/src/__tests__/appComposition.test.ts`
- Modify: `backend/src/__tests__/memoryConfig.test.ts`
- Modify: `backend/src/__tests__/postgrestGateway.test.ts`
- Modify: `backend/src/__tests__/supabaseAuth.test.ts`

**TDD cases:**

- owner body/query fields rejected and never forwarded;
- owner always comes from verified JWT;
- verified `sub`, auth user ID, and `session_id` must agree; the repository
  forwards the derived session ID to every mutation and a revoked session is
  rejected even before access-token expiry;
- pre-existing anonymous JWTs are rejected for mirror mutations even though
  they use Supabase's authenticated database role;
- disabled kill switch rejects writes but leaves GET state/inventory healthy;
- confirmed but non-allowlisted/disabled owners map to stable blocked results,
  and the central mutation wrapper reserves rate budget before calling any
  mutation;
- rate limits return typed `429` with database-derived retry timing; staging,
  permit, and retained-revision quotas return stable blocked codes;
- `MIRROR_WRITES_DISABLED` suspends rather than entering generic 5xx retry;
- each stale epoch/lease/token/fingerprint/mode fence failure maps to its stable
  suspended code; only true dependency/transient failures back off;
- exact payload validation and encoded-byte/item bounds;
- Node SHA vectors;
- `MEMORY_WRITER_EPOCH` is required explicitly and a stale deployment never
  queries the database for a newer epoch to echo back;
- the gateway credential is selected once, its SHA-256 fingerprint is derived
  in backend memory from those exact credential bytes, and it must match both
  the expected configuration and hosted authority row;
- deployment ID, epoch, lease ID/token, and derived fingerprint come from one
  centralized write-context provider and are injected into every mutation;
- readiness compares epoch and derived fingerprint without exposing the
  credential, fingerprint input, lease token, or raw configuration;
- stable response and error parsing;
- timeout/503/409/422 mapping;
- raw upstream bodies and journal content never reach logs/responses;
- invalid repository rows fail closed;
- identical route retry returns identical receipt.

**Sabotage:** Capture each red result, restore, and rerun green:

- let configuration accept a missing epoch;
- trust the asserted credential fingerprint without deriving it from the
  selected key;
- trust a body/query owner instead of the verified JWT subject;
- trust a client chunk hash instead of recomputing it in Node;
- log the raw validated request/error payload rather than the redacted
  structured diagnostic.

The config, credential-swap, owner-isolation, hash-vector, and synthetic-secret/
phrase log-scan guards respectively must fail before restoration.

**Commit:** `feat(backend): expose fenced mirror ingestion api`

### Task 6: Explicit Memory Session and Authenticated Client

**Files:**

- Create: `services/memory/cloud/mirrorConfig.ts`
- Create: `services/memory/cloud/mirrorSession.ts`
- Create: `services/memory/cloud/mirrorHttpClient.ts`
- Modify: `.env.example`
- Create: `__tests__/services/memory/cloud/mirrorConfig.test.ts`
- Create: `__tests__/services/memory/cloud/mirrorSession.test.ts`
- Create: `__tests__/services/memory/cloud/mirrorHttpClient.test.ts`
- Modify: `__tests__/envBundleSafety.test.ts`
- Modify: `__tests__/dataProvider.test.ts`
- Modify: `__tests__/supabaseClient-local-only.test.ts`

**TDD cases:**

- HTTPS required except loopback development;
- endpoint/deployment/epoch are non-secret fixed profile fields;
- memory config independent of `EXPO_PUBLIC_DATA_PROVIDER`;
- no session means no upload and no anonymous sign-in;
- no current owner/dataset-bound user consent means zero mirror HTTP requests
  even when signed in, allowlisted, and both kill switches are enabled;
- existing session refresh is single-flight;
- bearer subject, owner binding, server state owner, deployment, epoch, and
  monotonic authority version must agree;
- pre-existing anonymous sessions are rejected without calling anonymous
  sign-in;
- bootstrap upload requires a parsed `MirrorEnrollmentUploadPermit` and never
  changes the visible `MemoryRuntimeRoute` from LOCAL;
- no writer/service credential is accepted in client config;
- token never appears in errors, outbox, or logs;
- one refresh retry on 401;
- retryable/blocked/conflict errors are typed.

**Commit:** `feat(memory): add authenticated mirror transport`

### Task 7: Deterministic Chunking, Reconciliation, Resume, and Parity

**Files:**

- Create: `services/memory/cloud/mirrorSourceLoader.ts`
- Create: `services/memory/cloud/mirrorChunks.ts`
- Create: `services/memory/cloud/mirrorSourceMutationGate.ts`
- Create: `services/memory/cloud/mirrorCoordinator.ts`
- Create: `__tests__/services/memory/cloud/mirrorChunks.test.ts`
- Create:
  `__tests__/services/memory/cloud/mirrorCoordinatorAuthority.test.ts`
- Create:
  `__tests__/services/memory/cloud/mirrorCoordinatorRecovery.test.ts`
- Create:
  `__tests__/services/memory/cloud/mirrorCoordinatorParity.test.ts`
- Create:
  `__tests__/services/memory/cloud/mirrorSourceMutationGate.test.ts`

**TDD cases:**

- draft exclusion and exact deterministic sorting;
- chunk item/byte limits;
- LOCAL/no enrollment does not upload;
- pending enrollment uploads but never enables cloud reads;
- verified completion accepts MIRROR and persists greatest version;
- malformed/stale/wrong-owner state fails closed;
- duplicate full flush produces no duplicate source/revision/chunk;
- interruption after each chunk resumes from server receipt;
- process restart recreates the same chunk for unchanged generation;
- mutation during upload prevents completion of the stale manifest and
  schedules a superseding generation; only the still-current local generation
  may invoke the authority-transition completion RPC;
- before every chunk and completion, generation/source-revision drift or a
  pending tombstone cancels the obsolete manifest; after process death, startup
  reconciliation performs the same cancel from persisted manifest/generation
  metadata before starting a new import;
- source owners and the completion path share a short, stable-order mutation
  barrier so the final local-generation recheck and completion request cannot
  race a local source mutation; timeout records the persisted
  `completion_outcome_unknown` guard, retains the barrier through the
  permit-expiry safety margin, and reconciles the idempotent receipt/state
  without claiming the database stayed LOCAL;
- missing dirty mark is recovered by full cursor reconciliation;
- tombstones flush before source chunks;
- parity mismatch never acknowledges local generation;
- completion response loss enters indeterminate reconciliation; delayed request
  arrival beyond the server-issued permit expiry produces zero promotion, while
  a commit before expiry returns the identical receipt after reconnect;
- force-stop after durable permit guard plus complete dispatch, relaunch, and
  immediate edit cannot bypass the full quarantine; delivering the delayed old
  request never promotes a stale generation;
- remove/corrupt the outbox immediately after completion dispatch, relaunch,
  attempt an edit, and deliver the delayed old request; the unknown-permit
  quarantine plus owner/import reconciliation prevents stale promotion even
  without a recoverable manifest/permit ID;
- one coordinator per owner and bounded work/yield;
- local source and visible context remain unchanged after every failure.

**Sabotage:** Capture each red result, restore, and rerun green:

- acknowledge an outbox generation before verified completion;
- enable MIRROR cloud reads in the visible `MemoryRuntimeRoute`;
- couple mirror upload enablement to `EXPO_PUBLIC_DATA_PROVIDER`.

The restart/parity, visible-local authority, and provider-independence guards
respectively must fail before restoration.

**Commit:** `feat(memory): coordinate resumable source mirroring`

### Task 8: Harden Source Owners and Couple MIRROR Work

**Files:**

- Modify: `services/journal/journalStorage.ts`
- Modify: `services/journal/journalStorage.types.ts`
- Create: `utils/deletionCommitmentBucket.ts`
- Create: `services/journal/journalSourceShards.ts`
- Create: `services/journal/journalDeletionCommitments.ts`
- Modify: `services/journal/journalRemote.ts`
- Modify: `services/intentions/intentionsStorage.ts`
- Modify: `services/intentions/intentionsStorage.types.ts`
- Create: `services/intentions/checkInSourceShards.ts`
- Create: `services/intentions/checkInDeletionCommitments.ts`
- Modify: `services/intentions/intentionsRemote.ts`
- Modify: `services/supabase/syncQueue.ts`
- Create: `plugins/withAsyncStorageDatabaseSize.js`
- Modify: `app.json`
- Modify: `services/journal/journalFinishSideEffects.ts` only if scheduling
  belongs after all local finish writes.
- Modify: `services/intentions/intentionChatCompletion.ts`
- Modify: `__tests__/services/journalStorage.test.ts`
- Modify the focused journal remote-merge tests.
- Create: `__tests__/services/journalDeletionCommitments.test.ts`
- Create: `__tests__/services/journalSourceShards.test.ts`
- Create: `__tests__/utils/deletionCommitmentBucket.test.ts`
- Modify: `__tests__/services/intentions/intentionsStorage.test.ts`
- Modify the focused intention remote-merge tests.
- Create: `__tests__/services/checkInDeletionCommitments.test.ts`
- Create: `__tests__/services/checkInSourceShards.test.ts`
- Modify: `__tests__/services/supabase/syncQueue.test.ts`
- Create: `__tests__/plugins/withAsyncStorageDatabaseSize.test.ts`
- Modify:
  `__tests__/services/intentions/intentionChatCompletion.test.ts`
- Create:
  `__tests__/services/memory/cloud/mirrorSourceCoupling.test.ts`

**Steps and gates:**

- migrate raw journal/check-in maps losslessly into lightweight versioned roots,
  paged source indexes, one source metadata key, revision-scoped message pages,
  compact monotonic revision counters, the replicated dataset-owner commitment,
  fixed deletion-page heads/inline handoff, and permanent content-free paged
  deletion commitments;
- migrate through copy-on-write feature intents; failure at every page/meta/
  pointer/cleanup boundary returns either the complete old or complete new
  source, never a partial conversation;
- configure generated Android builds through a tested Expo config plugin with
  `AsyncStorage_db_size_in_MB=256`; it changes only the aggregate SQLite ceiling
  while source/message pages remain far below the per-key limit;
- put every read-modify-write behind the source owner's lock;
- guard every parse with corruption-safe behavior;
- preserve existing keys and all user data;
- dirty-mark only after successful local create/update;
- reconcile the last accepted server cursor against the current local revision;
  cover create plus two edits before first upload as one honest
  `first_observed` snapshot, and two offline edits after MIRROR as one honest
  `coalesced_gap` snapshot with no invented intermediate prose;
- remove source content and add its tombstone in the same serialized owner-key
  write for individual delete, then complete the page handoff in write-ahead
  order; clear uses the durable maintenance saga rather than one oversized key;
- retain every compact deletion commitment throughout Phase 1 after
  acknowledgement; purge only per-sink retry/attempt state. A legacy provider
  enabled later must consult the commitment and schedule its deletion rather
  than relying on the generic queue's historical acknowledgement;
- legacy provider pull/merge/push paths filter every locally tombstoned source
  ID, so a failed legacy remote delete, restart, or clear cannot resurrect it;
- every legacy pull/push/merge/enqueue/flush derives the current auth owner and
  requires it to equal the same durable dataset binding. A mismatched or
  binding-recovery-required dataset performs zero legacy network/merge work;
  queued tasks are schema-versioned, serialized, owner-bound, never evict the
  oldest item, and a task for A is never flushed under B;
- once a source is completed, reject `completed -> draft` regression in the
  source owner. Editing a completed record keeps it completed; reopening uses a
  new draft/source rather than silently leaving an eligible mirror behind;
- recover the remaining source-key/outbox dirty-mark crash window through full
  reconciliation;
- retain and run all current local memory/day/identity/session side effects;
- local completion succeeds offline even when mirror scheduling fails;
- no chat screen imports the mirror service.
- remote provider rows matching owner-key tombstones never reappear after
  failed remote delete, relaunch, merge, push, clear, or a later
  `local -> supabase` provider toggle;
- A→B→A account switching with legacy Supabase enabled and pending mirror/legacy
  work produces zero A rows in B, zero B rows merged into A's local dataset, and
  resumes only the matching owner;
- commitment pages pass exact 256-item/64-KiB boundary and overflow to a new
  page; fault injection at owner inline write, page write, and handoff clear
  always recovers one permanent commitment without source resurrection;
- UTF-8 FNV-1a bucket golden vectors agree on Hermes-compatible JS inputs; the
  helper is documented as non-security distribution and imports no I/O/crypto;
- a real Android 20,000-message aggregate plus a multi-page single conversation
  writes, force-stops, relaunches, and reads exact order/content with no key
  above its declared ceiling; limit-plus-one mirror blocking never blocks the
  ordinary local save;
- `completed -> draft` rejects atomically for journals and check-ins without
  changing local content, revision, tombstone, or mirror state.

**Sabotage:** Run two concurrent creates/updates with a barrier storage adapter;
the old unlocked implementation must lose one write and the hardened
implementation must retain both.

**Commit:** `feat(memory): couple local sources to mirror reconciliation`

### Task 9: Lifecycle, Background Retry, and Non-Technical Status UI

**Files:**

- Create: `services/workers/memoryMirrorWorker.ts`
- Modify: `services/workers/taskNames.ts`
- Modify: `services/workers/taskRegistry.ts`
- Modify: `services/workers/index.ts`
- Create: `hooks/memory/useMemoryMirrorStatus.ts`
- Create: `hooks/memory/useMemoryMirrorLifecycle.ts`
- Create: `hooks/memory/useMemoryMirrorConsent.ts`
- Modify: `components/settings/MemorySettingsSection.tsx`
- Create: `components/settings/SettingsScreenContent.tsx`
- Modify: `app/(tabs)/settings.tsx`
- Modify: `app/(auth)/login.tsx`
- Modify: `components/InlineTypingInput.tsx`
- Modify: `components/FooterActions.tsx`
- Modify: `components/settings/DataManagementSection.tsx`
- Modify: `app/entry-detail.tsx`
- Modify: `app/checkin-detail.tsx`
- Modify: `app/_layout.tsx`
- Create: `__tests__/services/workers/memoryMirrorWorker.test.ts`
- Modify: `__tests__/services/workers/taskRegistry.test.ts`
- Modify: `__tests__/app/_layout-workers.test.tsx`
- Create: `__tests__/hooks/useMemoryMirrorStatus.test.tsx`
- Create: `__tests__/hooks/useMemoryMirrorLifecycle.test.tsx`
- Create: `__tests__/hooks/useMemoryMirrorConsent.test.tsx`
- Modify: `__tests__/components/MemorySettingsSection.test.tsx`
- Create: `__tests__/components/SettingsScreenContent.test.tsx`
- Modify/create focused login, shared chat input/footer, data-management, entry
  detail, and check-in detail tests.
- Modify: `__tests__/backend-local-only.test.ts`

**Behavior:**

- startup and foreground triggers reconcile/flush;
- background fetch is opportunistic only;
- correctness never depends on the OS scheduling it;
- single-flight prevents duplicate foreground/background flushes;
- cloud mirroring defaults off and the setting presents the complete
  plain-language scope/retention disclosure before the first user opt-in;
- granting consent binds its version to the current explicit owner/local
  dataset; revoking it immediately stops new source-copy attempts, allows only
  bounded cancel/state/parity and explicit deletion-tombstone safety traffic for
  an already enrolled dataset, retains local data and pending work, and clearly
  says existing hosted copies require delete/clear rather than claiming they
  vanished;
- settings says one of:
  `On device`, `Waiting for sign in`, `Preparing cloud mirror`, `Syncing`,
  `Up to date`, `N changes waiting`, or `Paused`;
- detail always explains that Rosebud still uses on-device memory in Phase 1;
- retry goes through the hook, never UI-to-service;
- consent grant/revoke goes through its hook, never UI-to-service;
- before adding wiring, split the existing 473-line settings route into a thin
  route and `SettingsScreenContent`; each design/UI file stays below 450 lines
  (hard max 500) and `npm run check:design` guards the extraction;
- `_layout.tsx` invokes the lifecycle hook and never imports the coordinator or
  cloud-memory service directly; a static layering test guards app/screens;
- no raw error or technical identifier is shown;
- real entry/check-in detail screens expose confirmed, hook-layered delete
  actions so offline tombstones are user-reachable rather than test-only;
- auth fields, mirror consent/status/retry, new entry/check-in navigation, shared
  typing input/Finish, entry/check-in delete, clear/restore, and confirmation
  controls have stable unique `testID` plus human accessibility labels. These
  are production accessibility contracts, not a debug service bypass;
- all text has light/dark tokens and reduced-motion behavior remains unchanged.

**Commit:** `feat(settings): show cloud mirror status`

### Task 10: Clear, Backup Restore, and Documentation Coupling

**Files:**

- Modify: `hooks/journal/useClearJournalHistory.ts`
- Create: `services/memory/cloud/sourceMaintenanceSaga.types.ts`
- Create: `services/memory/cloud/sourceMaintenanceSaga.ts`
- Modify: `services/backup/localBackup.ts`
- Modify: `__tests__/hooks/useClearJournalHistory.test.ts`
- Modify: `__tests__/localBackup.test.ts`
- Modify:
  `__tests__/services/backup/sessionDigestBackupShard.test.ts`
- Create:
  `__tests__/services/memory/cloud/sourceMaintenanceSaga.test.ts`
- Create:
  `__tests__/services/memory/cloud/restoreRevisionRebase.test.ts`
- Create:
  `__tests__/services/backup/deletionCommitmentBackupShard.test.ts`
- Create:
  `__tests__/services/backup/sourceBackupShard.test.ts`
- Modify: `AGENTS.md`
- Modify: `memory.md`
- Modify: `PLAN.md` and identical `plan.md`
- Modify: `notes/supabase-setup.md`
- Modify: `notes/local-only-storage.md`
- Modify: `backend/README.md`

**Behavior:**

- clear/restore first persist a versioned maintenance intent, acquire the global
  source gate and feature locks in stable order, and resume before mirror/
  legacy reconciliation after force-stop;
- clear stages all paged content-free deletion commitments before removing
  source records, then clears derived stores in idempotent recorded phases;
- outbox work, tokens, attempts, cursors, receipts, and retry state are excluded
  from portable local backup;
- backups contain the current source records, compact revision counters, and
  permanent content-free deletion commitments, but no intermediate revision
  payload chain; delete/clear removes source prose before a new backup;
- deletion commitment pages remain sharded in backup: lightweight page IDs and
  hashes live in the backup manifest, while bodies live under
  `@blackrose_local_backup_deletion_commitment:<backupId>:<sourceKind>:<bucket>:<page>`;
  backup/restore validates every referenced page and never packs all lifetime
  commitments into `@blackrose_local_backups`;
- source metadata/message pages likewise remain sharded under
  `@blackrose_local_backup_source:<backupId>:<sourceKind>:<sourceId>:<revision>:<page>`;
  the backup manifest stores only validated page IDs/hashes, so one year of
  transcripts is never repacked into a single backup index value;
- restored deletion commitments continue to suppress legacy remote merges and
  schedule deletion if the legacy Supabase provider is enabled later;
- backup schema includes only the non-secret dataset commitment
  `(boundOwnerId, datasetId, greatestKnownGeneration)`;
- restore schedules a fresh full reconciliation;
- restore creates a new import generation, checks the server-reported greatest
  generation to avoid manifest reuse, and never replays another owner's pending
  work;
- same-owner restore reconciles server source/message cursors before upload:
  older non-tombstoned restored content is atomically rebased above server
  revisions with honest gap provenance; a server-tombstoned stable ID remains
  `restored_deleted_source_local_only` and cannot upload/resurrect;
- a restored nonempty dataset under the wrong owner is locally available but
  remains `restored_owner_confirmation_required` with zero upload until the
  recorded owner signs in or a later explicit migration is authorized;
- complete local sources remain present throughout Phase 1 except explicit user
  deletion;
- force-stop at every clear/restore intent, source key, commitment page, derived
  key, cursor fetch, and rebase boundary resumes to one coherent result before
  any network mutation; concurrent edits cannot interleave;
- docs state that Phase 9 remains final and no provider-independent recovery
  claim exists.

**Commit:** `docs(memory): document mirror operations and recovery`

### Task 11: Real Local PostgreSQL/PostgREST Verification

**Files:**

- Create:
  `backend/src/__tests__/localMirrorPostgrest.integration.test.ts`
- Create: `backend/sql/tests/local_mirror_integration_helper.sql`
- Update pgTAP as required without exceeding honest scope.

**Commands:**

```powershell
npx supabase start
npx supabase db reset --local --no-seed
npx supabase test db supabase/tests/cloud_memory_foundation.test.sql --local
npx supabase test db supabase/tests/cloud_memory_phase1_mirror.test.sql --local
npx supabase db lint --local --level warning --fail-on warning
$statusJson = npx supabase status -o json | ConvertFrom-Json
$psql = 'C:\Program Files\PostgreSQL\17\bin\psql.exe'
& $psql $statusJson.DB_URL -X -v ON_ERROR_STOP=1 -f backend/sql/tests/local_postgrest_lock_helper.sql
& $psql $statusJson.DB_URL -X -v ON_ERROR_STOP=1 -f backend/sql/tests/local_mirror_integration_helper.sql
try {
  $env:SUPABASE_LOCAL_URL = $statusJson.API_URL
  $env:SUPABASE_LOCAL_ANON_KEY = $statusJson.ANON_KEY
  $env:SUPABASE_LOCAL_SERVICE_ROLE_KEY = $statusJson.SERVICE_ROLE_KEY
  $env:RUN_SUPABASE_LOCAL_TESTS = '1'
  npm --prefix backend test -- --testPathPattern=localPostgrest.integration
  if ($LASTEXITCODE -ne 0) { throw 'localPostgrest integration failed' }
  npm --prefix backend test -- --testPathPattern=localMirrorPostgrest.integration
  if ($LASTEXITCODE -ne 0) { throw 'localMirrorPostgrest integration failed' }
} finally {
  Remove-Item Env:SUPABASE_LOCAL_URL,Env:SUPABASE_LOCAL_ANON_KEY,Env:SUPABASE_LOCAL_SERVICE_ROLE_KEY,Env:RUN_SUPABASE_LOCAL_TESTS -ErrorAction SilentlyContinue
}
```

The real PostgREST test must send actual JSON over HTTP and prove duplicate,
interrupt/resume, changed replay, owner isolation, transactional rollback,
tombstone priority, exact source fields, parity finalization, and MIRROR-only
flags. It must create two disposable users through real local Supabase Auth,
obtain their real bearer tokens, traverse Express authentication and owner
derivation, and clean both users/rows in `finally`; service-role RPC calls alone
do not satisfy this gate.

**Commit:** `test(memory): verify real mirror postgrest lifecycle`

### Task 12: Full Local Quality Gate and Independent Review

Use the Task 1 evidence harness. It writes only outside the repository under a new UTC-named
directory in
`C:\Users\sigmu\AppData\Local\Temp\blackrose-phase1-evidence-*`. It records
branch/commit, dirty filenames, tool versions, UTC start/end, exact command exit
codes/test totals, redacted output hashes, fixture/receipt IDs, counts/hashes,
cleanup counts, Heroku release/image identity, Supabase migration/project
identity, screenshots, sabotage red/green pairs, and a final SHA-256/size
manifest. It rejects zero-match tests, missing cleanup, stale artifacts from a
prior implementation commit/run, secret-shaped values, real journal prose, and
incomplete commands. Every manifest records `implementationCommit`, the
deployable-tree SHA-256, migration SHA-256/version, and an optional later
`evidenceCommit`; a later commit is accepted only under Task 17's exact
evidence-only diff rule.

At the exact clean pre-host candidate commit, run one fresh local
orchestration:

```powershell
$candidateCommit = (git rev-parse HEAD).Trim()
node scripts/phase1/run-mirror-evidence.mjs --mode local --expected-commit $candidateCommit
```

`--mode local` itself freshly runs and records: roadmap and immutable guards;
focused contract/evidence tests; `supabase start`; no-seed reset; Phase 0 and
Phase 1 pgTAP; database lint; both real local Auth/PostgREST/Express integration
tests with `finally` env cleanup; root TypeScript/lint/design/full Jest; backend
build/full tests; Linux/amd64 Docker build and artifact probe; `git diff
--check`; protected-file diff; and final clean status. One skipped/missing/
failed child, wrong commit, dirty implementation file, or cleanup failure makes
the evidence run incomplete.

Because the unattended linked CLI has no access token, Task 14 reconciles the
provisional migration filename to the connected operation's exact remote
version. That byte-identical rename/literal update creates the final
`implementationCommit`; the complete local orchestration above must run again
fresh at that final commit before Task 15.

Then dispatch independent reviewers for:

- database transactions/RLS/fencing/hash correctness;
- client durability/account isolation/visible-local boundary;
- tests and real-failure coverage;
- secrets/logging/deployment readiness;
- plan/roadmap completion truth.

Fix verified findings with TDD and repeat every affected gate.

### Task 13: Renew the Writer Lease if Required

The last read-only audit found the current lease too close to expiry for a safe
implementation/deployment window. If the lease has less than 24 hours remaining:

1. Start `scripts/phase1/rotate-writer-lease.mjs` as a long-lived, secret-safe
   helper. It reads Heroku config through the Platform API, retains the prior raw
   lease ID/token only in process memory, captures the prior non-secret database
   lease metadata supplied by the root orchestrator, generates a fresh 32-byte
   token/UUID with a cryptographic RNG, and emits only lease IDs, digests,
   expiry, state, and a one-run control nonce.
2. Disable mirror writes and prove mutation routes are fenced before changing
   either side.
3. Root applies a compare-and-set connected-Supabase transaction from the
   captured prior lease ID/digest/expiry to the new digest/ID/operator key
   metadata. Raw tokens never cross into SQL, output, files, or evidence.
4. Only after the database update is confirmed does the live helper set the new
   raw token/lease ID in Heroku config. During the mismatch window readiness may
   be false and writes remain disabled.
5. Keep deployment ID `blackrose-primary`, writer epoch `1`, source
   fingerprint, and database fingerprint unchanged.
6. Verify old token, wrong token, old lease ID, expired lease, and stale database
   metadata fail; verify the new pair restores `/ready`; then leave writes
   disabled until migration/backend smoke checks pass.
7. Signal the helper to finalize and zero its in-memory prior/new raw values only
   after readiness and fence probes pass.

Compensation is two-sided and ordered. Any failure after the database update
first restores the exact prior database lease ID/digest/expiry/operator metadata
through a connected compare-and-set transaction, then signals the still-live
helper to restore the exact prior raw Heroku lease values, keeps mirror writes
disabled, and verifies the old readiness/fence again. If the helper dies, do not
guess the lost token: generate a fresh recovery lease under the same disabled-
writes protocol and make both sides agree before continuing. The helper test
deliberately fails immediately after the Supabase update and proves both
compensations plus `/ready` recovery; raw secret-shaped values must be absent
from stdout, stderr, evidence, process arguments, and temp files. A valid
credential alone never authorizes writes.

### Task 14: Deploy the Forward-Only Migration to Supabase

**Hosted-target decision:** No paid Supabase preview branch/project has been
cost-approved, and this personal fixed primary currently has zero owners,
sources, manifests, and chunks. The product owner explicitly authorized
deployment to the existing Supabase/Heroku pair and asked not to pause for
review. This Phase 1-specific decision therefore permits only the reviewed
forward-only additive migration on exact project `tovejzoqyduelgzsajru`, with
mirror writes disabled, after all clean local PostgreSQL/PostgREST/Auth gates.
It does not authorize a reset, destructive pgTAP, alternate target, or paid
branch. If any preflight count is nonzero/unexpected, the project ID differs, or
the migration cannot apply transactionally, stop rather than treating this
exception as general production permission.

Preconditions:

- exact clean pre-host candidate commit exists; the reconciled final
  implementation commit is created and fully reverified in this task before
  Heroku deployment;
- all Task 12 gates pass;
- protected applied migrations and lockfiles are unchanged;
- the live project is `ACTIVE_HEALTHY`;
- writer lease remains valid long enough for deployment or is safely renewed;
- hosted source/owner/import counts are still the expected baseline.

Steps:

1. Read-only query the connected project ID, health, PostgreSQL version,
   migration history, deployment authority, writer lease, and exact
   owner/source/manifest/chunk counts. Compare to the captured Task 1 baseline.
2. Hash the committed generated migration and rerun its deterministic builder
   in `--check` mode.
3. The preferred linked CLI workflow was tested read-only and is unavailable:
   it exits `Access token not provided`, and no `SUPABASE_ACCESS_TOKEN` or
   database password is present. Do not invent/extract credentials or pause the
   unattended run. Capture the exact connected
   `supabase_migrations.schema_migrations` rows, then apply the committed query
   once through the connected Supabase migration operation with the unique name
   `cloud_memory_phase_1_mirror_<migration-hash-prefix>`. Query history again
   and require exactly one new version/name whose definitions match the
   committed query; never run a reset or paste a modified variant.
4. Before the final implementation commit, move—not modify—the provisional
   local migration to
   `supabase/migrations/<remote-version>_cloud_memory_phase_1_mirror.sql` with
   `apply_patch`, update the builder/tests/plan literal, and prove its SHA-256 is
   byte-identical to the pre-apply artifact. Query remote history again to prove
   the local version is now present exactly once and no provisional version was
   recorded. Rerun local reset/pgTAP/lint and the complete Task 12 evidence at
   this reconciled final implementation commit before deploying Heroku.
5. Record the exact hosted/local version, committed migration SHA-256, before/
   after history, and compare hosted function/table definitions to the
   committed migration.
6. Execute a disposable two-owner managed-PostgREST/RPC fixture against the
   committed function contracts. In the root orchestrator, use connected SQL to
   add only those two exact confirmed Auth owner UUIDs to
   `memory_mirror_owner_allowlist` before enrollment; the fixture itself has no
   operator bypass. The real bearer-token Express matrix runs after the new
   Heroku image is available in Task 15.
7. Prove RLS, RPC ACL, fence failures, idempotency, rollback, tombstone, parity,
   and `LOCAL -> MIRROR` flags.
8. In the root orchestrator's `finally`, keep mirror writes disabled and use the
   connected Supabase SQL operation to run one transaction deleting only the
   exact run owner UUIDs from Phase 0/1 dependent tables in foreign-key order;
   do not ship a cleanup RPC or use a broad timestamp/prefix predicate.
   The reviewed allowlist is: `turn_traces`, `memory_job_attempts`,
   `memory_evidence_spans`, `memory_jobs`, `memory_import_items`,
   `memory_import_chunks`, `memory_import_completion_permits`,
   `memory_import_manifests`, `memory_message_revisions`,
   `memory_messages`, `memory_conversation_revisions`,
   `memory_conversations`, `memory_deletion_ledger`,
   `memory_source_watermarks`, `memory_mirror_rate_limits`,
   `memory_owner_state`, then
   `memory_mirror_owner_allowlist`; fail if hosted Phase 0/1 owner-scoped tables
   differ from this enumerated set.
   `mirror-hosted-e2e.mjs` then signs out/revokes sessions and deletes the exact
   disposable Auth users through the Supabase Admin API using the Heroku-held
   secret only in process memory.
9. Query every owner-scoped Phase 0/1 table for those UUIDs plus the synthetic
   marker and require zero; cleanup failure keeps evidence incomplete.
10. Run Supabase security and performance advisors.
11. Treat any new high-severity issue or unindexed owner FK as blocking.
12. Store the redacted migration/query/advisor artifacts through
    `run-mirror-evidence.mjs`; update `PROGRESS.md` only after cleanup succeeds.

Do not deploy an alternate provider, create a Supabase paid branch, or add a
database add-on.

### Task 15: Deploy the Exact Backend Commit to Heroku Eco

Run the checked deployment harness from the reconciled, clean implementation
commit:

```powershell
$implementationCommit = (git rev-parse HEAD).Trim()
node scripts/phase1/deploy-heroku.mjs `
  --app blackrosejournal-api `
  --expected-app-id 297b095b-5207-4303-9b14-76609465aa75 `
  --expected-commit $implementationCommit `
  --env-file C:\Users\sigmu\Desktop\BlackroseJournal\.env `
  --evidence-dir $env:TEMP\blackrose-phase1-heroku
if ($LASTEXITCODE -ne 0) { throw 'Checked Heroku deployment failed.' }
```

`deploy-heroku.mjs` uses checked child-process exits and a `try/finally`. Before
any mutation it fetches Heroku app/release/formation/add-on/config JSON, asserts
the exact app ID, records `$rollbackRelease`, and retains config values only in
process memory while evidence records key names. It then:

1. Sets `MEMORY_MIRROR_WRITES_ENABLED=false`, requires explicit
   `MEMORY_WRITER_EPOCH=1`, and preserves every unrelated config value.
2. Builds `backend/Dockerfile` for `linux/amd64` with
   `org.opencontainers.image.revision=$implementationCommit`; runs
   `dist/backend/src/artifactProbe.js`; logs into
   `registry.heroku.com` with the key through stdin; pushes; parses the pushed
   `sha256:` repository digest; and verifies it by pulling/inspecting the exact
   registry image.
3. Releases only `web`, sets exactly `web=1:Eco`, proves `worker=0` and no
   add-ons from JSON, and binds the source commit label, pushed repository
   digest, and Heroku release image identity. A pre-push local image ID alone is
   not deployment evidence.
4. Requires the explicit configured writer epoch and expected fingerprint
   that the backend compares to its credential-derived fingerprint.
5. Verifies `/health`, `/ready`, authenticated GET
   state, and the typed write-kill-switch suspension.
6. Enables the flag only after migration/readiness/smoke checks pass.
7. Starts `mirror-hosted-e2e.mjs` as a live secret-safe fixture process. It
   creates two disposable confirmed users through Auth Admin, retains their
   credentials only in memory, emits only their UUIDs/run nonce, and pauses.
   The root orchestrator allowlists those exact UUIDs through connected SQL,
   signals the runner, then proves a fresh 401, anonymous rejection, owner
   isolation, enroll, multi-chunk upload, completion permit, parity, tombstone,
   and duplicate/changed request against the released image. A third confirmed
   but non-allowlisted user proves zero owner/import allocation.
8. Through `mirror-fault-proxy.mjs`, cuts before body, after database commit
   before response, delay completion past permit expiry, return 429 with
   `Retry-After`, return transient 500, and time out; restart `web.1` between
   chunks and prove exact recovery.
9. Scans logs for raw content, synthetic phrase, bearer tokens, service keys,
   lease values, stack traces, and error bursts.
10. Confirms the Eco dyno may sleep normally; it adds no uptime pinger.

In `finally`, the harness removes `HEROKU_API_KEY` from its process/child
environment and runs checked `docker logout registry.heroku.com`. On any
failure after mutation it disables writes, runs
`heroku rollback $rollbackRelease --app blackrosejournal-api`, verifies the new
rollback release/health/formation, leaves the additive migration in place and
unused, and keeps all owners LOCAL. The deployment test sabotages one command
after release and proves rollback uses the captured real release rather than a
placeholder, credentials are cleaned, and writes stay disabled.

Hosted/app evidence is complete only after the same trusted connected-Supabase
cleanup transaction and Auth Admin cleanup described in Task 14. The evidence
runner records only run UUIDs, zero counts, synthetic-marker absence, and
cleanup status—not passwords, tokens, service keys, or SQL connection strings.
In every `finally`, root first deletes the exact dependent/rate/owner/allowlist
rows and proves zero, then signals the still-live fixture process to
revoke/delete its exact Auth users. Failure before the signal still enters this
same cleanup handshake.

### Task 16: Real Running-App E2E

Use unique synthetic data and two disposable confirmed Supabase users. For web
development E2E, launch a brand-new persistent browser profile and install one
Playwright init script **before the app's first JavaScript execution** that sets
only `@demo_data_seeded=true` and an empty `@demo_data_seed_record`. Do not call
normal clear/delete actions on seeded records: Phase 1 correctly turns those
into permanent commitments/outbox work and the baseline would be polluted. The
init script may not write source, binding, consent, auth, or outbox keys. The
Android release-like build has `__DEV__ === false` and receives no seed.
Before the first Finish in each isolated scenario, assert zero local
journal/check-in sources, zero commitments/outbox work, and zero hosted rows
for its fresh run owners. After a scenario
mutation/relaunch, assert the exact scenario ledger instead: only the expected
synthetic source IDs/revisions/tombstones, the exact pending outbox count,
hosted zero while offline, and exact receipt counts after sync. Abort on any
seed or unexpected/prior source ID; never "clean" it by filtering expected
results. Repeat zero counts after final cleanup.

`run-mirror-evidence.mjs --mode app` starts a live
`mirror-app-e2e.mjs` fixture process that creates the exact confirmed Auth
users, retains credentials only in memory, emits only UUIDs/run nonce, and waits.
Root allowlists those UUIDs with connected SQL before signaling the runner.
Every failure path uses the Task 14 dependent/rate/owner/allowlist cleanup
transaction before Auth Admin deletes the users. No app/hosted fixture assumes
that confirmed signup alone is entitled to enroll.

Required probes:

1. **Explicit identity and binding**
   - sign in through the running app;
   - while allowlisted but before the user grants the disclosed per-dataset
     opt-in, prove zero mirror HTTP requests and zero owner/import rows;
   - grant consent through the actual setting, then verify enrollment;
   - revoke it during a later active import and prove future source-copy
     requests stop while local content remains and the UI does not claim hosted
     deletion;
   - while still revoked, delete one mirrored source offline, reconnect, and
     prove only cancel/state/parity/tombstone safety traffic occurs, the hosted
     row becomes ineligible, and no enroll/chunk/complete/upsert is sent;
   - verify local dataset binds only to that owner;
   - switch to a different disposable owner and prove uploads suspend.
2. **Offline journal finish**
   - create a conversation online;
   - go offline before Finish;
   - Finish completes locally and History immediately shows exact content;
   - kill/relaunch, reconnect, and wait for MIRROR parity.
3. **Offline check-in finish**
   - repeat for a completed intention check-in.
4. **Interrupted chunk**
   - use enough deterministic source messages for multiple chunks;
   - abort after a real accepted chunk;
   - edit/remove/reorder a not-yet-sent and already-sent message, then terminate
     the app;
   - relaunch, cancel the obsolete manifest, upload the higher source/message
     revisions, and prove partial staged rows never become eligible;
   - relaunch/resume and prove no duplicate rows/revisions.
5. **Identical replay**
   - repeat the completed generation;
   - receipt, counts, and hash remain identical.
6. **Exactness**
   - compare database content verbatim to local user and assistant messages;
   - compare role, order, authored UTC instant, timezone/local date when
     captured, and honest null legacy fields.
7. **Offline delete**
   - delete locally offline;
   - force-stop immediately after the single owner-key write and before any
     outbox dirty mark;
   - verify local source disappears while its content-free owner-key tombstone
     survives;
   - reconnect and prove tombstone is accepted before source uploads and the
      cloud source becomes ineligible in the same transaction.
8. **Kill switches/fail closed**
   - disable mirror writes and prove status pauses while local chat/history
     continue;
   - inject stale authority version/epoch and prove no upload;
   - expire/revoke the session and inject wrong lease/token/fingerprint/mode;
     prove stable suspension without retry hammering or data loss;
   - restore valid state and prove recovery.
9. **Visible authority**
   - instrument prompt/tool assembly and prove no cloud source appears;
   - prove no server-to-client source-content download occurs;
   - existing device-direct assistant flow remains unchanged and visible-response
     read authority remains LOCAL.
10. **No demo contamination**
    - verify no seed source ID is present in the disposable owner's manifest.
11. **Restore and session lifecycle**
    - create a local backup for owner A and sign out with pending work;
    - restore it while owner B is active and prove the data remains local with
      `restored_owner_confirmation_required` and zero upload;
    - switch back to owner A, reconcile using a generation newer than the
      server receipt, and prove exact parity without manifest collision;
    - present a pre-existing anonymous session/JWT and prove both client and
      Heroku reject mirror writes without creating another anonymous user.
12. **Native Android durability**
    - run the same content-free outbox on an isolated emulator/device with real
      AsyncStorage;
    - force-stop/relaunch after source commit/before dirty marking, after server
      commit/before acknowledgement, after durable completion permit plus
      delayed dispatch, after accepted chunk plus local edit, and between
      chunks;
    - after the permit force-stop, relaunch and attempt an immediate edit; prove
      the fresh quarantine blocks it until the old request is either rejected
      by expiry or reconciled, then the edit succeeds as a new generation;
    - prove startup/foreground reconciliation recovers even if the background
      task never runs;
    - switch accounts with pending work and verify no cross-owner upload;
    - inspect the outbox value and prove the synthetic journal/check-in phrase,
      bearer token, title, summary, and assistant reasoning are absent.
13. **Two-device same-owner reconciliation**
    - run two isolated app instances (two fresh web profiles, or a fresh web
      profile plus the Android target) for the same confirmed owner;
    - start with at least one shared stable source/message ID, then generate
      disjoint A-only and B-only local additions while offline with different
      revision histories;
    - begin device A's import; begin device B's import and prove the stable
      `ACTIVE_IMPORT_EXISTS` conflict, B's retained work, and no fork/cancel of
      A's manifest;
    - let A complete, then complete B without sending A-only prose; prove B's
      stale shared-source snapshots are rejected by revision CAS, B rebases
      above the server cursor, B-only additions merge independently, and the
      server carries A-only verified rows into the cumulative owner union;
    - prove A's and B's logical manifests have distinct idempotent completion
      receipts and monotonic source-set versions, then prove both devices
      converge on B's latest owner-union receipt/version/count/hash through
      content-free reconciliation; `current_source_manifest_id` may match B only
      as audit metadata and does not define membership;
    - prove every accepted revision from both devices is present in the
      completed current view and parity, ordinary omission changes nothing, and
      neither app receives the other device's source content;
    - delete a source on device A, force-stop/relaunch B with its older local
      copy, reconnect, and prove the higher owner-scoped stable-ID tombstone
      prevents B from re-uploading or resurrecting it; no prose/model-output
      similarity is used to infer identity.

Run both app targets against the exact reconciled implementation commit and
Task 15 deployment evidence:

```powershell
$implementationCommit = (git rev-parse HEAD).Trim()
$runRoot = Join-Path $env:TEMP "blackrose-phase1-app-$([guid]::NewGuid().ToString('N'))"

node scripts/phase1/run-mirror-evidence.mjs `
  --mode app `
  --target web `
  --expected-commit $implementationCommit `
  --mirror-base-url https://blackrosejournal-api-c84163ecd7ed.herokuapp.com `
  --deployment-id blackrose-primary `
  --writer-epoch 1 `
  --env-file C:\Users\sigmu\Desktop\BlackroseJournal\.env `
  --expo-port 8082 `
  --deployment-evidence "$env:TEMP\blackrose-phase1-heroku\manifest.json" `
  --evidence-dir (Join-Path $runRoot 'web')
if ($LASTEXITCODE -ne 0) { throw 'Web app evidence failed.' }

node scripts/phase1/run-mirror-evidence.mjs `
  --mode app `
  --target android `
  --expected-commit $implementationCommit `
  --mirror-base-url https://blackrosejournal-api-c84163ecd7ed.herokuapp.com `
  --deployment-id blackrose-primary `
  --writer-epoch 1 `
  --env-file C:\Users\sigmu\Desktop\BlackroseJournal\.env `
  --deployment-evidence "$env:TEMP\blackrose-phase1-heroku\manifest.json" `
  --avd loop36 `
  --adb "$env:LOCALAPPDATA\Android\Sdk\platform-tools\adb.exe" `
  --emulator "$env:LOCALAPPDATA\Android\Sdk\emulator\emulator.exe" `
  --java-home "C:\Program Files\Android\Android Studio\jbr" `
  --package com.blackrosejournal `
  --evidence-dir (Join-Path $runRoot 'android')
if ($LASTEXITCODE -ne 0) { throw 'Android app evidence failed.' }
```

For `--target web`, the app-mode runner itself injects only the four non-secret
public mirror fields plus `EXPO_PUBLIC_SUPABASE_URL` and
`EXPO_PUBLIC_SUPABASE_ANON_KEY` parsed in memory from the checked env file into
its Expo child. It requires the URL host project ref to equal
`tovejzoqyduelgzsajru`, never copies the env file into a worktree/evidence, and
never records the publishable-key value. It starts the exact repo Expo CLI as a
hidden child with `start --web --localhost --port 8082 --clear`, captures stdout/
stderr, requires HTTP 200 from `127.0.0.1:8082`, runs
`mirror-app-e2e.mjs` with Playwright, and kills only that exact child/process
tree in `finally`. Early Expo exit, port mismatch, stale commit/deployment
release/digest, Playwright fallback/localStorage seeding, or cleanup failure is
blocking.

For `--target android`, the runner:

1. Verifies the supplied SDK tools, Android Studio JBR 21, package
   `com.blackrosejournal`, exact commit, and that exactly the dedicated AVD
   `loop36` is selected. The machine's PATH Java 8 is never used.
2. Creates a detached temporary worktree at `$implementationCommit`, adds only a
   verified `node_modules` junction to the existing dependency tree, injects
   the checked public Supabase/mirror fields into child processes, and runs the exact
   Expo CLI `prebuild --platform android --no-install --clean`. No lockfile or
   tracked native file changes.
3. Uses an external Gradle init script to make only the generated `release`
   variant debuggable, then runs `android\gradlew.bat --no-daemon --stacktrace
   -I <init-script> :app:assembleRelease
   -PreactNativeArchitectures=x86_64`.
4. Uses `apkanalyzer` under JBR 21 to require application ID
   `com.blackrosejournal` and `debuggable=true`; records APK SHA-256, version
   code/name, implementation commit, expected Heroku release, and registry
   digest.
5. Launches a wiped, no-snapshot, headless `loop36`, records connected serials
   before launch, accepts exactly one new serial whose
   `sys.boot_completed=1` and `emu avd name` match, and fails rather than using
   an arbitrary connected phone/emulator. Only after that target exists does it
   run `adb -s <serial> install -r -t <apk>`, verify/record the installed
   package path, and start `MainActivity`.
6. Runs app scenarios using `am force-stop` plus
   `am start -W -n com.blackrosejournal/.MainActivity`. Offline checkpoints use
   `adb root` and UID-scoped IPv4 **and** IPv6 `OUTPUT` reject rules; merely
   disabling Wi-Fi is insufficient. Both rules are removed in an inner
   `finally`, and an unavailable root/iptables gate is reported blocked.
   `android-ui-driver.mjs` drives the real native UI without a new dependency:
   it runs `uiautomator dump`, parses exact `resource-id`/`content-desc`/text,
   requires one matching enabled node, computes its current bounds, then uses
   `adb shell input tap/text/keyevent` for sign-in, consent, journal/check-in
   creation, Finish, detail delete, clear, restore, and confirmations. It
   re-dumps/asserts the expected status/content after every action and captures
   screenshots/XML. No hardcoded screen coordinates, storage-seeded auth/
   outbox/source rows, deep service call, or web Playwright fallback is allowed;
   missing/duplicate/invisible identifiers fail. Driver fixture tests cover XML
   escaping, bounds, text escaping, duplicate nodes, checked exits, and
   force-stop recovery.
7. Force-stops before storage capture, then uses binary `adb exec-out run-as
   com.blackrosejournal cat` streams—not PowerShell text redirection—to copy
   actual `databases/RKStorage` plus present `-wal`, `-shm`, and `-journal`
   siblings. Missing `RKStorage` fails. The runner uses the installed
   `Android\Sdk\platform-tools\sqlite3.exe` read-only against that consistent
   copy to extract exact `catalystLocalStorage` rows for the outbox and source
   shard keys. It scans only the outbox value for forbidden phrase, bearer
   token, title, summary, and reasoning, and separately proves source prose
   exists in the expected source shard. A global database token scan is invalid
   because Supabase Auth/session storage legitimately contains the bearer
   token.
8. In `finally`, removes both firewall rules, force-stops the app, kills only
   the launched emulator, validates/removes only the expected junction, removes
   the detached worktree, restores child environment, and records cleanup.

The runner never seeds an outbox row or treats UI-exported expected values as
storage evidence.

The 20,000-message native storage boundary is a separate real integration
probe, not 20,000 simulated UI taps. The runner builds a second temporary
package `com.blackrosejournal.phase1probe` from the same detached commit with an
enumerated, hashed harness-only patch (one probe route/config suffix, never
merged or deployed). That route calls the committed public journal/check-in
storage APIs—no mocks and no direct SQLite writes—to create deterministic
at-limit and limit-plus-one sources. It force-stops/relaunches, re-reads through
the same public APIs, exposes count/order/content SHA only for assertion, and
the runner independently verifies shard key sizes and reconstructed content
from the copied SQLite rows. Evidence requires the base commit, exact harness
patch allowlist/hash, APK hash/package, 20,000 exact success, 20,001 local-save
success with mirror-blocked status, and cleanup. Functional sign-in/consent/
Finish/delete scenarios still run through the unpatched main package and the
native UI driver.

Capture screenshots/status text, request/receipt IDs, counts/hashes, exact
database comparisons, Heroku release/digest, and Supabase migration identity.
Do not summarize exactness checks without retaining the comparison artifact.

The complete real failure campaign includes: corrupt outbox JSON; 50 concurrent
dirty/ack operations; network cut before and during upload; 429 with exact
`Retry-After`; transient 500; response loss after database commit; completion
delivery after permit expiry; Node and Heroku restart between chunks; revoked
session; anonymous JWT; stale epoch; expired/wrong lease/token; wrong
credential fingerprint; maintenance mode; local source edit/delete during
upload; and app force-stop at every persisted boundary. Each deliberate red
probe is restored and rerun green, with cleanup and output hashes in the same
fresh evidence manifest.

If implementation touches extraction, identity, session-digest generation, or
recall despite this plan, also run the repo's required live LLM Playwright
probe and retain verbatim assistant replies.

### Task 17: Completion Evidence, Final Review, and Main Integration

Update `PROGRESS.md` with:

- branch and commits;
- migration identity;
- root/backend/local PostgREST/pgTAP totals;
- sabotage red/green evidence;
- live two-owner, retry, restart, tombstone, and parity evidence;
- Supabase advisors;
- Heroku app/release/image digest/Eco formation;
- running-app E2E artifact paths;
- explicit statement that all visible-response memory remains local;
- explicit statement that complete local sources remain retained;
- explicit statement that Phase 2 is next and Phase 9 remains final.

Before editing progress, record:

```powershell
$implementationCommit = (git rev-parse HEAD).Trim()
```

This must be the reconciled migration commit used by the Heroku image and every
fresh local/hosted/app evidence manifest. Commit only `PROGRESS.md` as
`docs(progress): record phase 1 evidence`, then record:

```powershell
$evidenceCommit = (git rev-parse HEAD).Trim()
$changed = @(git diff --name-only $implementationCommit $evidenceCommit)
if ($changed.Count -ne 1 -or $changed[0] -ne 'PROGRESS.md') {
  throw 'Evidence commit changed the deployable tree.'
}
node scripts/phase1/run-mirror-evidence.mjs `
  --mode local `
  --expected-commit $implementationCommit `
  --evidence-commit $evidenceCommit `
  --allow-evidence-only PROGRESS.md
if ($LASTEXITCODE -ne 0) { throw 'Final evidence verification failed.' }
```

The harness recomputes the deployable-tree hash over tracked application,
component, hook, service, shared, backend, scripts, package manifest/lockfile,
Supabase migration/test, Expo/native-config, and runtime asset paths at both
commits and requires equality. It also requires the recorded migration hash,
Heroku revision label/repository digest/release, and hosted/app artifacts to
name `$implementationCommit`. Any code/config/migration/test change after that
commit invalidates the exception: create a new implementation commit, redeploy,
and rerun all affected evidence instead of relabeling old artifacts.

Request a final whole-branch review against this plan. Fix only verified
findings with tests, repeat gates, then fast-forward the reviewed branch into
`main`. Never stage or commit unrelated dirty files.

---

## 9. Completion Gate

Phase 1 is complete only when every item is true:

- [ ] Dedicated plan pointer and roadmap validator are green.
- [ ] No applied migration, lockfile, generated historical artifact, or
      `example-design/` file changed.
- [ ] Durable outbox is content-free, versioned, serialized, bounded without
      eviction, owner-bound, and restart-safe.
- [ ] Source stores are safe-parsed, versioned, and serialized without data
      loss.
- [ ] Current source/message revisions and permanent content-free owner-key
      deletion commitments are atomic with source mutations; intermediate
      plaintext revision chains are neither retained nor invented.
- [ ] Explicit session path is independent of the legacy data provider and
      never silently creates an owner.
- [ ] No client bundle contains a server secret or writer lease credential.
- [ ] New messages preserve available authored timezone/local date; legacy
      records remain honestly unknown.
- [ ] Actual source payloads persist through one atomic RPC per chunk.
- [ ] Node/PostgreSQL hashes and persisted membership/count parity agree.
- [ ] Duplicate, interrupted, restarted, concurrent, and changed replays have
      real passing evidence.
- [ ] Accepted tombstones immediately make cloud rows retrieval-ineligible and
      cannot be resurrected by later source replay.
- [ ] Two real owners cannot read, write, reference, finalize, tombstone, or
      claim each other's data.
- [ ] Verified completion alone moves the owner to `MIRROR`; all projection,
      shadow, cloud-read, and cloud-write flags remain false.
- [ ] Root Jest, TypeScript, lint, design, backend build/tests, local
      PostgREST, pgTAP, and DB lint pass.
- [ ] Required sabotage produces red before restoration and green after.
- [ ] Supabase hosted migration, live API tests, and advisors pass.
- [ ] Exact reviewed backend commit runs on one Heroku Eco web dyno with no
      worker/add-on and clean logs.
- [ ] Running-app E2E proves offline/restart/idempotency/exactness/delete/
      account-switch/kill-switch behavior against the live deployment.
- [ ] Native Android force-stop/relaunch proves real AsyncStorage recovery and
      that the content-free outbox contains no source prose or bearer token.
- [ ] Local journal, history, prompts, tools, and visible assistant behavior
      remain authoritative and unchanged.
- [ ] Complete local sources remain retained for Phases 2–8 and final Phase 9.
- [ ] `PROGRESS.md` contains real evidence, not assertions.
- [ ] Independent final review reports no unresolved Critical or Important
      issue.

---

## 10. Current Verified Starting State

At plan authoring:

- branch: `codex/cloud-memory-phase-1-mirror`;
- base: `ef2610f019c21a6b9c0652014d26f3e0fdfbb8b6`;
- hosted project: `blackrose` / `tovejzoqyduelgzsajru`;
- hosted PostgreSQL: 17.6;
- deployment: `blackrose-primary`, writer epoch `1`, mode `active`;
- owner states, conversations, messages, manifests, and chunks: all zero;
- Heroku app: `blackrosejournal-api`;
- Heroku app ID: `297b095b-5207-4303-9b14-76609465aa75`;
- Heroku region/stack: EU/container;
- formation: exactly one Eco web dyno;
- current live release before Phase 1: `v8`;
- current `/health`, `/ready`, JWT rejection, and zero-source baseline were
  previously verified in Phase 0 and must be freshly reverified before release;
- roadmap validator baseline: 35/35;
- Phase 1 pointer TDD red was captured before this plan:
  3 expected validator acceptance cases failed while 32 rejection cases
  remained green.

Relevant current official guidance was refreshed before planning:

- [Supabase API security](https://supabase.com/docs/guides/api/securing-your-api)
  distinguishes grants from RLS and recommends explicit function grants.
- [Supabase database functions](https://supabase.com/docs/guides/database/functions)
  recommends invoker by default, fixed search paths for necessary definer
  functions, and revoking default execution.
- [Supabase anonymous auth](https://supabase.com/docs/guides/auth/auth-anonymous)
  confirms anonymous users use the authenticated role and require deliberate
  RLS treatment.
- [Expo SDK 54 SecureStore](https://docs.expo.dev/versions/v54.0.0/sdk/securestore/)
  is suitable for small keys but is not installed in this repo; Phase 1 avoids
  inventing key custody or changing lockfiles by persisting no source content
  in its outbox.
