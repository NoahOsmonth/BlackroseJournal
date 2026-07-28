import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  evaluateDeploymentWrite,
  type DeploymentWriteRequest,
} from '../../../shared/memory/deploymentAuthority';
import type { DeploymentAuthority } from '../../../shared/memory/contracts';

const authority: DeploymentAuthority = {
  deploymentId: 'blackrose-primary',
  writerEpoch: 7,
  mode: 'active',
  backendBaseUrl: 'https://api.example.test',
  databaseFingerprint: 'sha256:primary',
  writerLeaseId: '00000000-0000-4000-8000-000000000077',
  writerLeaseExpiresAt: '2099-07-28T00:00:00.000Z',
  writerLeaseIssuer: 'rosebud-operator',
  writerLeaseKeyId: 'operator-key-1',
  sourceCredentialFingerprint: 'sha256:source-a',
};

const request: DeploymentWriteRequest = {
  deploymentId: authority.deploymentId,
  writerEpoch: authority.writerEpoch,
  writerLeaseId: authority.writerLeaseId!,
  writerLeaseToken: 'opaque-signed-lease-token',
  sourceCredentialFingerprint: authority.sourceCredentialFingerprint!,
  now: new Date('2026-07-28T00:00:00.000Z'),
};

describe('deployment write authority', () => {
  it('performs structural preflight without authenticating the opaque token', () => {
    assert.deepEqual(evaluateDeploymentWrite(authority, {
      ...request,
      writerLeaseToken: 'not-authenticated-by-this-helper',
    }), { accepted: true });
  });

  it('rejects unavailable, non-active, foreign, stale, and mismatched authority', () => {
    assert.deepEqual(evaluateDeploymentWrite(null, request), {
      accepted: false,
      reason: 'authority_unavailable',
    });

    for (const mode of ['maintenance', 'read_only', 'retired'] as const) {
      assert.deepEqual(evaluateDeploymentWrite({ ...authority, mode }, request), {
        accepted: false,
        reason: 'not_active',
      });
    }

    assert.deepEqual(evaluateDeploymentWrite(authority, {
      ...request,
      deploymentId: 'other',
    }), { accepted: false, reason: 'deployment_mismatch' });
    assert.deepEqual(evaluateDeploymentWrite(authority, {
      ...request,
      writerEpoch: 6,
    }), { accepted: false, reason: 'stale_epoch' });
    assert.deepEqual(evaluateDeploymentWrite(authority, {
      ...request,
      writerLeaseId: '00000000-0000-4000-8000-000000000078',
    }), { accepted: false, reason: 'lease_mismatch' });
    assert.deepEqual(evaluateDeploymentWrite(authority, {
      ...request,
      sourceCredentialFingerprint: 'sha256:wrong-source',
    }), { accepted: false, reason: 'source_credential_mismatch' });
  });

  it('rejects malformed deployment and lease identifiers', () => {
    assert.deepEqual(evaluateDeploymentWrite({
      ...authority,
      deploymentId: ' ',
    }, request), { accepted: false, reason: 'deployment_id_invalid' });
    assert.deepEqual(evaluateDeploymentWrite(authority, {
      ...request,
      deploymentId: 'bad id',
    }), { accepted: false, reason: 'deployment_id_invalid' });
    assert.deepEqual(evaluateDeploymentWrite({
      ...authority,
      writerLeaseId: 'not-a-uuid',
    }, request), { accepted: false, reason: 'lease_id_invalid' });
    assert.deepEqual(evaluateDeploymentWrite(authority, {
      ...request,
      writerLeaseId: '',
    }), { accepted: false, reason: 'lease_id_invalid' });
    assert.deepEqual(evaluateDeploymentWrite({
      ...authority,
      writerLeaseIssuer: ' ',
    }, request), { accepted: false, reason: 'lease_issuer_invalid' });
    assert.deepEqual(evaluateDeploymentWrite({
      ...authority,
      writerLeaseKeyId: 'bad key id',
    }, request), { accepted: false, reason: 'lease_key_id_invalid' });
  });

  it('rejects zero writer epochs', () => {
    assert.deepEqual(evaluateDeploymentWrite({
      ...authority,
      writerEpoch: 0,
    }, {
      ...request,
      writerEpoch: 0,
    }), { accepted: false, reason: 'writer_epoch_invalid' });
  });

  it('rejects negative, fractional, non-finite, and unsafe writer epochs', () => {
    for (const writerEpoch of [
      -1,
      1.5,
      Number.NaN,
      Number.POSITIVE_INFINITY,
      Number.MAX_SAFE_INTEGER + 1,
    ]) {
      assert.deepEqual(evaluateDeploymentWrite({
        ...authority,
        writerEpoch,
      }, request), { accepted: false, reason: 'writer_epoch_invalid' });
      assert.deepEqual(evaluateDeploymentWrite(authority, {
        ...request,
        writerEpoch,
      }), { accepted: false, reason: 'writer_epoch_invalid' });
    }
  });

  it('rejects blank tokens and malformed fingerprints', () => {
    assert.deepEqual(evaluateDeploymentWrite(authority, {
      ...request,
      writerLeaseToken: ' \t ',
    }), { accepted: false, reason: 'lease_token_missing' });
    assert.deepEqual(evaluateDeploymentWrite({
      ...authority,
      databaseFingerprint: 'primary',
    }, request), { accepted: false, reason: 'database_fingerprint_invalid' });
    assert.deepEqual(evaluateDeploymentWrite({
      ...authority,
      sourceCredentialFingerprint: 'sha256:',
    }, request), { accepted: false, reason: 'source_credential_fingerprint_invalid' });
    assert.deepEqual(evaluateDeploymentWrite(authority, {
      ...request,
      sourceCredentialFingerprint: ' ',
    }), { accepted: false, reason: 'source_credential_fingerprint_invalid' });
  });

  it('distinguishes invalid request time, invalid expiry, and expired leases', () => {
    assert.deepEqual(evaluateDeploymentWrite(authority, {
      ...request,
      now: new Date('invalid'),
    }), { accepted: false, reason: 'request_time_invalid' });
    assert.deepEqual(evaluateDeploymentWrite({
      ...authority,
      writerLeaseExpiresAt: 'not-a-date',
    }, request), { accepted: false, reason: 'lease_expiry_invalid' });
    assert.deepEqual(evaluateDeploymentWrite({
      ...authority,
      writerLeaseExpiresAt: '2099-07-28',
    }, request), { accepted: false, reason: 'lease_expiry_invalid' });
    assert.deepEqual(evaluateDeploymentWrite({
      ...authority,
      writerLeaseExpiresAt: null,
    }, request), { accepted: false, reason: 'lease_expiry_invalid' });
    assert.deepEqual(evaluateDeploymentWrite({
      ...authority,
      writerLeaseExpiresAt: '2026-07-28T00:00:00.000Z',
    }, request), { accepted: false, reason: 'lease_expired' });
  });
});
