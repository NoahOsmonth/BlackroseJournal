import {
    MEMORY_AUTHORITY_STATES,
    MEMORY_JOB_STATUSES,
    MEMORY_JOB_TYPES,
    MEMORY_SOURCE_KINDS,
    parseMemoryFeatureFlags,
    type MemorySourceKind,
} from '../../shared/memory/contracts';
import {
    conversationSourceId,
    messageClientEventId,
    parseConversationSourceId,
    parseMessageClientEventId,
} from '../../shared/memory/sourceIds';

describe('cloud memory contracts', () => {
    it('pins authority, source, and durable job states', () => {
        expect(MEMORY_AUTHORITY_STATES).toEqual(['LOCAL', 'MIRROR', 'SHADOW', 'CLOUD']);
        expect(MEMORY_SOURCE_KINDS).toEqual([
            'journal',
            'freeform_chat',
            'intention_checkin',
        ]);
        expect(MEMORY_SOURCE_KINDS).not.toContain('journal_entry');
        expect(MEMORY_JOB_STATUSES).toEqual([
            'queued',
            'leased',
            'succeeded',
            'retryable',
            'dead_letter',
            'cancelled',
        ]);
        expect(MEMORY_JOB_TYPES).toEqual([
            'capture_source',
            'extract_turn_candidates',
            'checkpoint_conversation',
            'curate_session',
            'reconcile_entities',
            'reconcile_claims',
            'audit_epistemic_authorization',
            'audit_supersession_chains',
            'build_temporal_digest',
            'build_current_life_snapshot',
            'build_profile_tree',
            'build_search_document',
            'embed_search_document',
            'observe_interaction_outcome',
            'review_pattern_hypotheses',
            'scan_cross_domain_collisions',
            'rebuild_personalized_promotion_policy',
            'refresh_external_fact_snapshot',
            'cascade_source_invalidation',
            'verify_deletion',
            'compare_shadow_retrieval',
            'rebuild_projection_version',
        ]);
    });

    it('validates feature flags at runtime', () => {
        const flags = {
            cloudSourceMirroring: true,
            cloudProjectionBuild: false,
            shadowRetrieval: false,
            cloudReadAuthority: false,
            cloudWriteAuthority: false,
        };

        expect(parseMemoryFeatureFlags(flags)).toEqual(flags);
        expect(parseMemoryFeatureFlags({ ...flags, cloudWriteAuthority: 'yes' })).toBeNull();
        expect(parseMemoryFeatureFlags({ ...flags, unexpected: true })).toBeNull();
        expect(parseMemoryFeatureFlags({
            cloudSourceMirroring: true,
            cloudProjectionBuild: false,
            shadowRetrieval: false,
            cloudReadAuthority: false,
        })).toBeNull();
        expect(parseMemoryFeatureFlags(null)).toBeNull();
        expect(parseMemoryFeatureFlags([])).toBeNull();
    });

    it('round-trips reserved and Unicode ID segments', () => {
        const conversationId = conversationSourceId('journal', 'entry:\u96ea/1');
        const eventId = messageClientEventId(conversationId, 'message:%/2');

        expect(conversationId).toBe('journal:entry%3A%E9%9B%AA%2F1');
        expect(eventId).toBe('journal%3Aentry%253A%25E9%259B%25AA%252F1:message%3A%25%2F2');
        expect(parseConversationSourceId(conversationId)).toEqual({
            kind: 'journal',
            recordId: 'entry:\u96ea/1',
        });
        expect(parseMessageClientEventId(eventId)).toEqual({
            conversationId,
            messageId: 'message:%/2',
        });
    });

    it('rejects invalid runtime kinds and empty generated segments', () => {
        expect(() => conversationSourceId(
            'journal_entry' as unknown as MemorySourceKind,
            'entry',
        )).toThrow('kind');
        expect(() => conversationSourceId('journal', '')).toThrow('recordId');
        expect(() => messageClientEventId('', 'message')).toThrow('conversationId');
        expect(() => messageClientEventId('journal:entry', '')).toThrow('messageId');
        expect(() => messageClientEventId('journal_entry:entry', 'message')).toThrow(
            'conversationId',
        );
    });

    it.each([
        '',
        'journal:',
        'journal_entry:entry',
        'JOURNAL:entry',
        'journal:entry%',
        'journal:%65ntry',
        'journal:entry%3a1',
        'journal:entry:1',
    ])('rejects malformed or noncanonical conversation source ID %j', (value) => {
        expect(parseConversationSourceId(value)).toBeNull();
    });

    it.each([
        '',
        ':message',
        'journal%3Aentry:',
        'journal%3Aentry:message%',
        'journal%3aentry:message',
        'journal_entry%3Aentry:message',
        'journal%3A%2565ntry:message',
        'journal%3Aentry:%6dessage',
    ])('rejects malformed or noncanonical message event ID %j', (value) => {
        expect(parseMessageClientEventId(value)).toBeNull();
    });
});
