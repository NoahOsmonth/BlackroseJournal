# Cloud-Authoritative Rosebud Memory Master Roadmap

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement each phase plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace Rosebud's phone-authoritative long-term memory with an evidence-first, cloud-authoritative memory platform orchestrated by one portable Node backend, while preserving local authority, provider independence, and rollback until every longitudinal quality gate passes.

**Architecture:** The Expo app retains the current conversation, local drafts, a content-free durable memory-mirror outbox, authentication, bounded caches, endpoint profiles, and user controls. The outbox persists only opaque source references and sync bookkeeping; source content is read from the still-authoritative local stores only for authenticated HTTPS upload. A provider-neutral Node modular monolith runs on Heroku or a prepared Windows laptop, authenticates Supabase user sessions, persists owner-scoped evidence through repository interfaces, runs typed memory workflows, and streams the only user-facing Rosebud response. Supabase is the initial PostgreSQL/Auth provider; verified backup, deletion replay, externally signed writer leases, and provider overlays allow controlled migration to another managed or local PostgreSQL target.

**Tech Stack:** Expo SDK 54, React Native 0.81, TypeScript 5.9, Node.js 24 LTS on Heroku/Windows, Express 4, Supabase Postgres/Auth/managed PostgREST, checksum-pinned PostgREST 14.16 for generic PostgreSQL, PostgreSQL full-text search, pgvector HNSW, Jest, Node test runner, pgTAP, Playwright.

## Global Constraints

- Heroku initially runs the Node backend and Supabase is the initial authoritative database/Auth provider. Runtime and repository code must not depend on Heroku or Supabase database SDK semantics.
- Exactly one externally signed writer lease may accept mutations. Every mutating RPC validates deployment ID, epoch, lease token, and expiry transactionally; never use live dual writes.
- Do not provision Heroku Postgres during Phase 0. It is a later rehearsed emergency destination, not a second primary.
- Use the user's existing Heroku Eco subscription for one `web` dyno. Do not keep a separate Eco worker dyno running continuously: the 1,000-hour monthly pool is shared, worker-only Eco dynos do not sleep, and two always-on dynos can exhaust the pool.
- Eco sleep and dyno restart are normal operating conditions. Durable jobs, leases, traces, and progress live in Supabase; no correctness or acknowledged work depends on dyno RAM.
- Use Node.js `24.x` and npm `11.x` for Heroku, matching the supported Active LTS line and local runtime.
- Never print, commit, persist in traces, or pass to the client `HEROKU_KEY`, `SUPABASE_SECRET_KEY`, provider API keys, or access tokens.
- Use a Supabase publishable key in the mobile app and a separately rotatable Supabase secret key only on Heroku.
- The same compiled backend must run in Heroku `cloud`, Windows `local-compute`, and Windows `local-data-runtime` modes. Local mode is configuration, not a fork; fully offline identity is a separate later subsystem.
- Portable backups are encrypted, checksummed, manifest-backed, restore-tested, and excluded from git.
- Provider-specific migrations are overlays; canonical memory semantics remain in portable PostgreSQL migrations.
- Supabase managed PostgREST is the initial data gateway. Other PostgreSQL targets run a checksum-pinned, private PostgREST sidecar; atomic operations remain versioned PostgreSQL RPCs.
- All user-data tables contain `owner_id`, enable RLS, index `owner_id`, and use explicit grants.
- Never edit `supabase/migrations/202601240001_init.sql`; every schema change is additive in a new CLI-generated migration.
- Keep `LOCAL` authoritative until per-user `MIRROR`, `SHADOW`, and `CLOUD` gates pass.
- Never remove local source evidence or local fallback until the observation window is closed and Phase 9 passes. Offline drafts/outbox are retained in every phase.
- Current user-authored evidence is the only autobiographical truth source. Assistant text, summaries, preferences, hypotheses, and external pages cannot authorize user facts.
- A source edit or tombstone immediately removes retrieval eligibility and invalidates every dependent projection.
- The normal route targets two model calls. Deep routes are bounded by evidence sufficiency, latency, permissions, and model health—not cost.
- Memory relevance never grants permission to mention. Utilization and sensitivity decisions are separate from retrieval.
- No natural-language keyword routing. Model interpretation is structured; deterministic code handles validation, authorization, budgets, deadlines, and policy.
- Tests are part of every task. Structured extraction, identity, session digest, preference, and recall changes require real-provider and running-app E2E before completion.
- Follow UI → hooks → services; screens never call backend or Supabase services directly.
- Do not touch lockfiles, applied migrations, `example-design/`, generated output, or unrelated dirty files.

