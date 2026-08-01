import { validRoadmap, validPhaseOnePlan } from './cloudMemoryRoadmapFixtures';

const authoritativeTable = `| Phase | Branch | Executable plan | Independently testable result |
|---|---|---|---|
| 0 | \`codex/cloud-memory-phase-0\` | \`docs/superpowers/plans/2026-07-28-cloud-memory-phase-0-contract-safety.md\` | Contracts |
| 1 | \`codex/cloud-memory-phase-1-mirror\` | \`docs/superpowers/plans/2026-07-29-cloud-memory-phase-1-mirror-ingestion.md\` | MIRROR ingestion |
| 2 | \`codex/cloud-memory-phase-2-truth\` | \`docs/superpowers/plans/2026-07-28-cloud-memory-master-roadmap.md\` | Truth |
| 3 | \`codex/cloud-memory-phase-3-curation\` | \`docs/superpowers/plans/2026-07-28-cloud-memory-master-roadmap.md\` | Curation |
| 4 | \`codex/cloud-memory-phase-4-retrieval\` | \`docs/superpowers/plans/2026-07-28-cloud-memory-master-roadmap.md\` | Retrieval |
| 5 | \`codex/cloud-memory-phase-5-orchestration\` | \`docs/superpowers/plans/2026-07-28-cloud-memory-master-roadmap.md\` | Orchestration |
| 6 | \`codex/cloud-memory-phase-6-judgment\` | \`docs/superpowers/plans/2026-07-28-cloud-memory-master-roadmap.md\` | Judgment |
| 7 | \`codex/cloud-memory-phase-7-shadow\` | \`docs/superpowers/plans/2026-07-28-cloud-memory-master-roadmap.md\` | Shadow evaluation |
| 8 | \`codex/cloud-memory-phase-8-cutover\` | \`docs/superpowers/plans/2026-07-28-cloud-memory-master-roadmap.md\` | Staged CLOUD authority |
| 9 | \`codex/cloud-memory-phase-9-portability\` | \`docs/superpowers/plans/2026-07-28-cloud-memory-portability.md\` | Portability and disaster recovery |`;

export const branchlessPrimaryWithValidDecoyRoadmap = validRoadmap.replace(
    authoritativeTable,
    `| Phase | Delivery |
|---|---|
| 0 | Contracts |
| 1 | MIRROR |
| 2 | Truth |
| 3 | Curation |
| 4 | Retrieval |
| 5 | Orchestration |
| 6 | Judgment |
| 7 | Shadow |
| 8 | CLOUD observation |
| 9 | Portability |

${authoritativeTable}`,
);

export const duplicateAuthoritativeTableRoadmap = validRoadmap.replace(
    authoritativeTable,
    `${authoritativeTable}

${authoritativeTable}`,
);

export const blankResultRoadmap = validRoadmap.replace(
    '| 4 | `codex/cloud-memory-phase-4-retrieval` | `docs/superpowers/plans/2026-07-28-cloud-memory-master-roadmap.md` | Retrieval |',
    '| 4 | `codex/cloud-memory-phase-4-retrieval` | `docs/superpowers/plans/2026-07-28-cloud-memory-master-roadmap.md` | |',
);

export const wrongNonPhaseNineBranchRoadmap = validRoadmap.replace(
    '`codex/cloud-memory-phase-4-retrieval`',
    '`codex/cloud-memory-phase-4-wrong`',
);

export const wrongPlanLinkRoadmap = validRoadmap.replace(
    '| 4 | `codex/cloud-memory-phase-4-retrieval` | `docs/superpowers/plans/2026-07-28-cloud-memory-master-roadmap.md` | Retrieval |',
    '| 4 | `codex/cloud-memory-phase-4-retrieval` | `docs/superpowers/plans/wrong-phase-4-plan.md` | Retrieval |',
);

export const missingMappedPhaseSectionRoadmap = validRoadmap.replace(
    `## Phase 4 — Evidence-Set Planning and Retrieval

Phase 4 contract.

`,
    '',
);

export const safePlusDestructivePhaseEightRoadmap = validRoadmap.replace(
    '- do not perform irreversible local cleanup;',
    `- do not perform irreversible local cleanup;
- delete complete local memory sources during Phase 8 observation;`,
);

export const destructiveNoReviewPhaseEightRoadmap = validRoadmap.replace(
    '- do not perform irreversible local cleanup;',
    `- do not perform irreversible local cleanup;
- delete complete local sources with no additional review;`,
);

