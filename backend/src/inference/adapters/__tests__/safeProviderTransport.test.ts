import assert from 'node:assert/strict';
import https from 'node:https';
import { PassThrough } from 'node:stream';
import { describe, it, mock } from 'node:test';
import { requestSafeProviderStream } from '../safeProviderTransport';

describe('safe provider transport pinned lookup', () => {
  it('answers both dns lookup callback contracts on the pinned provider hop', async () => {
    // IP-literal URL keeps resolveSafeHttpsEndpoint off the network (isIP branch).
    const input = {
      url: 'https://93.184.216.34/v1/chat/completions',
      method: 'POST',
      headers: { authorization: 'Bearer test-secret' },
      body: new TextEncoder().encode('{}'),
      signal: new AbortController().signal,
      maxResponseBytes: 1024 * 1024,
    };

    const fakeResponse = new PassThrough() as PassThrough & {
      statusCode: number;
      headers: Record<string, string>;
    };
    fakeResponse.statusCode = 200;
    fakeResponse.headers = {};

    class FakeClientRequest {
      private handlers = new Map<string, (payload?: unknown) => void>();
      private responseCallback?: (response: unknown) => void;
      constructor(
        _url: unknown,
        _options: unknown,
        onResponse: (response: unknown) => void,
      ) {
        this.responseCallback = onResponse;
      }

      on(event: string, handler: (payload?: unknown) => void): this {
        this.handlers.set(event, handler);
        return this;
      }

      write(): void {}

      end(): void {
        queueMicrotask(() => {
          this.responseCallback?.(fakeResponse);
          fakeResponse.end('pinned-ok');
        });
      }
    }

    let capturedOptions: Record<string, unknown> | undefined;
    mock.method(https, 'request', ((_url: URL, options: https.RequestOptions, onResponse: (response: unknown) => void) => {
      capturedOptions = options as Record<string, unknown>;
      return new FakeClientRequest(_url, options, onResponse) as unknown as import('node:http').ClientRequest;
    }) as typeof https.request);

    try {
      const response = await requestSafeProviderStream(input);
      assert.equal(response.status, 200);
      assert.equal(await response.text(), 'pinned-ok');

      const lookup = capturedOptions?.lookup as
        | ((hostname: string, options: unknown, callback: (...args: unknown[]) => void) => void)
        | undefined;
      assert.equal(typeof lookup, 'function');

      // Pair contract (legacy single-address invocation).
      let pairArgs: unknown[] | null = null;
      lookup?.('provider.example', {}, (...args: unknown[]) => {
        pairArgs = args;
      });
      assert.deepEqual(pairArgs, [null, '93.184.216.34', 4]);

      // Array contract — required by Node >=20 happy-eyeballs ({all:true}).
      let arrayArgs: unknown[] | null = null;
      lookup?.('provider.example', { all: true }, (...args: unknown[]) => {
        arrayArgs = args;
      });
      assert.deepEqual(arrayArgs, [null, [{ address: '93.184.216.34', family: 4 }]]);
    } finally {
      mock.restoreAll();
    }
  });
});
