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

  it('normalizes prefixed camelCase keys and redacts caller-supplied opaque secrets', () => {
    const opaqueSecret = 'opaque-value-without-a-recognizable-pattern';
    assert.deepEqual(redactSensitive({
      providerKey: opaqueSecret,
      accessToken: opaqueSecret,
      refreshToken: opaqueSecret,
      clientSecret: opaqueSecret,
      authorizationHeader: opaqueSecret,
      inputPrompt: opaqueSecret,
      safe: `upstream included ${opaqueSecret}`,
    }, [opaqueSecret]), {
      providerKey: '[REDACTED]',
      accessToken: '[REDACTED]',
      refreshToken: '[REDACTED]',
      clientSecret: '[REDACTED]',
      authorizationHeader: '[REDACTED]',
      inputPrompt: '[REDACTED]',
      safe: 'upstream included [REDACTED]',
    });
  });

  it('redacts tokenized sensitive fields without matching innocent substrings', () => {
    assert.deepEqual(redactSensitive({
      secret_value: 'hidden',
      token_expiry: 'hidden',
      provider_key_value: 'hidden',
      nestedClientSecretValue: 'hidden',
      systemInstruction: 'hidden',
      monkeyBusiness: 'visible',
      hockeyScore: 'visible',
      tokenizerVersion: 'visible',
      secretaryName: 'visible',
    }), {
      secret_value: '[REDACTED]',
      token_expiry: '[REDACTED]',
      provider_key_value: '[REDACTED]',
      nestedClientSecretValue: '[REDACTED]',
      systemInstruction: '[REDACTED]',
      monkeyBusiness: 'visible',
      hockeyScore: 'visible',
      tokenizerVersion: 'visible',
      secretaryName: 'visible',
    });
  });
});