export const destructiveWithoutDelayPhaseEightRoadmap = validRoadmap.replace(
    '- do not perform irreversible local cleanup;',
    `- do not perform irreversible local cleanup;
- remove local sources without delay;`,
);

export const approvedPlusForcedLocalPhaseNineRoadmap = validRoadmap.replace(
    '- zero cloud-only-turn, source-parity, or deletion loss is present.',
    `- zero cloud-only-turn, source-parity, or deletion loss is present.
- a Phase 9 failure requires authority to remain LOCAL.`,
);

export const conditionalForcedLocalPhaseNineRoadmap = validRoadmap.replace(
    '- zero cloud-only-turn, source-parity, or deletion loss is present.',
    `- zero cloud-only-turn, source-parity, or deletion loss is present.
- If any recovery gate fails, memory authority must return to LOCAL.`,
);

export const negatedForcedLocalProhibitionRoadmap = validRoadmap.replace(
    '- zero cloud-only-turn, source-parity, or deletion loss is present.',
    `- zero cloud-only-turn, source-parity, or deletion loss is present.
- If any recovery gate fails, memory authority must not return to LOCAL.`,
);

export const nonSemanticDestructionExampleRoadmap = validRoadmap.replace(
    'Gate:\n\n- the staged observation window',
    `\`\`\`markdown
- retire local stores during an obsolete example.
\`\`\`

<!-- delete complete local sources in a discarded draft -->

Gate:

- the staged observation window`,
);

export const safetyOnlyInNonSemanticExampleRoadmap = validRoadmap.replace(
    `- retain complete local memory sources read-only throughout observation;
- do not claim provider-independent disaster recovery;
- do not retire heavy local stores;
- do not move the primary database to another provider;
- do not enable a second writer;
- do not perform irreversible local cleanup;
- hand the healthy staged deployment to Phase 9 for recovery certification.`,
    `\`\`\`markdown
- retain complete local memory sources read-only throughout observation;
- do not claim provider-independent disaster recovery;
- do not retire heavy local stores;
- do not move the primary database to another provider;
- do not enable a second writer;
- do not perform irreversible local cleanup;
- hand the healthy staged deployment to Phase 9 for recovery certification.
\`\`\`

- run staged observation.`,
);

export const safetyOnlyInLaterNotesRoadmap = validRoadmap
    .replace(
        `- retain complete local memory sources read-only throughout observation;
- do not claim provider-independent disaster recovery;
- do not retire heavy local stores;
- do not move the primary database to another provider;
- do not enable a second writer;
- do not perform irreversible local cleanup;
- hand the healthy staged deployment to Phase 9 for recovery certification.`,
        '- run staged observation.',
    )
    .replace(
        '- the staged observation window remains open until Phase 9 recovery certification.',
        `- the staged observation window remains open.

Notes:

- retain complete local memory sources read-only throughout observation;
- do not claim provider-independent disaster recovery;
- do not retire heavy local stores;
- do not move the primary database to another provider;
- do not enable a second writer;
- do not perform irreversible local cleanup;
- hand the healthy staged deployment to Phase 9 for recovery certification.`,
    );

export const missingPriorPhaseEvidenceRoadmap = validRoadmap.replace(
    '- completed signed Phase 1–8 evidence passes revalidation, including the completed Phase 8 operator-and-friend observation report;\n',
    '',
);

export const missingDualRecoveryRoadmap = validRoadmap.replace(
    '- a current cloud snapshot restores into a fresh target, and retained phone/local sources independently rebuild/import into a separate fresh target;\n',
    '',
);

export const missingDeletionReplayRoadmap = validRoadmap.replace(
    '- deletion receipts replay after an older-backup resurrection attempt and deleted evidence remains absent;\n',
    '',
);

export const missingSourceParityRoadmap = validRoadmap.replace(
    "- exact source counts and hashes match each recovery path's signed source manifest, with owner isolation, writer fencing, and source parity intact;\n",
    '',
);

export const missingCloudOnlyTurnRoadmap = validRoadmap.replace(
    '- a cloud-only turn survives staged provider-native rollback and current-cloud-snapshot fresh-target recovery;\n',
    '',
);

export const missingZeroLossRoadmap = validRoadmap.replace(
    '- zero cloud-only-turn, source-parity, or deletion loss is present.\n',
    '',
);

