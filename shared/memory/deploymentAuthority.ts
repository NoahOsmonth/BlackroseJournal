import type { DeploymentAuthority } from './contracts';

export interface DeploymentWriteRequest {
  deploymentId: string;
  writerEpoch: number;
  writerLeaseId: string;
  writerLeaseToken: string;
  sourceCredentialFingerprint: string;
  now?: Date;
}

export type DeploymentWriteDecision =
  | { accepted: true }
  | {
      accepted: false;
      reason:
        | 'authority_unavailable'
        | 'not_active'
        | 'deployment_id_invalid'
        | 'deployment_mismatch'
        | 'writer_epoch_invalid'
        | 'stale_epoch'
        | 'lease_id_invalid'
        | 'lease_mismatch'
        | 'lease_issuer_invalid'
        | 'lease_key_id_invalid'
        | 'lease_expiry_invalid'
        | 'lease_expired'
        | 'lease_token_missing'
        | 'database_fingerprint_invalid'
        | 'source_credential_fingerprint_invalid'
        | 'source_credential_mismatch'
        | 'request_time_invalid';
    };

const IDENTIFIER_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const FINGERPRINT_PATTERN = /^sha256:[A-Za-z0-9][A-Za-z0-9._-]*$/;

function isIdentifier(value: unknown): value is string {
  return typeof value === 'string' && IDENTIFIER_PATTERN.test(value);
}

function isWriterEpoch(value: unknown): value is number {
  return typeof value === 'number'
    && Number.isSafeInteger(value)
    && value >= 1;
}

function isLeaseId(value: unknown): value is string {
  return typeof value === 'string' && UUID_PATTERN.test(value);
}

function isFingerprint(value: unknown): value is string {
  return typeof value === 'string' && FINGERPRINT_PATTERN.test(value);
}

function isCanonicalTimestamp(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) && new Date(timestamp).toISOString() === value;
}

/**
 * Performs structural deployment-write preflight only.
 *
 * This helper never authenticates or verifies the opaque writer lease token.
 * Task 3 SQL authority remains authoritative for token authentication and write
 * authorization.
 */
export function evaluateDeploymentWrite(
  authority: DeploymentAuthority | null,
  request: DeploymentWriteRequest,
): DeploymentWriteDecision {
  if (!authority) return { accepted: false, reason: 'authority_unavailable' };

  if (!isIdentifier(authority.deploymentId) || !isIdentifier(request.deploymentId)) {
    return { accepted: false, reason: 'deployment_id_invalid' };
  }
  if (!isWriterEpoch(authority.writerEpoch) || !isWriterEpoch(request.writerEpoch)) {
    return { accepted: false, reason: 'writer_epoch_invalid' };
  }
  if (!isLeaseId(authority.writerLeaseId) || !isLeaseId(request.writerLeaseId)) {
    return { accepted: false, reason: 'lease_id_invalid' };
  }
  if (!isIdentifier(authority.writerLeaseIssuer)) {
    return { accepted: false, reason: 'lease_issuer_invalid' };
  }
  if (!isIdentifier(authority.writerLeaseKeyId)) {
    return { accepted: false, reason: 'lease_key_id_invalid' };
  }
  if (!isFingerprint(authority.databaseFingerprint)) {
    return { accepted: false, reason: 'database_fingerprint_invalid' };
  }
  if (
    !isFingerprint(authority.sourceCredentialFingerprint)
    || !isFingerprint(request.sourceCredentialFingerprint)
  ) {
    return { accepted: false, reason: 'source_credential_fingerprint_invalid' };
  }
  if (
    typeof request.writerLeaseToken !== 'string'
    || request.writerLeaseToken.trim().length === 0
  ) {
    return { accepted: false, reason: 'lease_token_missing' };
  }

  const now = request.now === undefined ? new Date() : request.now;
  if (!(now instanceof Date) || !Number.isFinite(now.getTime())) {
    return { accepted: false, reason: 'request_time_invalid' };
  }
  if (!isCanonicalTimestamp(authority.writerLeaseExpiresAt)) {
    return { accepted: false, reason: 'lease_expiry_invalid' };
  }

  if (authority.mode !== 'active') return { accepted: false, reason: 'not_active' };
  if (authority.deploymentId !== request.deploymentId) {
    return { accepted: false, reason: 'deployment_mismatch' };
  }
  if (authority.writerEpoch !== request.writerEpoch) {
    return { accepted: false, reason: 'stale_epoch' };
  }
  if (authority.writerLeaseId !== request.writerLeaseId) {
    return { accepted: false, reason: 'lease_mismatch' };
  }
  if (authority.sourceCredentialFingerprint !== request.sourceCredentialFingerprint) {
    return { accepted: false, reason: 'source_credential_mismatch' };
  }

  const expiresAt = new Date(authority.writerLeaseExpiresAt);
  if (expiresAt.getTime() <= now.getTime()) {
    return { accepted: false, reason: 'lease_expired' };
  }
  return { accepted: true };
}
