# Portability as the Final Memory Phase

**Status:** Approved by the user on 2026-07-29.

## Goal

Execute the cloud-memory behavior phases before the broad portability and
disaster-recovery program, while preserving enough existing safety that no
user's local evidence is retired before verified recovery exists.

The delivery order is:

```text
Phase 0 → Phase 1 → Phase 2 → Phase 3 → Phase 4
        → Phase 5 → Phase 6 → Phase 7 → Phase 8 → Phase 9
```

Phase 0 is complete. The former Phase 0P becomes Phase 9 and is the final
delivery phase.

## Decision

Phase 8 becomes **Staged CLOUD Authority and Observation**. It may move the
operator, an empty test account, one trusted friend, and then a small invited
cohort to cloud response authority on the initial Supabase/Heroku deployment.
It may not retire the full local memory sources.

Phase 9 becomes **Portability, Disaster Recovery, and Local Retirement**. It
owns provider-independent backup and restore, deletion replay, externally
signed writer leases, endpoint profiles, laptop recovery modes, provider
adapters, migration rehearsals, and the final local-retirement decision.

## Why This Ordering Is Safe

The initial cloud path remains one managed Supabase database behind the
Phase 0 Heroku backend. Phases 1–8 continue using the Phase 0 deployment ID,
monotonic writer epoch, opaque writer lease/token digest, source credential
fingerprint, RLS, owner-scoped RPCs, and durable jobs. No second writable
database is introduced before Phase 9.

Local source evidence remains complete and read-only after a user's Phase 8
cutover. Encrypted drafts and the offline outbox also remain on the device.
Before Phase 9, rollback means disabling advanced cloud routes or returning a
pre-cutover user to local response authority while the local evidence is still
intact. After Phase 8 has accepted cloud-only turns, staged rollback stays on
the fixed initial Supabase/Heroku endpoint and uses recent cloud sessions plus
verified simple search; it does not force authority to `LOCAL`. The system must
not claim provider-independent recovery, signed migration endpoint profiles,
verified old-backup deletion replay, or safe local retirement before Phase 9.

## Phase Boundary Changes

### Phase 1: MIRROR

Phase 1 may upload exact journal and check-in sources into the single Supabase
primary. Local memory remains response authority. A local tombstone must remove
the corresponding cloud mirror from retrieval eligibility, but portable backup
purge receipts and cross-provider replay are deferred to Phase 9. Complete
phone/local sources remain retained, and Phase 1 has no portable-backup
prerequisite.

### Phases 2–7

Truth, deletion eligibility, curation, retrieval, orchestration, judgment, and
shadow evaluation continue in their existing order. They may depend on the
Phase 0 database fences, but must not depend on an alternate database provider,
a generic PostgREST sidecar, a laptop data runtime, or a portable backup set.
Phase 2 produces the deletion-ledger and retrieval-eligibility inputs consumed
later; old-backup resurrection prevention through deletion replay belongs to
Phase 9.

Every phase continues to use real PostgreSQL, PostgREST, Supabase Auth, live
provider, and running-app tests where its behavior requires them. Moving Phase
9 does not permit mocked evidence to satisfy a gate.

### Phase 8: Staged CLOUD Authority and Observation

Phase 8 may:

- grant per-user CLOUD response authority on the initial deployment;
- run operator, empty-account, friend, and invited-cohort observation;
- prove cloud-only turns survive advanced-route disablement;
- retain the staged provider-native recent-cloud/simple-search fallback on the
  fixed initial Supabase/Heroku endpoint;
- exercise Supabase-native operational snapshots as an interim measure.

Phase 8 may not:

- delete or prune the phone's full local memory sources;
- describe local stores as retired;
- claim provider-independent disaster recovery;
- move the primary database to another provider;
- enable a second writer;
- deliver or activate signed migration endpoint profiles;
- close the observation window with irreversible local cleanup.

Phase 8 completes when the staged cohort is healthy and the system is ready for
the final recovery program. It does not complete local retirement.

### Phase 9: Portability, Disaster Recovery, and Local Retirement

Phase 9 contains the former Phase 0P scope:

- portable canonical migrations and provider overlays;
- externally signed writer leases and fresh-target cutovers;
- encrypted, checksummed, manifest-backed PostgreSQL backups;
- hash-chained deletion receipts and restore-time replay;
- Supabase-to-local, local-to-Supabase, and managed-provider rehearsals;
- Heroku, generic PostgreSQL, and Windows laptop runtime modes;
- signed mobile endpoint profiles;
- provider runbooks and AI-agent migration wrappers;
- interruption, corruption, stale-writer, and rollback sabotage.

Only Phase 9 may authorize retirement of heavy local memory stores. That
authorization requires all existing portability gates plus:

1. Completed signed Phase 1–8 evidence passes revalidation, including the
   completed Phase 8 operator-and-friend observation report.
2. A current cloud snapshot restores into one fresh target, and retained
   phone/local sources independently rebuild/import into a separate fresh
   target.
3. Deletion receipts replay after an older-backup resurrection attempt and
   deleted evidence remains absent.
4. Exact source counts and hashes match each recovery path's signed source
   manifest, with owner isolation, writer fencing, and source parity intact.
5. A cloud-only turn survives staged provider-native rollback and
   current-cloud-snapshot fresh-target recovery.
6. The same backend artifact passes Heroku and Windows health checks.
7. At least one non-Supabase managed destination rehearsal passes.
8. Zero cloud-only-turn, source-parity, or deletion loss is present.

If any gate fails, Phase 9 remains incomplete, the healthy Supabase service may
remain active under the user's current valid authority, complete local sources
remain retained, and no alternate provider or second writer may activate.

## Naming and Documentation

- Replace the `0P` delivery label with `9`.
- Rename the planned branch to `codex/cloud-memory-phase-9-portability`.
- Keep the existing portability plan file path to preserve links and history,
  but retitle it as the Phase 9 execution plan.
- Update the master roadmap, the cloud-authoritative design, `AGENTS.md`,
  `memory.md`, `PLAN.md`, and Phase 0 references so none says portability must
  precede MIRROR.
- Add a documentation contract test that fails if `0P` reappears in the active
  roadmap, if Phase 9 is not last, or if Phase 8 is allowed to retire local
  memory.

## Rejected Alternatives

### Keep Phase 0P before MIRROR

This preserved the original safety order but contradicted the requested
delivery sequence and delayed all memory-quality work behind the full
multi-provider program.

### Move Phase 0P last without changing Phase 8

This would allow local retirement before portable backup, restore, deletion
replay, and alternate-provider recovery had been proven. It was rejected
because it converts a sequencing preference into irreversible data risk.

### Split portability into early and late halves

This would keep some provider work before MIRROR and make phase ownership
ambiguous. The selected design instead relies only on the already completed
Phase 0 fences before Phase 9 and keeps the full portability program together.

## Verification

The sequencing revision is complete only when:

- the documentation contract test passes;
- the active roadmap contains exactly ten delivery phases in the order
  `0, 1, 2, 3, 4, 5, 6, 7, 8, 9`;
- Phase 8 explicitly retains full local sources;
- Phase 9 is the only local-retirement gate;
- all changed documentation is free of contradictory `0P-before-MIRROR`
  language;
- root type, lint, design, focused documentation tests, and the full suite pass;
- an independent reviewer reports no important sequencing or safety gap.
