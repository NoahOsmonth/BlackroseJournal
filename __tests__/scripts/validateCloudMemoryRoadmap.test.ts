import fs from 'fs';
import os from 'os';
import path from 'path';
import { spawnSync, type SpawnSyncReturns } from 'child_process';

const repositoryRoot = path.resolve(__dirname, '..', '..');
const validatorPath = path.join(repositoryRoot, 'scripts', 'validate-cloud-memory-roadmap.mjs');

const validRoadmap = `# Cloud Memory Roadmap

| Phase | Delivery |
| --- | --- |
| 0 | Contracts |
| 1 | MIRROR ingestion |
| 2 | Truth |
| 3 | Curation |
| 4 | Retrieval |
| 5 | Orchestration |
| 6 | Judgment |
| 7 | Shadow evaluation |
| 8 | Staged CLOUD authority |
| 9 | Portability and disaster recovery |

## Phase 8 — Staged CLOUD Authority and Observation

- retain complete local memory sources read-only throughout observation;
- do not retire heavy local stores;

## Phase 9 — Portability, Disaster Recovery, and Local Retirement

Only Phase 9 may authorize retirement of heavy local memory stores.
`;

const activeGuidancePaths = [
    'AGENTS.md',
    'memory.md',
    'PLAN.md',
    'docs/superpowers/plans/2026-07-28-cloud-memory-phase-0-contract-safety.md',
    'docs/superpowers/plans/2026-07-28-cloud-memory-portability.md',
];

function writeFixture(root: string, roadmap: string): void {
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
}

function runValidator(root: string): SpawnSyncReturns<string> {
    return spawnSync(process.execPath, [validatorPath, root], {
        encoding: 'utf8',
    });
}

describe('validate-cloud-memory-roadmap', () => {
    let fixtureRoot: string;

    beforeEach(() => {
        fixtureRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'cloud-memory-roadmap-'));
    });

    afterEach(() => {
        fs.rmSync(fixtureRoot, { force: true, recursive: true });
    });

    it('accepts the hand-authored final phase order and retirement boundary', () => {
        writeFixture(fixtureRoot, validRoadmap);

        const result = runValidator(fixtureRoot);

        expect(result.status).toBe(0);
    });

    it('rejects deprecated or out-of-order phase rows and reports the ordering defect', () => {
        writeFixture(
            fixtureRoot,
            validRoadmap
                .replace('| 1 | MIRROR ingestion |', '| 0P | Portability |\n| 2 | Truth |')
                .replace('| 2 | Truth |\n| 3 | Curation |', '| 1 | MIRROR ingestion |\n| 3 | Curation |'),
        );

        const result = runValidator(fixtureRoot);

        expect(result.status).not.toBe(0);
        expect(result.stderr).toMatch(/phase order/i);
    });

    it('rejects Phase 8 retirement language and missing local-source retention', () => {
        writeFixture(
            fixtureRoot,
            validRoadmap.replace(
                '- retain complete local memory sources read-only throughout observation;\n- do not retire heavy local stores;',
                '- retire heavy local stores after staged cloud authority;',
            ),
        );

        const result = runValidator(fixtureRoot);

        expect(result.status).not.toBe(0);
    });

    it('rejects a roadmap without Phase 9 exclusive retirement authority', () => {
        writeFixture(
            fixtureRoot,
            validRoadmap.replace(
                'Only Phase 9 may authorize retirement of heavy local memory stores.',
                'Phase 9 documents portability and disaster recovery.',
            ),
        );

        const result = runValidator(fixtureRoot);

        expect(result.status).not.toBe(0);
    });

    it('accepts the active repository roadmap and guidance', () => {
        const result = runValidator(repositoryRoot);

        expect(result.status).toBe(0);
    });
});
