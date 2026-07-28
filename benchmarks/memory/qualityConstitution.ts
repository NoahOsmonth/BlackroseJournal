export const MEMORY_QUALITY_CONSTITUTION_VERSION = 1 as const;

export const MEMORY_PIPELINE_STAGES = [
    'extraction',
    'update_invalidation',
    'target_planning',
    'candidate_retrieval',
    'fusion_reranking',
    'coverage_verification',
    'utilization_mention',
    'final_response',
] as const;

export const MEMORY_ZERO_TOLERANCE_GATES = [
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
] as const;

export type GateComparator = 'gte' | 'lt';

export interface MeasuredGate {
    comparator: GateComparator;
    threshold: number;
}

export const MEMORY_MEASURED_GATES = {
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
} as const satisfies Record<string, MeasuredGate>;
