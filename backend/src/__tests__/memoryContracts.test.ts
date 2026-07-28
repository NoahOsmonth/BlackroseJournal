import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  MEMORY_CONTRACT_VERSION,
  MEMORY_JOB_TYPES,
  MEMORY_SOURCE_KINDS,
  type CanonicalMessageSource,
} from '../../../shared/memory/contracts';

describe('shared memory contract parity', () => {
  it('supports canonical roles, lifecycle, and unknown historical time', () => {
    const source: CanonicalMessageSource = {
      id: 'message-id',
      conversationId: 'journal:entry',
      clientEventId: 'journal%3Aentry:message-id',
      role: 'tool',
      sequence: 0,
      authoredAt: '2026-07-28T00:00:00.000Z',
      authoredTimezone: null,
      localDate: null,
      temporalProvenance: 'legacy_unknown',
      content: 'opaque source',
      revision: 2,
      status: 'edited',
    };

    assert.equal(MEMORY_CONTRACT_VERSION, 1);
    assert.equal(source.temporalProvenance, 'legacy_unknown');
    assert.deepEqual(MEMORY_SOURCE_KINDS, [
      'journal',
      'freeform_chat',
      'intention_checkin',
    ]);
    assert.equal(MEMORY_SOURCE_KINDS.includes('journal_entry' as 'journal'), false);
    assert.deepEqual(MEMORY_JOB_TYPES, [
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
});