---

## Delivery Model

This architecture is too large and too coupled to execute safely as one branch. It is divided into ten independently reviewable subprojects. Each phase gets its own `codex/` branch, execution-grade plan, tests, sabotage evidence, review checkpoint, and integration decision.

| Phase | Branch | Executable plan | Independently testable result |
|---|---|---|---|
| 0 | `codex/cloud-memory-phase-0` | `docs/superpowers/plans/2026-07-28-cloud-memory-phase-0-contract-safety.md` | Canonical contracts, owner-isolated source/ops schema, Supabase JWT auth, durable job primitive, read-only source inventory, benchmark registry, Heroku-ready backend |
| 1 | `codex/cloud-memory-phase-1-mirror` | `docs/superpowers/plans/2026-07-29-cloud-memory-phase-1-mirror-ingestion.md` | Content-free durable outbox, chunked idempotent source upload, manifests, hash parity, local authority preserved |
| 2 | `codex/cloud-memory-phase-2-truth` | `docs/superpowers/plans/2026-07-28-cloud-memory-master-roadmap.md` | Evidence spans, entities, aliases, bitemporal claims, episodes, preferences, dependencies, edit/delete cascades |
| 3 | `codex/cloud-memory-phase-3-curation` | `docs/superpowers/plans/2026-07-28-cloud-memory-master-roadmap.md` | Versioned extraction, temporal digests, profile tree, open threads, search documents, embeddings, collision review |
| 4 | `codex/cloud-memory-phase-4-retrieval` | `docs/superpowers/plans/2026-07-28-cloud-memory-master-roadmap.md` | Target planning, exact-recent lane, lexical/vector/entity/temporal/graph candidates, RRF, reranking, coverage verification |
| 5 | `codex/cloud-memory-phase-5-orchestration` | `docs/superpowers/plans/2026-07-28-cloud-memory-master-roadmap.md` | Temporal orientation blocks, exact-evidence windows, backend tools, Scout, deterministic orchestrator, Primary Rosebud streaming |
| 6 | `codex/cloud-memory-phase-6-judgment` | `docs/superpowers/plans/2026-07-28-cloud-memory-master-roadmap.md` | Utilization controller, scoped Preference Ledger, Outcome Observer, deep formulation, optional private differential firewall |
| 7 | `codex/cloud-memory-phase-7-shadow` | `docs/superpowers/plans/2026-07-28-cloud-memory-master-roadmap.md` | One-year fixtures, public benchmark adapters, shadow comparator, ablations, dashboards, kill switches |
| 8 | `codex/cloud-memory-phase-8-cutover` | `docs/superpowers/plans/2026-07-28-cloud-memory-master-roadmap.md` | Staged CLOUD authority and observation with full local source retention |
| 9 | `codex/cloud-memory-phase-9-portability` | `docs/superpowers/plans/2026-07-28-cloud-memory-portability.md` | Portability, disaster recovery, laptop modes, provider migration, and final local-retirement gate |

Phase 0, Phase 1, and the Phase 9 portability/DR plan now have dedicated
execution plans. Rows 2–8 deliberately point to this master roadmap: until one
of those phases begins, its unique `## Phase N` section is the authoritative
phase contract. That phase's first planning step creates and reviews a dedicated
executable plan, then updates its table pointer before implementation. No later
phase starts from this roadmap alone.

## Authority and Rollback Matrix

| State | Source write authority | Visible response memory | Cloud activity | Rollback |
|---|---|---|---|---|
| `LOCAL` | Phone | Existing local memory | Contract/schema validation only | No data-path change |
| `MIRROR` | Phone | Existing local memory | Idempotent raw source copy and projection rebuild | Stop mirroring; discard/rebuild cloud projections |
| `SHADOW` | Phone | Existing local memory | Silent cloud evidence briefs and comparisons | Disable shadow; retain mirrored evidence |
| `CLOUD` | Active externally signed writer lease through backend | Cloud recent evidence plus verified retrieval | Full cloud orchestration | Before Phase 9, keep the fixed Supabase/Heroku endpoint and disable advanced routes in favor of recent cloud sessions plus verified simple search; in Phase 9, fence writes, snapshot the complete destination, restore into a fresh target, replay deletions, and issue a new lease |

