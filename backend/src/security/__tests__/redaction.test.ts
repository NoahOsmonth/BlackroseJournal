import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { redactSensitive } from '../redaction';

describe('deep redaction', () => {
  it('redacts secret-bearing fields and token patterns at every nesting level', () => {
    const input = {
      safe: 'visible',
      request: {
        prompt: 'private journal text',
        messages: [{ content: 'private conversation' }],
        headers: { authorization: 'Bearer eyJ.private.token' },
      },
      provider: { apiKey: 'sk-super-secret-key-value', label: 'OpenAI' },
      error: 'request failed using Bearer eyJhbGciOiJIUzI1NiJ9.payload.signature',
    };

    assert.deepEqual(redactSensitive(input), {
      safe: 'visible',
      request: {
        prompt: '[REDACTED]',
        messages: '[REDACTED]',
        headers: { authorization: '[REDACTED]' },
      },
      provider: { apiKey: '[REDACTED]', label: 'OpenAI' },
      error: 'request failed using [REDACTED]',
    });
  });

  it('redacts Error details without mutating the original object', () => {
    const error = new Error('upstream rejected sk-abcdefghijklmnopqrstuvwxyz');
    Object.assign(error, { token: 'token-value', status: 401 });

    const redacted = redactSensitive(error);

    assert.deepEqual(redacted, {
      name: 'Error',
      message: 'upstream rejected [REDACTED]',
      token: '[REDACTED]',
      status: 401,
    });
    assert.match(error.message, /sk-/);
  });
});
