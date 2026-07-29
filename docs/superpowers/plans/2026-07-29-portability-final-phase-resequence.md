# Portability Final-Phase Resequencing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make portability and disaster recovery the final Phase 9 while preventing Phase 8 from retiring complete local memory sources.

**Architecture:** The active master roadmap contains exactly ten delivery phases in the order `0, 1, 2, 3, 4, 5, 6, 7, 8, 9`. Phase 8 stages CLOUD authority on the initial Supabase/Heroku deployment while retaining full local sources. Phase 9 contains the former Phase 0P portability scope and is the only phase that can authorize local retirement.

**Tech Stack:** Markdown specifications and plans, TypeScript 5.9, Jest 29, Node.js filesystem APIs.

## Global Constraints

- Do not change application runtime behavior, database schema, migrations, dependencies, or lockfiles.
- Preserve all completed Phase 0 evidence and migration filenames.
- Do not touch `example-design/`, generated output, or unrelated dirty files.
- Phase 0 remains complete and every user remains effectively `LOCAL`.
- Phase 8 may stage CLOUD authority but must retain complete local memory sources.
- Only Phase 9 may authorize local heavy-store retirement.
- Tests are part of the diff and must fail before the documentation is changed.

---

### Task 1: Add a Failing Roadmap-Order Contract

**Files:**
- Create: `__tests__/docs/cloudMemoryRoadmapOrder.test.ts`

**Interfaces:**
- Consumes: active roadmap and repository-constitution Markdown files.
- Produces: a Jest contract that pins ten ordered phases, Phase 8 local retention, and final Phase 9 retirement authority.

- [ ] **Step 1: Write the failing test**