The existing `EXPO_PUBLIC_DATA_PROVIDER` flag continues to control general application-data synchronization. It never selects memory authority.
Database location and memory-authority state are separate. A user may remain in `LOCAL`, `MIRROR`, or `SHADOW` while the cloud database is rehearsed or moved. No database cutover alone grants cloud response authority.

## Phase 0 — Contract and Safety Foundation

Deliver:

- canonical shared enums and source contracts;
- fail-closed authority/feature-flag resolver;
- normalized source, import, owner-state, job, attempt, and trace tables;
- explicit grants, RLS, composite owner foreign keys, and two-user pgTAP isolation;
- Supabase access-token verification for `/v1/memory/*`;
- user-scoped and server-scoped Supabase REST transports without a new dependency;
- `FOR UPDATE SKIP LOCKED` durable job claim primitive;
- read-only canonical local source inventory/export;
- versioned Memory Quality Constitution registry;
- Heroku backend build/start/health contract.
- Eco formation contract: `web=1` on Eco, `worker=0`, no artificial uptime pinger, restart-safe queue recovery.
- provider-neutral repository and capability contracts;
- deployment writer-epoch/lease record and transactional stale-writer rejection contract;
- portable-core versus provider-overlay static boundary.

Do not deliver cloud model calls, source uploads, memory extraction, retrieval, or visible-response changes.

Gate:

- local full suite remains green;
- backend full suite remains green;
- local Supabase reset and pgTAP pass;
- two distinct authenticated users cannot read, update, reference, or claim each other's rows;
- secret-bearing fields are absent from client bundles and logs;
- Heroku build artifact boots and `/health` plus `/ready` behave correctly;
- authority remains `LOCAL`.

## Phase 1 — MIRROR Ingestion

Deliver:

- content-free, schema-versioned, serialized mobile outbox containing only
  owner-bound opaque source references, cursors, retry state, parity metadata,
  and tombstone delivery state sourced from atomic owner-key tombstone ledgers;
- chunked upload protocol for journal and check-in conversations/messages;
- server-side SHA-256 canonical hashes;
- import manifests and per-chunk idempotency;
- retry-safe `(owner_id, client_event_id)` acceptance;
- bounded batch size and resumable cursors;
- source count/hash parity report;
- per-user transition from `LOCAL` to `MIRROR`;
- complete phone/local sources retained without a Phase 1 portable-backup requirement;
- immediate cloud-mirror retrieval ineligibility when the owning local source is tombstoned.

Gate:

- repeated upload produces no duplicates;
- interrupted upload resumes without loss;
- original authored time, timezone, role, order, and exact content survive;
- a local tombstone immediately makes its cloud mirror retrieval-ineligible;
- complete phone/local sources remain retained;
- cloud hints never become truth;
- visible responses remain local-memory controlled.

## Phase 2 — Epistemic Truth and Deletion

Deliver:

- immutable message revisions and eligible evidence spans;
- entities, aliases, owner-safe relationship edges;
- bitemporal claims and support/counterevidence;
- episodes with event time separate from mention/write time;
- open threads, interaction preferences/outcomes, and bounded hypotheses;
- dependency graph and source-to-projection lineage;
- synchronous edit/tombstone eligibility invalidation;
- deletion-ledger and retrieval-eligibility inputs for later portable replay;
- no old-backup deletion-replay enforcement, which belongs to Phase 9.

Gate:

- unsupported summaries cannot authorize facts;
- assistant text cannot become user evidence;
- James/John same-name fixtures do not merge without evidence;
- current, historical, disputed, retracted, and deleted states reconstruct correctly;
- sabotage of one dependency causes a red deletion probe.

## Phase 3 — Versioned Curation and Projections

Deliver:

- durable version-fenced workers;
- exact evidence extraction with format-rejection fallback;
- entity/alias resolution and collision review;
- current-life, identity, open-thread, day/week/month/year digest blocks;
- bounded source-linked profile tree;
- search documents, full-text vectors, embeddings, and HNSW indexes;
- supersession and contradiction chains;
- pattern promotion only after support and counterexample search;
- rebuild and audit commands.

