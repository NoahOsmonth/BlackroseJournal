# Legacy Epic Plan: Rosebud Local Memory System

## Status

This file records the implemented local-memory baseline and is retained as
current-state context. It is not the active cloud migration plan.

The approved 2026-07-28 architecture is defined by:

- [Cloud-memory master roadmap](docs/superpowers/plans/2026-07-28-cloud-memory-master-roadmap.md)
- [Portability as the final memory phase](docs/superpowers/specs/2026-07-29-portability-final-phase-sequencing-design.md)
- [Cloud-authoritative Rosebud memory design](docs/superpowers/specs/2026-07-28-cloud-authoritative-rosebud-memory-design.md)
- [Backend and database portability design](docs/superpowers/specs/2026-07-28-rosebud-backend-database-portability-design.md)
- [Phase 0 contract and safety execution plan](docs/superpowers/plans/2026-07-28-cloud-memory-phase-0-contract-safety.md)

Phase 0 is complete and Phase 1 is next. Phases 1–8 deliver the cloud-memory
behavior sequence; Phase 8 may stage CLOUD authority while retaining full local
sources read-only. Final Phase 9 owns portability, disaster recovery, and the
only gate that may authorize local heavy-store retirement.

## Goal
Build a phone-local memory system for Rosebud that gives the AI durable,
privacy-preserving continuity without restoring the removed backend/SimpleMem
stack. The system should support short-term context, long-term journal memory,
about-user profile memory, notes, feedback/preferences, and a richer weekly
history experience.

## Current Direction
1. **Research and invention**
   - Ground the architecture in recent memory-agent research.
   - Document the full proposal in `idea.md` and the implementation contract in
     `memory.md`.
2. **Local memory service**
   - Add `services/memory/` with on-device memory atoms.
   - Persist completed journal memory in AsyncStorage.
   - Retrieve bounded context by salience, recency, usage, and lexical overlap.
3. **Prompt integration**
   - Add `hooks/memory/useLocalMemoryContext.ts`.
   - Inject a compact local memory capsule into journal chat prompts.
   - Save completed entries into long-term local memory after finish.
4. **Week history UX**
   - Add a rich weekly summary strip to History.
   - Show entries, check-ins, active days, and recurring signals.
5. **Settings memory controls**
   - Show local memory counts and about-user preview.
   - Let the user add explicit memory notes.
   - Let the user clear local AI memory.
6. **Testing and verification**
   - Unit test memory extraction/retrieval and weekly history aggregation.
   - Component test the weekly summary UI.
   - Update local backup tests to include the memory store.
   - Run targeted tests, design check, and type/lint checks where feasible.

## Architecture
- **Service layer:** `services/memory/localMemory.ts` owns persistence,
  extraction, retrieval, prompt formatting, and test adapter injection.
- **Hook layer:** `hooks/memory/useLocalMemoryContext.ts` exposes compact memory
  state to screens.
- **UI layer:** `components/history/HistoryWeekSummary.tsx` renders weekly
  history metrics; `app/(tabs)/entries.tsx` composes it.
- **Chat route:** `app/chat.tsx` combines therapist prompt, local memory, and
  feedback guidance, then writes completed entries into memory.

## Acceptance Criteria
- `idea.md` contains a 1000+ word research-backed invention for the memory
  system.
- `memory.md` documents implemented behavior and next phases.
- Completed journal entries create local memory atoms.
- Journal chat receives a bounded local memory capsule.
- Drafts are not saved as long-term memory.
- Settings exposes local memory counts, about-user preview, notes, and clear action.
- History shows a weekly summary panel.
- Local backups include the memory store.
- New/updated tests pass.
