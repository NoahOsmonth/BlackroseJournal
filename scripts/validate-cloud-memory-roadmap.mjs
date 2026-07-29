import fs from 'node:fs';
import path from 'node:path';

const repositoryRoot = path.resolve(process.argv[2] ?? process.cwd());
const roadmapRelativePath =
    'docs/superpowers/plans/2026-07-28-cloud-memory-master-roadmap.md';
const activeGuidancePaths = [
    'AGENTS.md',
    'memory.md',
    'PLAN.md',
    'docs/superpowers/plans/2026-07-28-cloud-memory-phase-0-contract-safety.md',
    'docs/superpowers/plans/2026-07-28-cloud-memory-portability.md',
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

function parseTableRow(line) {
    if (!line.startsWith('|') || !line.endsWith('|')) {
        return [];
    }
    return line
        .slice(1, -1)
        .split('|')
        .map((cell) => cell.trim());
}

function extractPhaseTable(deliveryModel) {
    const lines = deliveryModel.split(/\r?\n/);
    const requiredHeader =
        '| Phase | Branch | Executable plan | Independently testable result |';
    const headerIndex = lines.findIndex((line) => line.trim() === requiredHeader);
    if (headerIndex === -1) {
        return { headerFound: false, rows: [] };
    }
    if (!/^\|\s*-+\s*\|\s*-+\s*\|\s*-+\s*\|\s*-+\s*\|$/.test(lines[headerIndex + 1])) {
        return { headerFound: true, rows: [] };
    }

    const rows = [];
    let index = headerIndex + 2;
    while (index < lines.length && lines[index].startsWith('|')) {
        rows.push(parseTableRow(lines[index]));
        index += 1;
    }

    return { headerFound: true, rows };
}

function normalizeWhitespace(value) {
    return value.replace(/\s+/g, ' ').trim();
}

const roadmap = readRepositoryFile(roadmapRelativePath);
const deliveryModel = extractLevelTwoSection(roadmap, '## Delivery Model');
if (deliveryModel.count !== 1) {
    violations.push('Roadmap must contain exactly one level-two Delivery Model section.');
}
const phaseTable = extractPhaseTable(deliveryModel.markdown);
if (!phaseTable.headerFound) {
    violations.push(
        'Delivery Model must use the authoritative Phase, Branch, Executable plan, and Independently testable result table.',
    );
}
const discoveredPhases = phaseTable.rows
    .map((row) => row[0])
    .filter((phase) => phase !== undefined);
const expectedPhases = Array.from({ length: 10 }, (_, index) => String(index));

if (
    phaseTable.rows.some((row) => row.length !== 4) ||
    discoveredPhases.length !== expectedPhases.length ||
    discoveredPhases.some((phase, index) => phase !== expectedPhases[index])
) {
    violations.push(
        `Phase order must be exactly ${expectedPhases.join(', ')}; found ${
            discoveredPhases.join(', ') || 'no phase rows'
        }.`,
    );
}

if (/\bPhase\s+0P\b|\|\s*0P\s*\|/i.test(roadmap)) {
    violations.push('Phase order must not contain the deprecated Phase 0P label.');
}

const phaseNineRow = phaseTable.rows.find((row) => row[0] === '9') ?? [];
if (phaseNineRow[1] !== '`codex/cloud-memory-phase-9-portability`') {
    violations.push(
        'Phase 9 must use branch `codex/cloud-memory-phase-9-portability`.',
    );
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
    const phaseEight = phaseEightSection.markdown;
    if (
        !/retain complete local memory sources read-only throughout observation/i.test(
            phaseEight,
        )
    ) {
        violations.push(
            'Phase 8 must retain complete local memory sources read-only throughout observation.',
        );
    }
    if (!/do not retire heavy local stores/i.test(phaseEight)) {
        violations.push('Phase 8 must forbid retirement of heavy local stores.');
    }
    if (!/do not claim provider-independent disaster recovery/i.test(phaseEight)) {
        violations.push(
            'Phase 8 must not claim provider-independent disaster recovery.',
        );
    }
    if (
        !/hand the healthy staged deployment to Phase 9 for recovery certification/i.test(
            phaseEight,
        )
    ) {
        violations.push(
            'Phase 8 must hand the healthy staged deployment to Phase 9 for recovery certification.',
        );
    }

    const prematureRetirement = phaseEight
        .split(/\r?\n/)
        .some(
            (line) =>
                /retir(?:e|ement|ing|ed).*(?:local|stores)|(?:local|stores).*retir(?:e|ement|ing|ed)/i.test(
                    line,
                ) && !/\bdo not retire heavy local stores\b/i.test(line),
        );
    if (prematureRetirement) {
        violations.push(
            'Phase 8 contains premature local-retirement authorization.',
        );
    }
}

if (phaseNineSection.count !== 1) {
    violations.push(
        'Roadmap must contain exactly one Phase 9 “Portability, Disaster Recovery, and Local Retirement” section.',
    );
} else {
    const phaseNine = normalizeWhitespace(phaseNineSection.markdown);
    if (
        !phaseNine.includes(
            'Only Phase 9 may authorize retirement of heavy local memory stores.',
        )
    ) {
        violations.push(
            'Phase 9 must have exclusive authority to retire heavy local memory stores.',
        );
    }
    if (
        !phaseNine.includes(
            'If any backup, restore, deletion-replay, alternate-provider, or laptop-recovery gate fails, Supabase may remain the active cloud service but full local sources stay retained.',
        )
    ) {
        violations.push(
            'Phase 9 failed gates must retain full local sources while Supabase may remain active.',
        );
    }
    if (
        !phaseNine
            .toLowerCase()
            .includes(
                "a phase 9 failure blocks heavy local-store retirement and activation of any alternate provider or second writer; the healthy supabase service may remain active under the user's current valid authority.",
            )
    ) {
        violations.push(
            "Phase 9 failure handling must preserve the user's current valid authority while blocking retirement and alternate writers.",
        );
    }
}

if (
    phaseEightSection.count === 1 &&
    phaseNineSection.count === 1 &&
    phaseEightSection.start > phaseNineSection.start
) {
    violations.push('Phase 9 must follow Phase 8.');
}

for (const relativePath of activeGuidancePaths) {
    const guidance = readRepositoryFile(relativePath);
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
