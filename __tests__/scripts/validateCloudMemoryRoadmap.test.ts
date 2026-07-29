import { spawnSync, type SpawnSyncReturns } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';

import {
    branchlessRoadmap,
    deprecatedPhaseRoadmap,
    missingDisasterRecoveryBoundaryRoadmap,
    missingExclusiveRetirementRoadmap,
    missingFailedGateRetentionRoadmap,
    missingPhaseNineHandoffRoadmap,
    missingRetentionRoadmap,
    obsoleteLocalAuthorityGateRoadmap,
    outOfOrderRoadmap,
    prematureRetirementRoadmap,
    validRoadmap,
    writeFixture,
    wrongPhaseNineBranchRoadmap,
} from './fixtures/cloudMemoryRoadmapFixtures';

const repositoryRoot = path.resolve(__dirname, '..', '..');
const validatorPath = path.join(repositoryRoot, 'scripts', 'validate-cloud-memory-roadmap.mjs');

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

    it('rejects a deprecated 0P phase row and reports the ordering defect', () => {
        writeFixture(fixtureRoot, deprecatedPhaseRoadmap);

        const result = runValidator(fixtureRoot);

        expect(result.status).not.toBe(0);
        expect(result.stderr).toMatch(/phase order/i);
    });

    it('rejects an otherwise-valid roadmap with out-of-order phase rows', () => {
        writeFixture(fixtureRoot, outOfOrderRoadmap);

        const result = runValidator(fixtureRoot);

        expect(result.status).not.toBe(0);
        expect(result.stderr).toMatch(/phase order/i);
    });

    it.each([
        ['a branchless delivery table', branchlessRoadmap],
        ['the wrong Phase 9 portability branch', wrongPhaseNineBranchRoadmap],
    ])('rejects %s', (_description, roadmap) => {
        writeFixture(fixtureRoot, roadmap);

        const result = runValidator(fixtureRoot);

        expect(result.status).not.toBe(0);
        expect(result.stderr).toMatch(/phase 9.*branch|delivery model/i);
    });

    it('rejects Phase 8 premature local-store retirement language', () => {
        writeFixture(fixtureRoot, prematureRetirementRoadmap);

        const result = runValidator(fixtureRoot);

        expect(result.status).not.toBe(0);
    });

    it('rejects Phase 8 without complete local-source retention', () => {
        writeFixture(fixtureRoot, missingRetentionRoadmap);

        const result = runValidator(fixtureRoot);

        expect(result.status).not.toBe(0);
    });

    it.each([
        ['provider-independent disaster-recovery prohibition', missingDisasterRecoveryBoundaryRoadmap],
        ['handoff to Phase 9 recovery certification', missingPhaseNineHandoffRoadmap],
    ])('rejects Phase 8 without the %s', (_description, roadmap) => {
        writeFixture(fixtureRoot, roadmap);

        const result = runValidator(fixtureRoot);

        expect(result.status).not.toBe(0);
        expect(result.stderr).toMatch(/phase 8/i);
    });

    it('rejects a roadmap without Phase 9 exclusive retirement authority', () => {
        writeFixture(fixtureRoot, missingExclusiveRetirementRoadmap);

        const result = runValidator(fixtureRoot);

        expect(result.status).not.toBe(0);
    });

    it('rejects Phase 9 without failed-gate local-source retention', () => {
        writeFixture(fixtureRoot, missingFailedGateRetentionRoadmap);

        const result = runValidator(fixtureRoot);

        expect(result.status).not.toBe(0);
        expect(result.stderr).toMatch(/phase 9.*failed|failed.*gate/i);
    });

    it('rejects the obsolete Phase 9 LOCAL-authority gate', () => {
        writeFixture(fixtureRoot, obsoleteLocalAuthorityGateRoadmap);

        const result = runValidator(fixtureRoot);

        expect(result.status).not.toBe(0);
        expect(result.stderr).toMatch(/current valid authority/i);
    });

    it('accepts the active repository roadmap and guidance', () => {
        const result = runValidator(repositoryRoot);

        expect(result.status).toBe(0);
    });
});