Gate:

- raw sources remain usable during worker/provider failure;
- replayed jobs are idempotent;
- every projection records model, prompt, schema, job, and input versions;
- derived artifacts can be deleted and rebuilt from eligible evidence;
- no hypothesis becomes a diagnosis or identity claim.

## Phase 4 — Evidence-Set Planning and Retrieval

Deliver:

- structured evidence-target planner;
- exact recent-conversation and surrounding-turn expansion;
- entity, alias, FTS, pgvector, graph, temporal, and structured-claim routes;
- RRF fusion and independently versioned reranker;
- claim-centered evidence bundles;
- two-to-four-cycle coverage/contradiction/freshness verifier;
- explicit insufficient-evidence result.

Gate:

- retrieval, reranking, and coverage are scored separately;
- multi-target fixtures reach target-set gates;
- stale/superseded/deleted results cannot outrank current evidence;
- exhaustive recent versus hybrid crossover is measured per model/context regime;
- graph navigation cannot promote navigation-only edges into factual authority.

## Phase 5 — Live Context and Orchestration

Deliver:

- cached temporal orientation blocks;
- 3–5k baseline pack and adaptive 8–24k exact-evidence window;
- owner-scoped backend history tools;
- Memory Scout structured frame;
- deterministic Turn Blackboard and route selection;
- Primary Rosebud as sole speaker;
- backend SSE/WebSocket path with end-to-end trace ID;
- provider/model registry with effective-context measurements.

Gate:

- normal route targets two model calls;
- no current prompt loses response reserve to memory;
- full source is retrieved on demand, never dumped by default;
- external content is delimited untrusted data;
- tool/provider failure soft-falls back to recent verified cloud evidence.

## Phase 6 — Conversational Judgment and Learning

Deliver:

- utilization decisions: `ignore`, `silent_shape`, `implicit_use`, `natural_mention`, `verify_first`, `withhold`;
- memory-dependence posture: fresh-eyed, balanced, continuity-heavy;
- scoped explicit/corroborated/inferred Preference Ledger;
- question budget, response-length, advice, warmth, and pacing contract;
- Outcome Observer that updates only bounded preference records;
- plural evidence-bound Deep Formulation Consultant;
- separately consented, ephemeral Private Differential with an authority firewall.

Gate:

- correct-but-awkward recall counts as failure;
- contextually inappropriate preference use stays below target;
- sensitive memories can help silently without being named;
- no specialist speaks directly;
- no diagnostic language or differential artifact reaches durable memory.

## Phase 7 — SHADOW Evaluation and Operations

Deliver:

- deterministic one-year synthetic lives;
- LongMemEval, Memora/FAMA, MINTEval, ConvoMem, MemoryAgentBench/MemoryBench, TIME, AlpsBench, preference, affective, strategic, and proactive-memory adapters;
- gold-evidence/no-memory/exhaustive/hybrid/full-system ablations;
- silent cloud evidence briefs beside local visible responses;
- trace and quality dashboards;
- independent kill switches;
- human blinded review using verbatim replies.

Gate:

- all zero-tolerance invariants pass;
- measured gates in the approved specification pass by version;
- verified-memory and specialist routes demonstrate repeatable benefit;
- cleared demo data and real provider E2E pass;
- operator account completes shadow observation.

## Phase 8 — Staged CLOUD Authority and Observation

Deliver:

- staged per-user transitions: operator, empty test account, one friend, invited cohort;
- cloud source write authority;
- the fixed initial Supabase/Heroku endpoint established by Phase 0, without signed migration endpoint profiles;
- staged provider-native rollback on that fixed endpoint through the recent-cloud/simple-search route;
- observation window with parity and deletion monitoring;
- retain complete local memory sources read-only throughout observation;
- do not claim provider-independent disaster recovery;
- do not retire heavy local stores;
- do not move the primary database to another provider;
- do not enable a second writer;
- do not perform irreversible local cleanup;
- hand the healthy staged deployment to Phase 9 for recovery certification.

Gate:

