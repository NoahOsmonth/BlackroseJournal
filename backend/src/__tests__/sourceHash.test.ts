import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import type { MirrorChunk } from '../../../shared/memory/mirrorContracts';
import { sha256CanonicalMirrorChunk } from '../memory/canonicalSourceHash';
import {
  credentialFingerprint,
  recomputeChunkHash,
  sha256Hex,
} from '../memory/hashing/sourceHash';

export function validMirrorChunk(): MirrorChunk {
  return {
    contractVersion: 1,
    manifestId: 'manifest-1',
    chunkIndex: 0,
    conversations: [
      {
        id: 'journal:entry-1',
        sourceKind: 'journal',
        sourceRecordId: 'entry-1',
        status: 'settled',
        startedAt: '2026-08-01T10:00:00.000Z',
        settledAt: null,
        timezone: null,
        weekStartsOn: null,
        temporalProvenance: 'legacy_unknown',
        clientSchemaVersion: 1,
        sourceRevision: 1,
        previousAcceptedRevision: null,
        messages: [
          {
            id: 'journal%3Aentry-1:msg-1',
            conversationId: 'journal:entry-1',
            clientEventId: 'journal%3Aentry-1:msg-1',
            role: 'user',
            sequence: 0,
            authoredAt: '2026-08-01T10:00:00.000Z',
            authoredTimezone: null,
            localDate: null,
            temporalProvenance: 'legacy_unknown',
            content: 'hello',
            revision: 1,
            previousAcceptedRevision: null,
            status: 'active',
          },
        ],
      },
    ],
  };
}

describe('mirror source hashing', () => {
  it('matches Node SHA-256 vectors for known inputs', () => {
    assert.equal(
      sha256Hex(''),
      'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
    );
    assert.equal(
      sha256Hex('sb_secret_test'),
      'fc370d44888fccafa52a428e20f3b7d293688490f6f799d6b38566b27fe0ab40',
    );
    assert.equal(
      sha256Hex('legacy.jwt.value'),
      'adf01b3164165917b2f1ee85a9bea9267b2b67b016e77612a5cd40763abf5385',
    );
  });

  it('derives the source credential fingerprint from the exact key bytes', () => {
    assert.equal(
      credentialFingerprint('sb_secret_test'),
      'sha256:fc370d44888fccafa52a428e20f3b7d293688490f6f799d6b38566b27fe0ab40',
    );
    // A different key never produces the same fingerprint.
    assert.notEqual(
      credentialFingerprint('sb_secret_test'),
      credentialFingerprint('claimed-other-key'),
    );
  });

  it('recomputes a fixed canonical chunk to a fixed Node SHA-256 vector', () => {
    const chunk = validMirrorChunk();
    const computed = recomputeChunkHash(chunk);
    assert.equal(computed, sha256CanonicalMirrorChunk(chunk));
    assert.equal(
      computed,
      'sha256:1b2bb8cb1678f6d0d5a573e930308f6282a9910ec23b2985bd4ca368ae4b7387',
    );
  });

  it('never trusts precomputed input: malformed chunk input fails closed', () => {
    assert.throws(() => recomputeChunkHash({
      contractVersion: 1,
      manifestId: 'manifest-1',
      chunkIndex: 0,
      conversations: [],
    }));
    assert.throws(() => recomputeChunkHash(null));
    assert.throws(() => recomputeChunkHash('not-a-chunk'));
  });
});