```ts
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(__dirname, '../..');
const read = (relativePath: string): string =>
  fs.readFileSync(path.join(root, relativePath), 'utf8');

describe('cloud memory roadmap order', () => {
  const roadmap = read(
    'docs/superpowers/plans/2026-07-28-cloud-memory-master-roadmap.md',
  );

  it('contains exactly ten ordered delivery phases with portability last', () => {
    const phaseRows = [...roadmap.matchAll(
      /^\| (0|[1-9]) \| `codex\/cloud-memory-[^`]+` \|/gm,
    )].map((match) => match[1]);
    expect(phaseRows).toEqual([
      '0', '1', '2', '3', '4', '5', '6', '7', '8', '9',
    ]);
    expect(roadmap).not.toMatch(/^\| 0P \|/m);
    expect(roadmap).toContain('codex/cloud-memory-phase-9-portability');
  });

  it('retains full local sources in Phase 8 and gates retirement in Phase 9', () => {
    const phase8 = roadmap.split('## Phase 8')[1]?.split('## Phase 9')[0] ?? '';
    const phase9 = roadmap.split('## Phase 9')[1] ?? '';
    expect(phase8).toMatch(/retain(s|ed)? (the )?full local/i);
    expect(phase8).toMatch(/must not retire/i);
    expect(phase9).toMatch(/only Phase 9 may authorize/i);
    expect(phase9).toMatch(/local.*retire/i);
  });

  it('updates active repository guidance to the final Phase 9 name', () => {
    for (const relativePath of [
      'AGENTS.md',
      'memory.md',
      'PLAN.md',
      'docs/superpowers/plans/2026-07-28-cloud-memory-phase-0-contract-safety.md',
      'docs/superpowers/plans/2026-07-28-cloud-memory-portability.md',
    ]) {
      const contents = read(relativePath);
      expect(contents).not.toMatch(/Phase 0P/);
      expect(contents).toMatch(/Phase 9/);
    }
  });
});
```

- [ ] **Step 2: Run the test and verify red**

Run:

```powershell
npx jest --runInBand __tests__/docs/cloudMemoryRoadmapOrder.test.ts
```

Expected: FAIL because the roadmap still contains `0P`, Phase 8 still owns local retirement, and the active guidance still names Phase 0P.

- [ ] **Step 3: Commit the red contract**

```powershell
git add __tests__/docs/cloudMemoryRoadmapOrder.test.ts
git commit -m "test(memory): pin portability as final phase"
```

---

### Task 2: Resequence the Master Roadmap and Authoritative Design

**Files:**
- Modify: `docs/superpowers/plans/2026-07-28-cloud-memory-master-roadmap.md`
- Modify: `docs/superpowers/specs/2026-07-28-cloud-authoritative-rosebud-memory-design.md`

**Interfaces:**
- Consumes: `docs/superpowers/specs/2026-07-29-portability-final-phase-sequencing-design.md`.
- Produces: the authoritative ten-phase order and Phase 8/9 safety boundary.

- [ ] **Step 1: Rewrite the delivery table**

Replace the `0P` row and ordering so the table is exactly:

```markdown
| 0 | `codex/cloud-memory-phase-0` | `docs/superpowers/plans/2026-07-28-cloud-memory-phase-0-contract-safety.md` | Canonical contracts, owner-isolated source/ops schema, Supabase JWT auth, durable job primitive, read-only source inventory, benchmark registry, Heroku-ready backend |
| 1 | `codex/cloud-memory-phase-1-mirror` | `docs/superpowers/plans/2026-07-28-cloud-memory-phase-1-mirror-ingestion.md` | Encrypted offline outbox, chunked idempotent source upload, manifests, hash parity, local authority preserved |
| 2 | `codex/cloud-memory-phase-2-truth` | `docs/superpowers/plans/2026-07-28-cloud-memory-phase-2-epistemic-truth.md` | Evidence spans, entities, aliases, bitemporal claims, episodes, preferences, dependencies, edit/delete cascades |
| 3 | `codex/cloud-memory-phase-3-curation` | `docs/superpowers/plans/2026-07-28-cloud-memory-phase-3-curation-projections.md` | Versioned extraction, temporal digests, profile tree, open threads, search documents, embeddings, collision review |
| 4 | `codex/cloud-memory-phase-4-retrieval` | `docs/superpowers/plans/2026-07-28-cloud-memory-phase-4-evidence-retrieval.md` | Target planning, exact-recent lane, lexical/vector/entity/temporal/graph candidates, RRF, reranking, coverage verification |
| 5 | `codex/cloud-memory-phase-5-orchestration` | `docs/superpowers/plans/2026-07-28-cloud-memory-phase-5-live-orchestration.md` | Temporal orientation blocks, exact-evidence windows, backend tools, Scout, deterministic orchestrator, Primary Rosebud streaming |
| 6 | `codex/cloud-memory-phase-6-judgment` | `docs/superpowers/plans/2026-07-28-cloud-memory-phase-6-utilization-learning.md` | Utilization controller, scoped Preference Ledger, Outcome Observer, deep formulation, optional private differential firewall |
| 7 | `codex/cloud-memory-phase-7-shadow` | `docs/superpowers/plans/2026-07-28-cloud-memory-phase-7-shadow-evaluation.md` | One-year fixtures, public benchmark adapters, shadow comparator, ablations, dashboards, kill switches |
| 8 | `codex/cloud-memory-phase-8-cutover` | `docs/superpowers/plans/2026-07-28-cloud-memory-phase-8-cutover-retirement.md` | Staged CLOUD authority and observation with full local source retention |
| 9 | `codex/cloud-memory-phase-9-portability` | `docs/superpowers/plans/2026-07-28-cloud-memory-portability.md` | Portability, disaster recovery, laptop modes, provider migration, and final local-retirement gate |
```

Keep each row's existing exact plan filename for Phases 0–8.

- [ ] **Step 2: Move the portability section after Phase 8**

Rename it:

```markdown
## Phase 9 — Portability, Disaster Recovery, and Local Retirement
```

Retain its existing deliverables and gates. Add:

```markdown
Only Phase 9 may authorize retirement of heavy local memory stores. If any
backup, restore, deletion-replay, alternate-provider, or laptop-recovery gate
fails, Supabase may remain the active cloud service but full local sources stay
retained.
```

- [ ] **Step 3: Narrow Phase 8**

Rename it:

```markdown
## Phase 8 — Staged CLOUD Authority and Observation
```

Replace local-retirement deliverables and gates with:

```markdown
- retain complete local memory sources read-only throughout observation;
- do not claim provider-independent disaster recovery;
- do not retire heavy local stores;
- hand the healthy staged deployment to Phase 9 for recovery certification.
```

- [ ] **Step 4: Update the authoritative design migration section**

In Section 26, state:

```markdown
Phase 8 may stage CLOUD authority on the initial Supabase/Heroku deployment,
but complete local sources remain read-only. Portability and disaster recovery
are final Phase 9. Only a passing Phase 9 may close the observation window with
heavy local-store retirement.
```

Update acceptance language near local retirement so it requires Phase 9.

- [ ] **Step 5: Run the focused test**

Run:

```powershell
npx jest --runInBand __tests__/docs/cloudMemoryRoadmapOrder.test.ts
```

Expected: still FAIL only because the repository guidance files have not yet been updated.

- [ ] **Step 6: Commit the authoritative order**

```powershell
git add docs/superpowers/plans/2026-07-28-cloud-memory-master-roadmap.md docs/superpowers/specs/2026-07-28-cloud-authoritative-rosebud-memory-design.md
git commit -m "docs(memory): move portability behind cloud observation"
```

---

### Task 3: Update Repository Guidance and Execution Plans

**Files:**
- Modify: `AGENTS.md`
- Modify: `memory.md`
- Modify: `PLAN.md`
- Modify: `docs/superpowers/plans/2026-07-28-cloud-memory-phase-0-contract-safety.md`
- Modify: `docs/superpowers/plans/2026-07-28-cloud-memory-portability.md`

**Interfaces:**
- Consumes: the master roadmap's Phase 8/9 boundary.
- Produces: consistent active instructions with no Phase 0P-before-MIRROR requirement.

- [ ] **Step 1: Update `AGENTS.md`**

Add to Rule 9:

```markdown
The delivery order is Phase 0, Phases 1–8, then final Phase 9 portability/DR.
Phase 8 may stage CLOUD authority, but full local sources remain read-only.
Only Phase 9 may authorize local heavy-store retirement.
```

- [ ] **Step 2: Update `memory.md` and `PLAN.md`**

Replace Phase 0P references with Phase 9. Link the master roadmap and the new sequencing design from `PLAN.md`, state Phase 1 is next, and state Phase 9 is final.

- [ ] **Step 3: Correct the completed Phase 0 plan**

Replace:

```markdown
belong to Phase 0P and must pass before MIRROR is called complete
```

with:

```markdown
belong to final Phase 9 and must pass before local heavy stores may retire
```

Update its documentation task to use the same final Phase 9 terminology.

- [ ] **Step 4: Retitle and reframe the portability plan**

Change the title to:

```markdown
# Cloud Memory Phase 9 Portability and Disaster-Recovery Implementation Plan
```

State that Phase 0 is complete, Phases 1–8 execute before this plan, and Task 1 revalidates all prior phase evidence rather than claiming the repository currently fails Phase 0. Preserve every real backup, restore, deletion, writer-fence, provider, laptop, and rollback test.

- [ ] **Step 5: Run the contract test and reference scan**

Run:

```powershell
npx jest --runInBand __tests__/docs/cloudMemoryRoadmapOrder.test.ts
rg -n "Phase 0P|\\| 0P \\||before MIRROR is called complete" AGENTS.md memory.md PLAN.md docs/superpowers/plans/2026-07-28-cloud-memory-master-roadmap.md docs/superpowers/plans/2026-07-28-cloud-memory-phase-0-contract-safety.md docs/superpowers/plans/2026-07-28-cloud-memory-portability.md
```

Expected: Jest PASS and `rg` exits `1` with no matches.

- [ ] **Step 6: Commit the guidance revision**

```powershell
git add AGENTS.md memory.md PLAN.md docs/superpowers/plans/2026-07-28-cloud-memory-phase-0-contract-safety.md docs/superpowers/plans/2026-07-28-cloud-memory-portability.md
git commit -m "docs(memory): make phase nine the retirement gate"
```

---

### Task 4: Verify, Record, and Review the Resequencing

**Files:**
- Modify: `PROGRESS.md`

**Interfaces:**
- Consumes: all prior task commits and verification results.
- Produces: final evidence for integrating the roadmap revision.

- [ ] **Step 1: Run the required gates**

Run:

```powershell
npx jest --runInBand __tests__/docs/cloudMemoryRoadmapOrder.test.ts __tests__/docs/agentsMemoryGraph.test.ts __tests__/backend-local-only.test.ts
npx tsc --noEmit
npm run lint
npm run check:design
npx jest --runInBand --silent
```

Expected: all commands exit `0`; lint and design may report only the already recorded warnings.

- [ ] **Step 2: Prove prohibited files are unchanged**

Run:

```powershell
git diff --exit-code 251c9bbf2eac0c547f7db8fee00350e8d0d53002..HEAD -- package-lock.json backend/package-lock.json supabase/migrations example-design
git diff --check
```

Expected: both commands exit `0`.

- [ ] **Step 3: Append the result to `PROGRESS.md`**

Record:

- the user-approved order `0, 1–8, 9`;
- Phase 8 retains full local sources;
- Phase 9 is the only retirement gate;
- focused and full test totals;
- no runtime, migration, dependency, or deployment change;
- independent review outcome.

- [ ] **Step 4: Commit the evidence**

```powershell
git add PROGRESS.md
git commit -m "docs(progress): record final-phase portability order"
```

- [ ] **Step 5: Request independent review**

The reviewer must inspect the full branch diff and report:

- any remaining `0P-before-MIRROR` contradiction;
- any Phase 8 path that permits local retirement;
- any Phase 9 gate weakened or lost;
- any runtime, migration, lockfile, or unrelated-file change.

Expected: no P0/P1/P2 finding before integration.
