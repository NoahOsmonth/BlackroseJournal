import fs from 'fs';
import path from 'path';

const phaseRows = [
    '| 0 | `codex/cloud-memory-phase-0` | `docs/superpowers/plans/2026-07-28-cloud-memory-phase-0-contract-safety.md` | Contracts |',
    '| 1 | `codex/cloud-memory-phase-1-mirror` | `docs/superpowers/plans/2026-07-29-cloud-memory-phase-1-mirror-ingestion.md` | MIRROR ingestion |',
    '| 2 | `codex/cloud-memory-phase-2-truth` | `docs/superpowers/plans/2026-07-28-cloud-memory-master-roadmap.md` | Truth |',
    '| 3 | `codex/cloud-memory-phase-3-curation` | `docs/superpowers/plans/2026-07-28-cloud-memory-master-roadmap.md` | Curation |',
    '| 4 | `codex/cloud-memory-phase-4-retrieval` | `docs/superpowers/plans/2026-07-28-cloud-memory-master-roadmap.md` | Retrieval |',
    '| 5 | `codex/cloud-memory-phase-5-orchestration` | `docs/superpowers/plans/2026-07-28-cloud-memory-master-roadmap.md` | Orchestration |',
    '| 6 | `codex/cloud-memory-phase-6-judgment` | `docs/superpowers/plans/2026-07-28-cloud-memory-master-roadmap.md` | Judgment |',
    '| 7 | `codex/cloud-memory-phase-7-shadow` | `docs/superpowers/plans/2026-07-28-cloud-memory-master-roadmap.md` | Shadow evaluation |',
    '| 8 | `codex/cloud-memory-phase-8-cutover` | `docs/superpowers/plans/2026-07-28-cloud-memory-master-roadmap.md` | Staged CLOUD authority |',
    '| 9 | `codex/cloud-memory-phase-9-portability` | `docs/superpowers/plans/2026-07-28-cloud-memory-portability.md` | Portability and disaster recovery |',
];

const phaseEightSafety = `- retain complete local memory sources read-only throughout observation;
- do not claim provider-independent disaster recovery;
- do not retire heavy local stores;
- do not move the primary database to another provider;
- do not enable a second writer;
- do not perform irreversible local cleanup;
- hand the healthy staged deployment to Phase 9 for recovery certification.`;

const phaseNineRetirementGates = `- completed signed Phase 1–8 evidence passes revalidation, including the completed Phase 8 operator-and-friend observation report;
- a current cloud snapshot restores into a fresh target, and retained phone/local sources independently rebuild/import into a separate fresh target;
- deletion receipts replay after an older-backup resurrection attempt and deleted evidence remains absent;
- exact source counts and hashes match each recovery path's signed source manifest, with owner isolation, writer fencing, and source parity intact;
- a cloud-only turn survives staged provider-native rollback and current-cloud-snapshot fresh-target recovery;
- zero cloud-only-turn, source-parity, or deletion loss is present.`;

const phaseNineSafety = `Only Phase 9 may authorize retirement of heavy local memory stores. If any
backup, restore, deletion-replay, alternate-provider, or laptop-recovery gate
fails, Supabase may remain the active cloud service but full local sources stay
retained.

A Phase 9 failure blocks heavy local-store retirement and activation of any
alternate provider or second writer; the healthy Supabase service may remain
active under the user's current valid authority.`;

export const validPhaseOnePlan = `# Phase 1 MIRROR Ingestion Plan

## 1. Authority

Phase 1 visible-response read authority remains LOCAL for every enrolled owner.
Keep Phases 2-8 mapped to the master roadmap and Phase 9 last.

## 5.1 Additive schema

Add memory_import_completion_permits for short-lived completion permits.

## 4.2 Cursor authority

The mirror sequencing authority is the per-source/per-message revision cursors.
The Phase 0 memory_source_watermarks table is reused only for legacy client
sequencing and is not the mirror sequencing authority.

## 7.4 Two-device same-owner reconciliation

Phase 1 supports two independent devices for the same owner. The server allows
only one active manifest per owner across all devices. Uploads use revision CAS
with previousAcceptedRevision. Both devices converge on one completion receipt.
No accepted revision is lost: no lost accepted revisions. Tombstones are
owner-scoped: no cross-device resurrection.
`;

export const validRoadmap = `# Cloud Memory Roadmap

## Delivery Model

| Phase | Branch | Executable plan | Independently testable result |
|---|---|---|---|
${phaseRows.join('\n')}

## Phase 1 — MIRROR Ingestion

Phase 1 contract.

## Phase 2 — Epistemic Truth and Deletion

Phase 2 contract.

## Phase 3 — Versioned Curation and Projections

Phase 3 contract.

## Phase 4 — Evidence-Set Planning and Retrieval

Phase 4 contract.

## Phase 5 — Live Context and Orchestration

Phase 5 contract.

## Phase 6 — Conversational Judgment and Learning

Phase 6 contract.

## Phase 7 — SHADOW Evaluation and Operations

Phase 7 contract.

## Phase 8 — Staged CLOUD Authority and Observation

Deliver:

${phaseEightSafety}

Gate:

- the staged observation window remains open until Phase 9 recovery certification.

## Phase 9 — Portability, Disaster Recovery, and Local Retirement

Deliver:

- portable recovery, signed endpoint migration profiles, and deletion replay.

Gate:

${phaseNineRetirementGates}

${phaseNineSafety}
`;

