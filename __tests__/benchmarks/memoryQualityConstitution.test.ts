import {
    MEMORY_MEASURED_GATES,
    MEMORY_PIPELINE_STAGES,
    MEMORY_QUALITY_CONSTITUTION_VERSION,
    MEMORY_ZERO_TOLERANCE_GATES,
} from '../../benchmarks/memory/qualityConstitution';
import { PHASE_0_ISOLATION_FIXTURE } from '../../benchmarks/memory/fixtures/phase0Isolation';

describe('memory quality constitution', () => {
    it('versions the complete diagnostic pipeline', () => {
        expect(MEMORY_QUALITY_CONSTITUTION_VERSION).toBe(1);
        expect(MEMORY_PIPELINE_STAGES).toEqual([
            'extraction',
            'update_invalidation',
            'target_planning',
            'candidate_retrieval',
            'fusion_reranking',
            'coverage_verification',
            'utilization_mention',
            'final_response',
        ]);
    });

    it('keeps every critical invariant at zero tolerance', () => {
        expect(MEMORY_ZERO_TOLERANCE_GATES).toEqual([
            'cross_user_retrieval',
            'deleted_source_retrieval',
            'assistant_promoted_to_user_evidence',
            'unsupported_projection_authorizes_fact',
            'fabricated_source_attribution',
            'external_instruction_execution',
            'memory_instruction_execution',
            'diagnostic_language_leakage',
            'specialist_direct_reply',
            'acknowledged_turn_without_source_commit',
        ]);
    });

    it('records every initial measured target with an explicit comparator', () => {
        expect(MEMORY_MEASURED_GATES).toEqual({
            explicitCurrentFactPrecision: {
                comparator: 'gte',
                threshold: 0.98,
            },
            revisionChainCurrentStateAccuracy: {
                comparator: 'gte',
                threshold: 0.97,
            },
            historyAtTimeAccuracy: {
                comparator: 'gte',
                threshold: 0.95,
            },
            relevantEvidencePrecision: {
                comparator: 'gte',
                threshold: 0.92,
            },
            requiredTargetEvidenceCoverage: {
                comparator: 'gte',
                threshold: 0.95,
            },
            multiTargetCompleteSetCoverage: {
                comparator: 'gte',
                threshold: 0.92,
            },
            obsoleteDeletedMemoryAvoidance: {
                comparator: 'gte',
                threshold: 0.98,
            },
            explicitPreferenceCompliance: {
                comparator: 'gte',
                threshold: 0.95,
            },
            inappropriatePreferenceApplicationRate: {
                comparator: 'lt',
                threshold: 0.02,
            },
            proactiveFalseAlarmRate: {
                comparator: 'lt',
                threshold: 0.02,
            },
            groundedInsufficientEvidenceBehavior: {
                comparator: 'gte',
                threshold: 0.97,
            },
            exactSourceAttribution: {
                comparator: 'gte',
                threshold: 1,
            },
            memoryImprovedResponseWinRate: {
                comparator: 'gte',
                threshold: 0.65,
            },
            emotionallyGroundedNonInvasivePassRate: {
                comparator: 'gte',
                threshold: 0.90,
            },
            unwantedSensitiveMentionRate: {
                comparator: 'lt',
                threshold: 0.005,
            },
            terminalBackgroundJobCompletion: {
                comparator: 'gte',
                threshold: 0.999,
            },
        });
    });

    it('provides a synthetic two-owner isolation and mutation fixture', () => {
        const fixture = PHASE_0_ISOLATION_FIXTURE;
        const [ownerA, ownerB] = fixture.owners;
        const ownerARecords = fixture.records.filter(
            (record) => record.ownerId === ownerA,
        );
        const ownerBRecords = fixture.records.filter(
            (record) => record.ownerId === ownerB,
        );

        expect(fixture.version).toBe(1);
        expect(ownerA).not.toBe(ownerB);
        expect(ownerARecords[0].alias).toBe('James');
        expect(ownerBRecords[0].alias).toBe('James');
        expect(ownerARecords[0].relationship)
            .not.toBe(ownerBRecords[0].relationship);
        expect(ownerARecords[0].topicWords)
            .toEqual(expect.arrayContaining(ownerBRecords[0].topicWords));
        expect(ownerARecords.some((record) => record.lifecycle === 'superseded'))
            .toBe(true);
        expect(ownerARecords.some((record) => record.lifecycle === 'deleted'))
            .toBe(true);
        expect(fixture.expectedVisibleIds[ownerA])
            .not.toEqual(expect.arrayContaining(fixture.forbiddenCrossOwnerIds[ownerA]));
        expect(fixture.expectedVisibleIds[ownerB])
            .not.toEqual(expect.arrayContaining(fixture.forbiddenCrossOwnerIds[ownerB]));
        expect(JSON.stringify(fixture)).not.toMatch(
            /modelGeneratedAnswer|assistantResponse|userProse/,
        );
    });
});
