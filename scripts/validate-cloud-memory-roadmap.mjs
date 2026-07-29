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

function extractSection(markdown, heading) {
    const start = markdown.indexOf(heading);
    if (start === -1) {
        return '';
    }

    const followingHeading = markdown.indexOf('\n## ', start + heading.length);
    return followingHeading === -1
        ? markdown.slice(start)
        : markdown.slice(start, followingHeading);
}

function extractPhaseTable(markdown) {
    const lines = markdown.split(/\r?\n/);
    const headerIndex = lines.findIndex((line) => /^\|\s*Phase\s*\|/i.test(line));
    if (headerIndex === -1) {
        return { header: '', rows: [] };
    }

    const rows = [];
    let index = headerIndex + 2;
    while (index < lines.length && /^\|/.test(lines[index])) {
        rows.push(lines[index]);
        index += 1;
    }

    return { header: lines[headerIndex], rows };
}

const roadmap = readRepositoryFile(roadmapRelativePath);
const phaseTable = extractPhaseTable(roadmap);
const discoveredPhases = phaseTable.rows
    .map((row) => row.match(/^\|\s*([^|]+?)\s*\|/)?.[1]?.trim())
    .filter((phase) => phase !== undefined);
const expectedPhases = Array.from({ length: 10 }, (_, index) => String(index));

if (
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

const phaseNineRow =
    phaseTable.rows.find((row) => /^\|\s*9\s*\|/.test(row)) ?? '';
if (!/portability/i.test(phaseNineRow)) {
    violations.push('Phase 9 must be the portability branch.');
}
if (
    /\|\s*Branch\s*\|/i.test(phaseTable.header) &&
    !phaseNineRow.includes('`codex/cloud-memory-phase-9-portability`')
) {
    violations.push(
        'Phase 9 must use branch `codex/cloud-memory-phase-9-portability`.',
    );
}

const phaseEight = extractSection(
    roadmap,
    '## Phase 8 — Staged CLOUD Authority and Observation',
);
if (!phaseEight) {
    violations.push(
        'Phase 8 must be titled “Staged CLOUD Authority and Observation”.',
    );
} else {
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

const phaseNine = extractSection(
    roadmap,
    '## Phase 9 — Portability, Disaster Recovery, and Local Retirement',
);
if (!phaseNine) {
    violations.push(
        'Phase 9 must be titled “Portability, Disaster Recovery, and Local Retirement”.',
    );
} else if (
    !/Only Phase 9 may authorize retirement of heavy local memory stores\./i.test(
        phaseNine,
    )
) {
    violations.push(
        'Phase 9 must have exclusive authority to retire heavy local memory stores.',
    );
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
