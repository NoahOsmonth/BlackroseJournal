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
} from '../../test-fixtures/cloudMemoryRoadmapFixtures';
import {
    approvedPlusForcedLocalPhaseNineRoadmap,
    blankResultRoadmap,
    branchlessPrimaryWithValidDecoyRoadmap,
    conditionalForcedLocalPhaseNineRoadmap,
    destructiveNoReviewPhaseEightRoadmap,
    destructiveWithoutDelayPhaseEightRoadmap,
    duplicateAuthoritativeTableRoadmap,
    missingCloudOnlyTurnRoadmap,
    missingDeletionReplayRoadmap,
    missingDualRecoveryRoadmap,
    missingMappedPhaseSectionRoadmap,
    missingPriorPhaseEvidenceRoadmap,
    missingSourceParityRoadmap,
    missingZeroLossRoadmap,
    negatedForcedLocalProhibitionRoadmap,
    nonSemanticDestructionExampleRoadmap,
    safePlusDestructivePhaseEightRoadmap,
    safetyOnlyInNonSemanticExampleRoadmap,
    safetyOnlyInLaterNotesRoadmap,
    wrongNonPhaseNineBranchRoadmap,
    wrongPlanLinkRoadmap,
} from '../../test-fixtures/cloudMemoryRoadmapAdversarialFixtures';

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

    it.each([
        ['the hand-authored final phase order and retirement boundary', validRoadmap],
        ['a directly negated forced-LOCAL prohibition', negatedForcedLocalProhibitionRoadmap],
    ])('accepts %s', (_description, roadmap) => {
        writeFixture(fixtureRoot, roadmap);
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

    it.each([
        ['a branchless primary table followed by a valid-looking decoy', branchlessPrimaryWithValidDecoyRoadmap],
        ['duplicate authoritative delivery tables', duplicateAuthoritativeTableRoadmap],
    ])('rejects %s', (_description, roadmap) => {
        writeFixture(fixtureRoot, roadmap);

        const result = runValidator(fixtureRoot);

        expect(result.status).not.toBe(0);
        expect(result.stderr).toMatch(/authoritative.*table|delivery.*table/i);
    });

    it('rejects a blank Result cell', () => {
        writeFixture(fixtureRoot, blankResultRoadmap);

        const result = runValidator(fixtureRoot);

        expect(result.status).not.toBe(0);
        expect(result.stderr).toMatch(/result/i);
    });

    it.each([
        ['a wrong non-Phase-9 branch', wrongNonPhaseNineBranchRoadmap],
        ['a wrong plan link', wrongPlanLinkRoadmap],
    ])('rejects %s mapping', (_description, roadmap) => {
        writeFixture(fixtureRoot, roadmap);

        const result = runValidator(fixtureRoot);

        expect(result.status).not.toBe(0);
        expect(result.stderr).toMatch(/mapping|branch|plan/i);
    });

    it('rejects a mapped plan that is missing from the supplied repository root', () => {
        writeFixture(fixtureRoot, validRoadmap);
        fs.rmSync(
            path.join(
                fixtureRoot,
                'docs/superpowers/plans/2026-07-28-cloud-memory-phase-0-contract-safety.md',
            ),
        );

        const result = runValidator(fixtureRoot);

        expect(result.status).not.toBe(0);
        expect(result.stderr).toMatch(/phase 0.*plan|plan.*phase 0/i);
    });

    it('rejects a roadmap-mapped row without its unique level-two phase section', () => {
        writeFixture(fixtureRoot, missingMappedPhaseSectionRoadmap);

        const result = runValidator(fixtureRoot);

        expect(result.status).not.toBe(0);
        expect(result.stderr).toMatch(/phase 4.*section|section.*phase 4/i);
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

    it('rejects additive Phase 8 local-source destruction beside safe text', () => {
        writeFixture(fixtureRoot, safePlusDestructivePhaseEightRoadmap);

        const result = runValidator(fixtureRoot);

        expect(result.status).not.toBe(0);
        expect(result.stderr).toMatch(/phase 8.*destruct|phase 8.*local/i);
    });

    it.each([
        ['delete complete local sources with no additional review', destructiveNoReviewPhaseEightRoadmap],
        ['remove local sources without delay', destructiveWithoutDelayPhaseEightRoadmap],
    ])('rejects the exact Phase 8 bypass: %s', (_sentence, roadmap) => {
        writeFixture(fixtureRoot, roadmap);

        const result = runValidator(fixtureRoot);

        expect(result.status).not.toBe(0);
    });

    it('ignores destructive examples and HTML comments during safety validation', () => {
        writeFixture(fixtureRoot, nonSemanticDestructionExampleRoadmap);

        const result = runValidator(fixtureRoot);

        expect(result.status).toBe(0);
    });

    it('does not accept Phase 8 safety statements found only in fenced examples', () => {
        writeFixture(fixtureRoot, safetyOnlyInNonSemanticExampleRoadmap);

        const result = runValidator(fixtureRoot);

        expect(result.status).not.toBe(0);
        expect(result.stderr).toMatch(/phase 8/i);
    });

    it('does not accept Phase 8 safety statements from a later Notes block', () => {
        writeFixture(fixtureRoot, safetyOnlyInLaterNotesRoadmap);

        const result = runValidator(fixtureRoot);

        expect(result.status).not.toBe(0);
        expect(result.stderr).toMatch(/phase 8/i);
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

    it('rejects an additive forced-LOCAL gate beside the approved Phase 9 fallback', () => {
        writeFixture(fixtureRoot, approvedPlusForcedLocalPhaseNineRoadmap);

        const result = runValidator(fixtureRoot);

        expect(result.status).not.toBe(0);
        expect(result.stderr).toMatch(/forced.*local|authority.*local/i);
    });

    it('rejects a conditional forced-LOCAL transition beside the approved fallback', () => {
        writeFixture(fixtureRoot, conditionalForcedLocalPhaseNineRoadmap);

        const result = runValidator(fixtureRoot);

        expect(result.status).not.toBe(0);
    });

    it.each([
        ['signed prior-phase and observation evidence', missingPriorPhaseEvidenceRoadmap],
        ['independent cloud-snapshot and retained-local recovery', missingDualRecoveryRoadmap],
        ['old-backup deletion replay', missingDeletionReplayRoadmap],
        ['exact source count/hash parity and writer/owner checks', missingSourceParityRoadmap],
        ['cloud-only-turn preservation', missingCloudOnlyTurnRoadmap],
        ['zero cloud-turn, source-parity, and deletion loss', missingZeroLossRoadmap],
    ])('rejects Phase 9 without %s', (_description, roadmap) => {
        writeFixture(fixtureRoot, roadmap);

        const result = runValidator(fixtureRoot);

        expect(result.status).not.toBe(0);
        expect(result.stderr).toMatch(/phase 9.*gate|retirement.*gate/i);
    });

    it('accepts the active repository roadmap and guidance', () => {
        const result = runValidator(repositoryRoot);

        expect(result.status).toBe(0);
    });
});