- at least the operator and one isolated friend pass the full matrix;
- no cross-user, deleted-source, stale-fact, diagnostic, or job-loss incident;
- cloud-only turns survive advanced-route rollback;
- the initial Supabase/Heroku endpoint remains fixed with one writer and no irreversible cleanup;
- final branch completion follows `superpowers:finishing-a-development-branch`.

## Phase 9 — Portability, Disaster Recovery, and Local Retirement

Deliver:

- provider-neutral database configuration and repository adapter boundary;
- externally signed writer leases, transactional fencing, source credential revocation/read-only fencing, and maintenance-mode drain;
- encrypted custom-format PostgreSQL backup, manifest, checksums, and verifier;
- real Supabase-to-local and local-to-Supabase restore rehearsals into fresh empty targets;
- separately retained hash-chained deletion receipts replayed after old-backup restore;
- Heroku, Neon, AWS, GCP, Azure, Railway, generic PostgreSQL, and local destination runbooks;
- Codex, Claude Code, Gemini CLI, GitHub Copilot, Cursor, Cline, and ChatGPT migration prompt wrappers;
- Windows local-compute and local-data/runtime setup/start/health/backup/return scripts;
- signed mobile endpoint profiles with deployment-ID, writer-epoch, and writer-lease validation;
- Eco sleep/restart job-lease recovery drill.

Gate:

- completed signed Phase 1–8 evidence passes revalidation, including the completed Phase 8 operator-and-friend observation report;
- a current cloud snapshot restores into a fresh target, and retained phone/local sources independently rebuild/import into a separate fresh target;
- deletion receipts replay after an older-backup resurrection attempt and deleted evidence remains absent;
- exact source counts and hashes match each recovery path's signed source manifest, with owner isolation, writer fencing, and source parity intact;
- a cloud-only turn survives staged provider-native rollback and current-cloud-snapshot fresh-target recovery;
- zero cloud-only-turn, source-parity, or deletion loss is present;
- corrupted checksum, stale/expired lease, deletion replay, missing extension, owner-count mismatch, and interrupted restore all fail closed;
- a real logical dump restores into a real local PostgreSQL instance and passes schema/count/ownership checks;
- one managed non-Supabase destination rehearsal passes before local heavy stores may retire;
- the same backend artifact boots on Heroku and Windows;
- no migration deletes a source or enables a second writer;
- a Phase 9 failure blocks heavy local-store retirement and activation of any alternate provider or second writer; the healthy Supabase service may remain active under the user's current valid authority.

Only Phase 9 may authorize retirement of heavy local memory stores. If any
backup, restore, deletion-replay, alternate-provider, or laptop-recovery gate
fails, Supabase may remain the active cloud service but full local sources stay
retained.

## Cross-Phase Verification Ledger

Every phase records:

- branch and commit;
- migration versions;
- contract/schema/model/prompt versions;
- focused red/green test output;
- sabotage red/green output;
- full root/backend/type/lint/design results;
- Supabase reset, pgTAP, advisors, and query verification where schema changes;
- Heroku build/release/health evidence where backend runtime changes;
- real `pg_dump`/`pg_restore`, checksum corruption, writer fencing, endpoint switching, and rollback evidence where portability changes;
- real-provider and Playwright evidence where AI behavior changes;
- deviations and follow-ups in `PROGRESS.md`.

## Stop Conditions

Stop the current phase and return to design review if:

- an invariant requires weakening to make implementation convenient;
- owner isolation depends only on application filters;
- an applied migration would need editing;
- a client must receive a server secret;
- local authority would change before its gate;
- a migration would allow two writable database authorities;
- a provider-specific feature would become unrebuildable source truth;
- a backup or restore would be accepted without checksums, ownership verification, and a retained rollback source;
- a model-generated projection must be treated as source truth;
- a failing verification is repeatedly retried without a new diagnosis;
- the required real Supabase/Heroku/provider environment cannot be isolated safely.

## Source Documents

- Design specification: `docs/superpowers/specs/2026-07-28-cloud-authoritative-rosebud-memory-design.md`
- Portability specification: `docs/superpowers/specs/2026-07-28-rosebud-backend-database-portability-design.md`
- Phase 0 execution plan: `docs/superpowers/plans/2026-07-28-cloud-memory-phase-0-contract-safety.md`
- Historical local plan: `PLAN.md` is not executable for this migration and remains historical until the repository constitution is updated in Phase 0.
