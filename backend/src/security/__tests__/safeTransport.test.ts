import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  requestSafeHttps,
  SafeTransportHopRequest,
  SafeTransportResponse,
} from '../safeTransport';

describe('pinned SSRF-safe HTTPS transport', () => {
  it('pins each request and revalidates DNS on every same-origin redirect hop', async () => {
    let lookups = 0;
    const seen: SafeTransportHopRequest[] = [];
    const response = await requestSafeHttps('https://api.example/start', {
      lookup: async () => {
        lookups += 1;
        return [{ address: lookups === 1 ? '93.184.216.34' : '93.184.216.35', family: 4 }];
      },
      requestHop: async (request): Promise<SafeTransportResponse> => {
        seen.push(request);
        if (seen.length === 1) {
          return { status: 302, headers: { location: '/next' }, body: Buffer.alloc(0) };
        }
        return { status: 200, headers: {}, body: Buffer.from('ok') };
      },
      maxRedirects: 2,
      maxCrossOriginRedirects: 0,
    });

    assert.equal(response.body.toString('utf8'), 'ok');
    assert.equal(lookups, 2);
    assert.deepEqual(seen.map((item) => ({ url: item.url, address: item.address })), [
      { url: 'https://api.example/start', address: '93.184.216.34' },
      { url: 'https://api.example/next', address: '93.184.216.35' },
    ]);
  });

  it('rejects unsafe and excessive redirects before another request is sent', async () => {
    const locations = [
      'https://127.0.0.1/private',
      'https://other.example/path',
    ];
    for (const location of locations) {
      let requests = 0;
      await assert.rejects(() => requestSafeHttps('https://api.example/start', {
        lookup: async () => [{ address: '93.184.216.34', family: 4 }],
        requestHop: async () => {
          requests += 1;
          return { status: 302, headers: { location }, body: Buffer.alloc(0) };
        },
        maxRedirects: 2,
        maxCrossOriginRedirects: 0,
      }), /unsafe|cross-origin/i);
      assert.equal(requests, 1);
    }

    let hopRequests = 0;
    await assert.rejects(() => requestSafeHttps('https://api.example/start', {
      lookup: async () => [{ address: '93.184.216.34', family: 4 }],
      requestHop: async () => {
        hopRequests += 1;
        return { status: 302, headers: { location: `/hop-${hopRequests}` }, body: Buffer.alloc(0) };
      },
      maxRedirects: 1,
      maxCrossOriginRedirects: 0,
    }), /redirect limit/i);
    assert.equal(hopRequests, 2);
  });

  it('removes every credential-bearing header before an allowed cross-origin redirect', async () => {
    const seenHeaders: Array<Readonly<Record<string, string>>> = [];
    await requestSafeHttps('https://api.example/start', {
      lookup: async () => [{ address: '93.184.216.34', family: 4 }],
      headers: {
        Authorization: 'Bearer provider-secret',
        apikey: 'provider-secret',
        'X-API-Key': 'provider-secret',
        'x-goog-api-key': 'provider-secret',
        'x-provider-token': 'provider-secret',
        'x-client-secret-value': 'provider-secret',
        'custom-auth-header': 'provider-secret',
        'x-api-version': '2026-08-24',
        'x-safe-label': 'visible',
      },
      requestHop: async (request): Promise<SafeTransportResponse> => {
        seenHeaders.push(request.headers);
        if (seenHeaders.length === 1) {
          return {
            status: 302,
            headers: { location: 'https://other.example/next' },
            body: Buffer.alloc(0),
          };
        }
        return { status: 200, headers: {}, body: Buffer.from('ok') };
      },
      maxCrossOriginRedirects: 1,
    });

    assert.deepEqual(seenHeaders[1], {
      'x-api-version': '2026-08-24',
      'x-safe-label': 'visible',
    });
  });
});