export const unnamedCompletionPermitsPhaseOnePlan = validPhaseOnePlan.replace(
    'Add memory_import_completion_permits for short-lived completion permits.',
    'Add short-lived completion permits issued from database time.',
);

export const extendedWatermarkPhaseOnePlan = validPhaseOnePlan.replace(
    'The Phase 0 memory_source_watermarks table is reused only for legacy client\nsequencing and is not the mirror sequencing authority.',
    'The Phase 0 memory_source_watermarks table is extended to become the mirror\nsequencing authority.',
);

export const singleDevicePhaseOnePlan = validPhaseOnePlan.replace(
    'Phase 1 supports two independent devices for the same owner.',
    'Phase 1 supports one device per owner.',
);

export const noActiveManifestSerializationPhaseOnePlan = validPhaseOnePlan.replace(
    'A partial unique index permits only one active\nmanifest per owner across all devices.',
    'Each device may keep its own active manifest.',
);

export const noRevisionCasPhaseOnePlan = validPhaseOnePlan.replace(
    'Apply source/message revision CAS under row locks.',
    'Uploads are accepted by best-effort ordering.',
);

export const noCompletionReceiptConvergencePhaseOnePlan = validPhaseOnePlan.replace(
    "Both devices converge on B's latest\nowner-union receipt/version.",
    'Each device receives its own completion receipt.',
);

export const lostAcceptedRevisionsPhaseOnePlan = validPhaseOnePlan.replace(
    'Every accepted A and B revision remains visible in\nthe resulting current view.',
    'A slower device may drop revisions accepted from the other device.',
);

export const crossDeviceResurrectionPhaseOnePlan = validPhaseOnePlan.replace(
    'Tombstones are owner-scoped: no cross-device\nresurrection.',
    'Tombstones are device-scoped and do not suppress the same identity from the\nother device.',
);

export const phaseOneReadAuthorityNotLocalPlan = validPhaseOnePlan.replace(
    'Phase 1 visible-response read authority remains LOCAL for every enrolled owner.',
    'Phase 1 may read cloud memory into visible responses.',
);

export const exactNewestManifestMembershipPhaseOnePlan = validPhaseOnePlan.replace(
    'Completion carries prior verified rows forward transactionally.',
    `Completion carries prior verified rows forward transactionally.
The owner current view is replaced by exactly the newest manifest membership.`,
);

export const wholeOwnerInventoryRequiredPhaseOnePlan = validPhaseOnePlan.replace(
    'Manifest omission is always a no-op.',
    `Manifest omission is always a no-op.
Each completing device must provide the whole-owner inventory.`,
);

export const omissionDeletesPriorRowsPhaseOnePlan = validPhaseOnePlan.replace(
    'Manifest omission is always a no-op.',
    `Manifest omission is always a no-op.
Omission from a completed manifest deletes prior eligible rows.`,
);

export const sourceContentDownloadPhaseOnePlan = validPhaseOnePlan.replace(
    'is added. Keep Phases 2-8 mapped',
    `is added. Server-to-client source-content download is enabled for reconciliation.
Keep Phases 2-8 mapped`,
);

export const multipleActiveOwnerManifestsPhaseOnePlan = validPhaseOnePlan.replace(
    'manifest per owner across all devices.',
    `manifest per owner across all devices.
Each device may also keep its own active manifest for the owner.`,
);

export const staleCasOverwritePhaseOnePlan = validPhaseOnePlan.replace(
    'snapshot cannot overwrite accepted revisions.',
    `snapshot cannot overwrite accepted revisions.
A stale shared-source snapshot may overwrite the accepted server revision.`,
);

export const deviceScopedTombstonesPhaseOnePlan = validPhaseOnePlan.replace(
    'Tombstones are owner-scoped: no cross-device\nresurrection.',
    `Tombstones are owner-scoped: no cross-device resurrection.
Tombstones are device-scoped for upload and restore decisions.`,
);

export const cloudVisibleReadsPhaseOnePlan = validPhaseOnePlan.replace(
    'Phase 1 visible-response read authority remains LOCAL for every enrolled owner.',
    `Phase 1 visible-response read authority remains LOCAL for every enrolled owner.
Phase 1 may also read cloud source content into visible responses.`,
);

export const oneGlobalReceiptPhaseOnePlan = validPhaseOnePlan.replace(
    'its original receipt.',
    `its original receipt.
The owner has one global completion receipt forever across all generations.`,
);