export const deprecatedPhaseRoadmap = validRoadmap.replace(
    `${phaseRows[0]}\n`,
    `${phaseRows[0]}\n| 0P | \`codex/cloud-memory-portability\` | \`docs/superpowers/plans/2026-07-28-cloud-memory-portability.md\` | Deprecated portability |\n`,
);

export const outOfOrderRoadmap = validRoadmap.replace(
    `${phaseRows[1]}\n${phaseRows[2]}`,
    `${phaseRows[2]}\n${phaseRows[1]}`,
);

export const branchlessRoadmap = validRoadmap.replace(
    `| Phase | Branch | Executable plan | Independently testable result |
|---|---|---|---|
${phaseRows.join('\n')}`,
    `| Phase | Delivery |
|---|---|
${phaseRows
    .map((row, index) => `| ${index} | ${index === 9 ? 'Portability' : 'Phase'} |`)
    .join('\n')}`,
);

export const wrongPhaseNineBranchRoadmap = validRoadmap.replace(
    '`codex/cloud-memory-phase-9-portability`',
    '`codex/cloud-memory-portability`',
);

export const prematureRetirementRoadmap = validRoadmap.replace(
    '- do not retire heavy local stores;',
    '- retire heavy local stores after staged cloud authority;',
);

export const missingRetentionRoadmap = validRoadmap.replace(
    '- retain complete local memory sources read-only throughout observation;\n',
    '',
);

export const missingDisasterRecoveryBoundaryRoadmap = validRoadmap.replace(
    '- do not claim provider-independent disaster recovery;\n',
    '',
);

export const missingPhaseNineHandoffRoadmap = validRoadmap.replace(
    '- hand the healthy staged deployment to Phase 9 for recovery certification.\n',
    '',
);

export const missingExclusiveRetirementRoadmap = validRoadmap.replace(
    'Only Phase 9 may authorize retirement of heavy local memory stores. ',
    '',
);

export const missingFailedGateRetentionRoadmap = validRoadmap.replace(
    `If any
backup, restore, deletion-replay, alternate-provider, or laptop-recovery gate
fails, Supabase may remain the active cloud service but full local sources stay
retained.`,
    'All recovery gates are expected to pass.',
);

export const obsoleteLocalAuthorityGateRoadmap = validRoadmap.replace(
    `A Phase 9 failure blocks heavy local-store retirement and activation of any
alternate provider or second writer; the healthy Supabase service may remain
active under the user's current valid authority.`,
    'A Phase 9 failure requires authority to remain LOCAL.',
);

const activeGuidancePaths = [
    'AGENTS.md',
    'memory.md',
    'PLAN.md',
    'docs/superpowers/plans/2026-07-28-cloud-memory-phase-0-contract-safety.md',
    'docs/superpowers/plans/2026-07-28-cloud-memory-portability.md',
];

const linkedPlanPaths = [
    'docs/superpowers/plans/2026-07-28-cloud-memory-phase-0-contract-safety.md',
    'docs/superpowers/plans/2026-07-29-cloud-memory-phase-1-mirror-ingestion.md',
    'docs/superpowers/plans/2026-07-28-cloud-memory-portability.md',
];

export function writeFixture(
    root: string,
    roadmap: string,
    phaseOnePlan: string = validPhaseOnePlan,
): void {
    const roadmapPath = path.join(
        root,
        'docs',
        'superpowers',
        'plans',
        '2026-07-28-cloud-memory-master-roadmap.md',
    );

    fs.mkdirSync(path.dirname(roadmapPath), { recursive: true });
    fs.writeFileSync(roadmapPath, roadmap, 'utf8');

    for (const relativePath of activeGuidancePaths) {
        const guidancePath = path.join(root, relativePath);
        fs.mkdirSync(path.dirname(guidancePath), { recursive: true });
        fs.writeFileSync(
            guidancePath,
            'Phase 9 is the final portability and local-retirement gate.\n',
            'utf8',
        );
    }

    for (const relativePath of linkedPlanPaths) {
        const planPath = path.join(root, relativePath);
        fs.mkdirSync(path.dirname(planPath), { recursive: true });
        if (relativePath.includes('2026-07-29-cloud-memory-phase-1-mirror-ingestion')) {
            fs.writeFileSync(planPath, phaseOnePlan, 'utf8');
        } else if (!fs.existsSync(planPath)) {
            fs.writeFileSync(planPath, '# Literal fixture plan\n', 'utf8');
        }
    }
}
