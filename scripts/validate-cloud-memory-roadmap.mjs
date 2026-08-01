import fs from 'node:fs';
import path from 'node:path';

const repositoryRoot = path.resolve(process.argv[2] ?? process.cwd());
const roadmapRelativePath =
    'docs/superpowers/plans/2026-07-28-cloud-memory-master-roadmap.md';
const phaseOnePlanRelativePath =
    'docs/superpowers/plans/2026-07-29-cloud-memory-phase-1-mirror-ingestion.md';
const activeGuidancePaths = [
    'AGENTS.md',
    'memory.md',
    'PLAN.md',
    'docs/superpowers/plans/2026-07-28-cloud-memory-phase-0-contract-safety.md',
    'docs/superpowers/plans/2026-07-28-cloud-memory-portability.md',
];
const expectedPhaseRows = [
    {
        phase: '0',
        branch: '`codex/cloud-memory-phase-0`',
        plan: '`docs/superpowers/plans/2026-07-28-cloud-memory-phase-0-contract-safety.md`',
    },
    {
        phase: '1',
        branch: '`codex/cloud-memory-phase-1-mirror`',
        plan: '`docs/superpowers/plans/2026-07-29-cloud-memory-phase-1-mirror-ingestion.md`',
    },
    {
        phase: '2',
        branch: '`codex/cloud-memory-phase-2-truth`',
        plan: '`docs/superpowers/plans/2026-07-28-cloud-memory-master-roadmap.md`',
    },
    {
        phase: '3',
        branch: '`codex/cloud-memory-phase-3-curation`',
        plan: '`docs/superpowers/plans/2026-07-28-cloud-memory-master-roadmap.md`',
    },
    {
        phase: '4',
        branch: '`codex/cloud-memory-phase-4-retrieval`',
        plan: '`docs/superpowers/plans/2026-07-28-cloud-memory-master-roadmap.md`',
    },
    {
        phase: '5',
        branch: '`codex/cloud-memory-phase-5-orchestration`',
        plan: '`docs/superpowers/plans/2026-07-28-cloud-memory-master-roadmap.md`',
    },
    {
        phase: '6',
        branch: '`codex/cloud-memory-phase-6-judgment`',
        plan: '`docs/superpowers/plans/2026-07-28-cloud-memory-master-roadmap.md`',
    },
    {
        phase: '7',
        branch: '`codex/cloud-memory-phase-7-shadow`',
        plan: '`docs/superpowers/plans/2026-07-28-cloud-memory-master-roadmap.md`',
    },
    {
        phase: '8',
        branch: '`codex/cloud-memory-phase-8-cutover`',
        plan: '`docs/superpowers/plans/2026-07-28-cloud-memory-master-roadmap.md`',
    },
    {
        phase: '9',
        branch: '`codex/cloud-memory-phase-9-portability`',
        plan: '`docs/superpowers/plans/2026-07-28-cloud-memory-portability.md`',
    },
];
const requiredHeader = [
    'Phase',
    'Branch',
    'Executable plan',
    'Independently testable result',
];
const requiredPhaseEightStatements = [
    'retain complete local memory sources read-only throughout observation',
    'do not claim provider-independent disaster recovery',
    'do not retire heavy local stores',
    'do not move the primary database to another provider',
    'do not enable a second writer',
    'do not perform irreversible local cleanup',
    'hand the healthy staged deployment to Phase 9 for recovery certification',
];
const requiredPhaseNineGates = [
    'completed signed Phase 1–8 evidence passes revalidation, including the completed Phase 8 operator-and-friend observation report',
    'a current cloud snapshot restores into a fresh target, and retained phone/local sources independently rebuild/import into a separate fresh target',
    'deletion receipts replay after an older-backup resurrection attempt and deleted evidence remains absent',
    "exact source counts and hashes match each recovery path's signed source manifest, with owner isolation, writer fencing, and source parity intact",
    'a cloud-only turn survives staged provider-native rollback and current-cloud-snapshot fresh-target recovery',
    'zero cloud-only-turn, source-parity, or deletion loss is present',
];
const requiredPhaseOneSectionStatements = [
    {
        heading: '## 1. Fixed Phase Boundary',
        statements: [
            ['visible-response read authority remains LOCAL', /visible-response read authority remains LOCAL/i],
            ['source prose is upload-only', /source prose is upload-only/i],
            ['no server-to-client source-content download is added', /no server-to-client source-content download is added/i],
            ['Phase 9 last', /Phase 9 last/i],
        ],
    },
    {
        heading: '### 4.2 Stable identity',
        statements: [
            ['per-source/per-message revision cursors are the mirror sequencing authority', /mirror sequencing authority is the per-source\/per-message revision cursors/i],
            ['memory_source_watermarks is reused only for legacy client sequencing', /memory_source_watermarks.*reused only for legacy client sequencing/i],
            ['memory_source_watermarks is not the mirror sequencing authority', /memory_source_watermarks.*not the mirror sequencing authority/i],
            ['tombstones are keyed by owner plus stable source/message identity', /tombstones are keyed by owner plus stable source\/message identity/i],
            ['no cross-dataset logical equivalence is inferred from prose or model output', /no cross-dataset logical equivalence is inferred from prose or model output/i],
        ],
    },
    {
        heading: '### 5.1 Additive schema',
        statements: [
            ['named completion permits', /memory_import_completion_permits/i],
            ['additive Phase 1 schema only', /additive Phase 1 schema only/i],
            ['one active manifest per owner', /only one active[^.]*manifest per owner/i],
            ['current_source_manifest_id is last-applied-manifest audit metadata', /current_source_manifest_id[^.]*last-applied-manifest audit metadata/i],
            ['current_source_manifest_id must not define read membership', /current_source_manifest_id[^.]*must not define read membership/i],
            ['owner-current-source-set version/receipt/count/hash contract', /owner-current-source-set version\/receipt\/count\/hash contract/i],
            ['current eligible rows are authoritative', /current eligible rows are authoritative/i],
        ],
    },
    {
        heading: '### 5.3 Atomic chunk acceptance',
        statements: [
            ['source/message revision CAS under row locks', /source\/message revision CAS under row locks/i],
            ['stale shared-source snapshots cannot overwrite accepted revisions', /stale shared-source snapshot cannot overwrite accepted revisions/i],
            ['disjoint sources merge independently', /disjoint sources merge independently/i],
        ],
    },
    {
        heading: '### 5.5 Atomic completion and transition',
        statements: [
            ['manifest mutation/reconciliation generation', /manifest is an atomic, device-observed mutation\/reconciliation generation/i],
            ['manifest is not a replacement snapshot', /not a replacement snapshot of the owner's entire archive/i],
            ['cumulative owner union', /current owner view is the cumulative union/i],
            ['prior verified rows carry forward transactionally', /carr(?:y|ies) prior verified rows forward transactionally/i],
            ['manifest omission is a no-op', /manifest omission is always a no-op/i],
            ['only an explicit higher stable-ID tombstone removes eligibility', /only an explicit higher stable-ID tombstone removes eligibility/i],
            ['completion receipt is unique and idempotent per logical manifest completion', /completion receipt is unique and idempotent per logical manifest completion/i],
            ['successful completion advances the owner source-set version', /successful completion advances a monotonic owner source-set version/i],
            ['completion returns the resulting owner-union receipt', /returns the resulting owner-union receipt/i],
            ['different generations produce distinct receipts', /different generations produce distinct receipts/i],
        ],
    },
    {
        heading: '### 7.4 Two-device same-owner reconciliation',
        statements: [
            ['two independent devices for the same owner', /two independent devices for the same owner/i],
            ['shared stable IDs and disjoint offline additions', /shared stable IDs and create disjoint local additions while offline/i],
            ['device B completes without A-only prose', /device B can complete without possessing A-only prose/i],
            ['server carries A verified rows into the owner union', /server carries A's verified rows into the owner union/i],
            ['devices converge on B latest owner-union receipt/version', /devices converge on B's latest owner-union receipt\/version/i],
            ['every accepted A and B revision remains visible', /every accepted A and B revision remains visible/i],
            ['owner-scoped tombstones prevent cross-device resurrection', /tombstones are owner-scoped(?:: no cross-device resurrection|, not device-scoped)/i],
        ],
    },
];
const forbiddenPhaseOneSectionClauses = [
    {
        heading: '## 1. Fixed Phase Boundary',
        description: 'read authority remains LOCAL and upload-only source-content contract',
        patterns: [
            /server-to-client source-content download is (?:enabled|allowed|provided)/i,
            /Phase 1 (?:may|can|will)[^.]*read cloud[^.]*visible responses/i,
            /source prose is not upload-only/i,
            /visible-response read authority[^.]*(?:does|must|may) not remain LOCAL/i,
        ],
    },
    {
        heading: '### 5.1 Additive schema',
        description: 'one active manifest per owner contract',
        patterns: [
            /each device[^.]*own active manifest/i,
            /multiple active[^.]*manifests?[^.]*(?:allowed|permitted)/i,
            /(?:more than|not only) one active manifest/i,
            /current_source_manifest_id[^.]*defines? read membership/i,
        ],
    },
    {
        heading: '### 5.3 Atomic chunk acceptance',
        description: 'revision CAS contract',
        patterns: [
            /stale shared-source snapshot[^.]*(?:may|can)[^.]*overwrite/i,
            /last-write-wins/i,
            /revision CAS[^.]*(?:disabled|optional|does not apply)/i,
        ],
    },
    {
        heading: '### 5.5 Atomic completion and transition',
        description: 'cumulative owner union, manifest omission, and completion receipt contract',
        patterns: [
            /owner current view[^.]*(?:exactly|only)[^.]*(?:newest|latest|current|pointed) manifest/i,
            /completing device[^.]*(?:must|is required to)[^.]*(?:whole-owner|complete owner|full-source)[^.]*(?:inventory|source set)/i,
            /omission[^.]*(?:deletes?|removes?|excludes?|ineligible)/i,
            /one global completion receipt[^.]*all generations/i,
            /one global completion receipt forever/i,
            /current owner view is not the cumulative union/i,
            /manifest omission is not[^.]*no-op/i,
            /different generations[^.]*same receipt/i,
        ],
    },
    {
        heading: '### 7.4 Two-device same-owner reconciliation',
        description: 'owner-scoped tombstone contract',
        patterns: [
            /tombstones? are device-scoped/i,
            /tombstones? are not owner-scoped/i,
        ],
    },
];
const violations = [];

function readRepositoryFile(relativePath) {
    try {
        return fs.readFileSync(path.join(repositoryRoot, relativePath), 'utf8');
    } catch (error) {
        const detail = error instanceof Error ? error.message : String(error);
        violations.push(`Unable to read ${relativePath}: ${detail}`);
        return '';
    }
}

function stripNonSemanticMarkdown(markdown) {
    const withoutComments = markdown.replace(/<!--[\s\S]*?-->/g, '');
    const semanticLines = [];
    let fenceCharacter = null;
    let fenceLength = 0;

    for (const line of withoutComments.split(/\r?\n/)) {
        const fenceMatch = line.match(/^\s*(`{3,}|~{3,})/);
        if (fenceCharacter === null && fenceMatch) {
            fenceCharacter = fenceMatch[1][0];
            fenceLength = fenceMatch[1].length;
            continue;
        }
        if (
            fenceCharacter !== null &&
            new RegExp(`^\\s*${fenceCharacter}{${fenceLength},}`).test(line)
        ) {
            fenceCharacter = null;
            fenceLength = 0;
            continue;
        }
        if (fenceCharacter === null) {
            semanticLines.push(line);
        }
    }

    return semanticLines.join('\n');
}

function extractLevelTwoSection(markdown, heading) {
    const lines = markdown.split(/\r?\n/);
    const headingIndexes = lines
        .map((line, index) => (line.trim() === heading ? index : -1))
        .filter((index) => index !== -1);
    if (headingIndexes.length !== 1) {
        return { count: headingIndexes.length, markdown: '', start: -1 };
    }

    const start = headingIndexes[0];
    const followingHeading = lines.findIndex(
        (line, index) => index > start && /^##\s+/.test(line),
    );
    const end = followingHeading === -1 ? lines.length : followingHeading;
    return {
        count: 1,
        markdown: lines.slice(start, end).join('\n'),
        start,
    };
}

function extractMarkdownSection(markdown, heading) {
    const headingMarker = heading.match(/^(#{2,6})\s+/)?.[1];
    if (!headingMarker) {
        throw new Error(`Invalid semantic section heading: ${heading}`);
    }

    const lines = markdown.split(/\r?\n/);
    const headingIndexes = lines
        .map((line, index) => (line.trim() === heading ? index : -1))
        .filter((index) => index !== -1);
    if (headingIndexes.length !== 1) {
        return { count: headingIndexes.length, markdown: '' };
    }

    const start = headingIndexes[0];
    const followingHeading = lines.findIndex((line, index) => {
        if (index <= start) {
            return false;
        }
        const marker = line.trim().match(/^(#{1,6})\s+/)?.[1];
        return marker !== undefined && marker.length <= headingMarker.length;
    });
    const end = followingHeading === -1 ? lines.length : followingHeading;
    return { count: 1, markdown: lines.slice(start, end).join('\n') };
}

function countPhaseSections(markdown, phase) {
    const heading = new RegExp(`^##\\s+Phase\\s+${phase}\\b`, 'i');
    return markdown
        .split(/\r?\n/)
        .filter((line) => heading.test(line.trim())).length;
}

function parseTableRow(line) {
    const trimmed = line.trim();
    if (!trimmed.startsWith('|') || !trimmed.endsWith('|')) {
        return [];
    }
    return trimmed
        .slice(1, -1)
        .split('|')
        .map((cell) => cell.trim());
}

function isTableDivider(line, columnCount) {
    const cells = parseTableRow(line);
    return (
        cells.length === columnCount &&
        cells.every((cell) => /^:?-{3,}:?$/.test(cell))
    );
}

function extractMarkdownTables(markdown) {
    const lines = markdown.split(/\r?\n/);
    const tables = [];

    for (let index = 0; index < lines.length - 1; index += 1) {
        const header = parseTableRow(lines[index]);
        if (header.length === 0 || !isTableDivider(lines[index + 1], header.length)) {
            continue;
        }

        const rows = [];
        let rowIndex = index + 2;
        while (rowIndex < lines.length) {
            const row = parseTableRow(lines[rowIndex]);
            if (row.length === 0) {
                break;
            }
            rows.push(row);
            rowIndex += 1;
        }
        tables.push({ header, rows });
        index = rowIndex - 1;
    }

    return tables;
}

function normalizeWhitespace(value) {
    return value.replace(/\s+/g, ' ').trim();
}

function extractDeliverAndGate(section, phase) {
    const lines = section.split(/\r?\n/);
    const deliverIndexes = lines
        .map((line, index) => (line.trim() === 'Deliver:' ? index : -1))
        .filter((index) => index !== -1);
    const gateIndexes = lines
        .map((line, index) => (line.trim() === 'Gate:' ? index : -1))
        .filter((index) => index !== -1);

    if (
        deliverIndexes.length !== 1 ||
        gateIndexes.length !== 1 ||
        deliverIndexes[0] >= gateIndexes[0]
    ) {
        violations.push(
            `Phase ${phase} must contain one ordered Deliver: block and one Gate: block.`,
        );
        return '';
    }

    const followingBlock = lines.findIndex(
        (line, index) =>
            index > gateIndexes[0] &&
            /^[A-Z][A-Za-z0-9 /-]{0,60}:$/.test(line.trim()),
    );
    const gateEnd = followingBlock === -1 ? lines.length : followingBlock;

    return [
        ...lines.slice(deliverIndexes[0] + 1, gateIndexes[0]),
        ...lines.slice(gateIndexes[0] + 1, gateEnd),
    ].join('\n');
}

function splitOperativeClauses(markdown) {
    return markdown
        .split(
            /\r?\n|[.;](?=\s|$)|(?:,\s*|\s+)(?:but|however|yet|then)\b/i,
        )
        .map((clause) => clause.trim())
        .filter(Boolean);
}

function isDirectlyNegatedDestructiveAction(clause, actionMatch) {
    const action = actionMatch[0].toLowerCase();
    const actionIndex = actionMatch.index ?? 0;
    const prefix = clause.slice(0, actionIndex);
    if (
        /^(?:deleted|pruned|retired|discarded|erased|removed)$/.test(action) &&
        clause[actionIndex + actionMatch[0].length] === '-'
    ) {
        return true;
    }
    const safeModifier =
        '(?:be|perform|authorize|permit|ever|immediately|permanently|irreversibly|any|the|complete|irreversible|heavy|local|phone|device|memory|source|sources|store|stores)';
    const directVerbNegation = new RegExp(
        `\\b(?:(?:do|does|did|is|are|was|were|must|may|shall|will|can|could|should|would)\\s+not|cannot|can't|never)(?:\\s+${safeModifier}){0,6}\\s*$`,
        'i',
    );
    if (directVerbNegation.test(prefix)) {
        return true;
    }

    const nominalAction =
        /^(?:deletion|pruning|retirement|discarding|erasing|removing|removal|cleanup|clean up)$/;
    const directlyBoundNo = new RegExp(
        `\\bno(?:\\s+${safeModifier}){0,5}\\s*$`,
        'i',
    );
    if (nominalAction.test(action) && directlyBoundNo.test(prefix)) {
        return true;
    }

    const passiveAction = /^(?:deleted|pruned|retired|discarded|erased|removed)$/;
    const negatedLocalSubject = new RegExp(
        `\\bno(?:\\s+${safeModifier}){1,6}\\s+(?:is|are|was|were|may\\s+be|can\\s+be|will\\s+be|must\\s+be)\\s*$`,
        'i',
    );
    if (passiveAction.test(action) && negatedLocalSubject.test(prefix)) {
        return true;
    }

    const withoutAction =
        /^(?:deleting|deletion|pruning|retiring|retirement|discarding|erasing|removing|removal|cleanup|clean up)$/;
    const directlyBoundWithout = new RegExp(
        `\\bwithout(?:\\s+${safeModifier}){0,5}\\s*$`,
        'i',
    );
    if (withoutAction.test(action) && directlyBoundWithout.test(prefix)) {
        return true;
    }

    return new RegExp(
        `\\bonly\\s+Phase\\s+9(?:\\s+may)?(?:\\s+(?:authorize|perform))?(?:\\s+${safeModifier}){0,5}\\s*$`,
        'i',
    ).test(prefix);
}

function containsAffirmativeLocalDestruction(markdown) {
    const destructiveAction =
        /\b(?:delete|deletes|deleted|deleting|deletion|prune|prunes|pruned|pruning|retire|retires|retired|retiring|retirement|discard|discards|discarded|discarding|erase|erases|erased|erasing|remove|removes|removed|removing|cleanup|clean up)\b/gi;
    const localTarget =
        /\b(?:local|phone|device|heavy stores?|memory stores?|source evidence|sources?)\b/i;

    return splitOperativeClauses(markdown).some(
        (clause) =>
            localTarget.test(clause) &&
            [...clause.matchAll(destructiveAction)].some(
                (actionMatch) =>
                    !isDirectlyNegatedDestructiveAction(clause, actionMatch),
            ),
    );
}

function isDirectlyNegatedTransition(clause, actionIndex) {
    const prefix = clause.slice(0, actionIndex);
    return (
        /\b(?:(?:do|does|did|is|are|was|were|must|may|shall|will|can|could|should|would)\s+not|cannot|can't|never)(?:\s+(?:be|ever|automatically|directly|immediately|forcibly)){0,3}\s*$/i.test(
            prefix,
        ) ||
        /\bnot\s+to\s*$/i.test(prefix) ||
        /\bwithout(?:\s+(?:ever|automatically|directly|immediately|forcibly)){0,3}\s*$/i.test(
            prefix,
        )
    );
}

function containsForcedLocalAuthorityTransition(markdown) {
    const transitionAction =
        /\b(?:return|returns|returned|returning|revert|reverts|reverted|reverting|switch|switches|switched|switching|transition|transitions|transitioned|transitioning|move|moves|moved|moving|remain|remains|remained|remaining|become|becomes|became|set|sets|setting)\b/gi;
    const coerciveAction =
        /\b(?:require|requires|required|requiring|force|forces|forced|forcing|set|sets|setting|return|returns|returned|returning)\b/gi;

    return splitOperativeClauses(markdown).some((clause) =>
        [...clause.matchAll(/\bauthority\b/gi)].some((authorityMatch) => {
            const authorityIndex = authorityMatch.index ?? 0;
            const authorityEnd = authorityIndex + authorityMatch[0].length;
            const localMatch = /\bLOCAL\b/.exec(clause.slice(authorityEnd));
            if (localMatch === null) {
                return false;
            }

            const localIndex = authorityEnd + localMatch.index;
            const predicate = clause.slice(authorityEnd, localIndex);
            const affirmativePredicate = [...predicate.matchAll(transitionAction)].some(
                (actionMatch) =>
                    !isDirectlyNegatedTransition(
                        clause,
                        authorityEnd + (actionMatch.index ?? 0),
                    ),
            );
            if (affirmativePredicate) {
                return true;
            }
            if (
                /\b(?:must|shall|will)\s+(?!not\b)(?:be\s+)?$/i.test(predicate) ||
                /\b(?:is|are|becomes?)\s*$/i.test(predicate)
            ) {
                return true;
            }

            return [...clause.slice(0, authorityIndex).matchAll(coerciveAction)].some(
                (actionMatch) => {
                    const actionEnd =
                        (actionMatch.index ?? 0) + actionMatch[0].length;
                    const bridge = clause.slice(actionEnd, authorityIndex);
                    const bridgeWords = normalizeWhitespace(bridge)
                        .split(' ')
                        .filter(Boolean);
                    return (
                        bridgeWords.length <= 3 &&
                        !/[,:;]/.test(bridge) &&
                        !isDirectlyNegatedTransition(
                            clause,
                            actionMatch.index ?? 0,
                        )
                    );
                },
            );
        }),
    );
}

function parsePlanPath(cell) {
    const match = cell.match(/^`([^`]+)`$/);
    return match ? match[1] : null;
}

function isPathInsideRoot(absolutePath) {
    const relative = path.relative(repositoryRoot, absolutePath);
    return (
        relative !== '' &&
        relative !== '..' &&
        !relative.startsWith(`..${path.sep}`) &&
        !path.isAbsolute(relative)
    );
}

const roadmapRaw = readRepositoryFile(roadmapRelativePath);
const roadmap = stripNonSemanticMarkdown(roadmapRaw);
const deliveryModel = extractLevelTwoSection(roadmap, '## Delivery Model');
if (deliveryModel.count !== 1) {
    violations.push('Roadmap must contain exactly one level-two Delivery Model section.');
}

const deliveryTables = extractMarkdownTables(deliveryModel.markdown).filter(
    (table) => table.header[0]?.toLowerCase() === 'phase',
);
if (deliveryTables.length !== 1) {
    violations.push(
        `Delivery Model must contain exactly one structurally authoritative Phase table; found ${deliveryTables.length}.`,
    );
}
const phaseTable = deliveryTables[0] ?? { header: [], rows: [] };
if (
    phaseTable.header.length !== requiredHeader.length ||
    phaseTable.header.some((cell, index) => cell !== requiredHeader[index])
) {
    violations.push(
        'Delivery Model authoritative table must use Phase, Branch, Executable plan, and Independently testable result columns.',
    );
}

const discoveredPhases = phaseTable.rows.map((row) => row[0] ?? '');
const expectedPhases = expectedPhaseRows.map(({ phase }) => phase);
if (
    phaseTable.rows.some((row) => row.length !== requiredHeader.length) ||
    discoveredPhases.length !== expectedPhases.length ||
    discoveredPhases.some((phase, index) => phase !== expectedPhases[index])
) {
    violations.push(
        `Phase order must be exactly ${expectedPhases.join(', ')}; found ${
            discoveredPhases.join(', ') || 'no phase rows'
        }.`,
    );
}

for (const expected of expectedPhaseRows) {
    const row = phaseTable.rows.find((candidate) => candidate[0] === expected.phase);
    if (!row) {
        continue;
    }
    if (row[1] !== expected.branch) {
        violations.push(
            `Phase ${expected.phase} Branch mapping must be ${expected.branch}; found ${row[1] || 'blank'}.`,
        );
    }
    if (row[2] !== expected.plan) {
        violations.push(
            `Phase ${expected.phase} Plan mapping must be ${expected.plan}; found ${row[2] || 'blank'}.`,
        );
    }
    if (!row[3]?.trim()) {
        violations.push(`Phase ${expected.phase} Result cell must be nonempty.`);
    }

    const planPath = parsePlanPath(row[2] ?? '');
    if (planPath === null) {
        violations.push(`Phase ${expected.phase} Plan must be a linked repository path.`);
        continue;
    }
    const absolutePlanPath = path.resolve(repositoryRoot, planPath);
    if (!isPathInsideRoot(absolutePlanPath)) {
        violations.push(
            `Phase ${expected.phase} Plan must resolve under the supplied repository root.`,
        );
    } else if (!fs.existsSync(absolutePlanPath) || !fs.statSync(absolutePlanPath).isFile()) {
        violations.push(
            `Phase ${expected.phase} Plan does not exist under the supplied repository root: ${planPath}.`,
        );
    }

    if (
        planPath === roadmapRelativePath &&
        countPhaseSections(roadmap, expected.phase) !== 1
    ) {
        violations.push(
            `Phase ${expected.phase} roadmap Plan mapping requires exactly one level-two Phase ${expected.phase} section.`,
        );
    }
}

if (/\bPhase\s+0P\b|\|\s*0P\s*\|/i.test(roadmap)) {
    violations.push('Phase order must not contain the deprecated Phase 0P label.');
}

const phaseEightSection = extractLevelTwoSection(
    roadmap,
    '## Phase 8 — Staged CLOUD Authority and Observation',
);
const phaseNineSection = extractLevelTwoSection(
    roadmap,
    '## Phase 9 — Portability, Disaster Recovery, and Local Retirement',
);
if (phaseEightSection.count !== 1) {
    violations.push(
        'Roadmap must contain exactly one Phase 8 “Staged CLOUD Authority and Observation” section.',
    );
} else {
    const phaseEightBlocks = extractDeliverAndGate(
        phaseEightSection.markdown,
        '8',
    );
    const normalizedPhaseEight = normalizeWhitespace(phaseEightBlocks).toLowerCase();
    for (const statement of requiredPhaseEightStatements) {
        if (!normalizedPhaseEight.includes(statement.toLowerCase())) {
            violations.push(`Phase 8 must state: “${statement}.”`);
        }
    }
    if (containsAffirmativeLocalDestruction(phaseEightBlocks)) {
        violations.push(
            'Phase 8 contains additive destructive local-source language.',
        );
    }
}

if (phaseNineSection.count !== 1) {
    violations.push(
        'Roadmap must contain exactly one Phase 9 “Portability, Disaster Recovery, and Local Retirement” section.',
    );
} else {
    const phaseNineBlocks = extractDeliverAndGate(phaseNineSection.markdown, '9');
    const normalizedPhaseNine = normalizeWhitespace(phaseNineBlocks);
    if (
        !normalizedPhaseNine.includes(
            'Only Phase 9 may authorize retirement of heavy local memory stores.',
        )
    ) {
        violations.push(
            'Phase 9 must have exclusive authority to retire heavy local memory stores.',
        );
    }
    if (
        !normalizedPhaseNine.includes(
            'If any backup, restore, deletion-replay, alternate-provider, or laptop-recovery gate fails, Supabase may remain the active cloud service but full local sources stay retained.',
        )
    ) {
        violations.push(
            'Phase 9 failed gates must retain full local sources while Supabase may remain active.',
        );
    }
    if (
        !normalizedPhaseNine
            .toLowerCase()
            .includes(
                "a phase 9 failure blocks heavy local-store retirement and activation of any alternate provider or second writer; the healthy supabase service may remain active under the user's current valid authority.",
            )
    ) {
        violations.push(
            "Phase 9 failure handling must preserve the user's current valid authority while blocking retirement and alternate writers.",
        );
    }
    for (const statement of requiredPhaseNineGates) {
        if (!normalizedPhaseNine.toLowerCase().includes(statement.toLowerCase())) {
            violations.push(`Phase 9 retirement gate must state: “${statement}.”`);
        }
    }
    if (containsForcedLocalAuthorityTransition(phaseNineBlocks)) {
        violations.push('Phase 9 must reject any additive forced-LOCAL authority gate.');
    }
}

if (
    phaseEightSection.count === 1 &&
    phaseNineSection.count === 1 &&
    phaseEightSection.start > phaseNineSection.start
) {
    violations.push('Phase 9 must follow Phase 8.');
}

const phaseOnePlan = stripNonSemanticMarkdown(
    readRepositoryFile(phaseOnePlanRelativePath),
);
for (const contract of requiredPhaseOneSectionStatements) {
    const section = extractMarkdownSection(phaseOnePlan, contract.heading);
    if (section.count !== 1) {
        violations.push(
            `Phase 1 plan must contain exactly one semantic section ${contract.heading}.`,
        );
        continue;
    }
    const normalizedSection = normalizeWhitespace(section.markdown);
    for (const [description, pattern] of contract.statements) {
        if (!pattern.test(normalizedSection)) {
            violations.push(
                `Phase 1 ${contract.heading} must state the ${description} contract.`,
            );
        }
    }
}

for (const contract of forbiddenPhaseOneSectionClauses) {
    const section = extractMarkdownSection(phaseOnePlan, contract.heading);
    if (section.count !== 1) {
        continue;
    }
    const clauses = splitOperativeClauses(section.markdown).map(normalizeWhitespace);
    if (
        contract.patterns.some((pattern) =>
            clauses.some((clause) => pattern.test(clause)),
        )
    ) {
        violations.push(
            `Phase 1 ${contract.heading} contradicts the ${contract.description}.`,
        );
    }
}

for (const relativePath of activeGuidancePaths) {
    const guidance = stripNonSemanticMarkdown(readRepositoryFile(relativePath));
    if (!/\bPhase\s+9\b/i.test(guidance)) {
        violations.push(`${relativePath} must use Phase 9 guidance.`);
    }
    if (/\bPhase\s+0P\b|\|\s*0P\s*\|/i.test(guidance)) {
        violations.push(`${relativePath} must not contain Phase 0P guidance.`);
    }
}

if (violations.length > 0) {
    process.stderr.write(`${violations.join('\n')}\n`);
    process.exitCode = 1;
} else {
    process.stdout.write('Cloud memory roadmap contract is valid.\n');
}
