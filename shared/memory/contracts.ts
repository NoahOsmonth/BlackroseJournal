export const MEMORY_CONTRACT_VERSION = 1 as const;

export const MEMORY_AUTHORITY_STATES = ['LOCAL', 'MIRROR', 'SHADOW', 'CLOUD'] as const;
export type MemoryAuthorityState = typeof MEMORY_AUTHORITY_STATES[number];

export const DEPLOYMENT_MODES = ['active', 'maintenance', 'read_only', 'retired'] as const;
export type DeploymentMode = typeof DEPLOYMENT_MODES[number];

export interface DeploymentAuthority {
  deploymentId: string;
  writerEpoch: number;
  mode: DeploymentMode;
  backendBaseUrl: string | null;
  databaseFingerprint: string;
  writerLeaseId: string | null;
  writerLeaseExpiresAt: string | null;
  writerLeaseIssuer: string | null;
  writerLeaseKeyId: string | null;
  sourceCredentialFingerprint: string | null;
}

export const MEMORY_SOURCE_KINDS = ['journal', 'freeform_chat', 'intention_checkin'] as const;
export type MemorySourceKind = typeof MEMORY_SOURCE_KINDS[number];
export type TemporalProvenance = 'captured' | 'legacy_unknown';

export const MEMORY_JOB_STATUSES = [
  'queued',
  'leased',
  'succeeded',
  'retryable',
  'dead_letter',
  'cancelled',
] as const;
export type MemoryJobStatus = typeof MEMORY_JOB_STATUSES[number];

export const MEMORY_JOB_TYPES = [
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
] as const;
export type MemoryJobType = typeof MEMORY_JOB_TYPES[number];

export interface MemoryFeatureFlags {
  cloudSourceMirroring: boolean;
  cloudProjectionBuild: boolean;
  shadowRetrieval: boolean;
  cloudReadAuthority: boolean;
  cloudWriteAuthority: boolean;
}

const FEATURE_KEYS = [
  'cloudSourceMirroring',
  'cloudProjectionBuild',
  'shadowRetrieval',
  'cloudReadAuthority',
  'cloudWriteAuthority',
] as const;

export function parseMemoryFeatureFlags(value: unknown): MemoryFeatureFlags | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  if (Object.keys(record).length !== FEATURE_KEYS.length) return null;
  if (!FEATURE_KEYS.every((key) => typeof record[key] === 'boolean')) return null;
  return {
    cloudSourceMirroring: record.cloudSourceMirroring as boolean,
    cloudProjectionBuild: record.cloudProjectionBuild as boolean,
    shadowRetrieval: record.shadowRetrieval as boolean,
    cloudReadAuthority: record.cloudReadAuthority as boolean,
    cloudWriteAuthority: record.cloudWriteAuthority as boolean,
  };
}

export interface CanonicalConversationSource {
  id: string;
  sourceKind: MemorySourceKind;
  sourceRecordId: string;
  status: 'draft' | 'active' | 'settled' | 'deleted';
  startedAt: string;
  settledAt: string | null;
  timezone: string | null;
  weekStartsOn: 0 | 1 | null;
  temporalProvenance: TemporalProvenance;
  clientSchemaVersion: 1;
  /** Current positive source revision. Legacy records begin at one. */
  sourceRevision: number;
}

export interface CanonicalMessageSource {
  id: string;
  conversationId: string;
  clientEventId: string;
  role: 'user' | 'assistant' | 'system' | 'tool';
  sequence: number;
  authoredAt: string;
  authoredTimezone: string | null;
  localDate: string | null;
  temporalProvenance: TemporalProvenance;
  content: string;
  revision: number;
  status: 'active' | 'edited' | 'deleted';
}

export interface MemorySourceInventory {
  contractVersion: typeof MEMORY_CONTRACT_VERSION;
  generatedAt: string;
  conversationCount: number;
  messageCount: number;
  oldestAuthoredAt: string | null;
  newestAuthoredAt: string | null;
  conversations: CanonicalConversationSource[];
  messages: CanonicalMessageSource[];
}

export function isMemoryAuthorityState(value: unknown): value is MemoryAuthorityState {
  return typeof value === 'string'
    && (MEMORY_AUTHORITY_STATES as readonly string[]).includes(value);
}
