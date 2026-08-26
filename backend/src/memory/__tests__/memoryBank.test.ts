import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { createMemoryBankDeriver } from '../memoryBank';

describe('memory bank derivation', () => {
  it('derives stable versioned HMAC-SHA256 base32 identifiers without exposing user ids', () => {
    const derive = createMemoryBankDeriver({
      key: Buffer.from('0123456789abcdef0123456789abcdef'),
      version: 1,
    });

    const alpha = derive('user-alpha');
    const beta = derive('user-beta');

    assert.equal(alpha, 'v1_tq7xxyffb7onhvcyk3x3nmpv3ylpc43z3fjeiyp7g3urawricerq');
    assert.equal(beta, 'v1_ip7ai6ipvnzflnckf5eo2vobdb3kqqaerddvwzfigaxbjfzj45ga');
    assert.notEqual(alpha, beta);
    assert.equal(alpha.includes('user-alpha'), false);
    assert.equal(beta.includes('user-beta'), false);
  });

  it('rejects weak keys, invalid versions, and empty verified user ids', () => {
    assert.throws(() => createMemoryBankDeriver({ key: Buffer.alloc(31), version: 1 }), /key/i);
    assert.throws(() => createMemoryBankDeriver({ key: Buffer.alloc(32), version: 0 }), /version/i);
    const derive = createMemoryBankDeriver({ key: Buffer.alloc(32), version: 1 });
    assert.throws(() => derive(''), /user/i);
  });
});
