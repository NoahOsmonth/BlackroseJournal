import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { resolveSafeHttpsEndpoint } from '../safeEndpoint';

describe('DNS-aware provider endpoint validation', () => {
  it('returns a normalized HTTPS URL and every public resolved address for pinning', async () => {
    const endpoint = await resolveSafeHttpsEndpoint(
      'https://api.provider.example/v1/',
      async () => [
        { address: '93.184.216.34', family: 4 },
        { address: '2606:2800:220:1:248:1893:25c8:1946', family: 6 },
      ],
    );

    assert.deepEqual(endpoint, {
      url: 'https://api.provider.example/v1/',
      hostname: 'api.provider.example',
      port: 443,
      addresses: ['93.184.216.34', '2606:2800:220:1:248:1893:25c8:1946'],
    });
  });

  it('rejects non-HTTPS, URL credentials, loopback literals, and DNS answers containing private IPs', async () => {
    const publicLookup = async () => [{ address: '93.184.216.34', family: 4 as const }];
    const privateLookup = async () => [
      { address: '93.184.216.34', family: 4 as const },
      { address: '10.0.0.8', family: 4 as const },
    ];
    const unsafe = [
      resolveSafeHttpsEndpoint('http://api.example/v1', publicLookup),
      resolveSafeHttpsEndpoint('https://user:password@api.example/v1', publicLookup),
      resolveSafeHttpsEndpoint('https://127.0.0.1/v1', publicLookup),
      resolveSafeHttpsEndpoint('https://api.example/v1', privateLookup),
      resolveSafeHttpsEndpoint('https://[::1]/v1', publicLookup),
      resolveSafeHttpsEndpoint('https://[::127.0.0.1]/v1', publicLookup),
      resolveSafeHttpsEndpoint('https://[2002:7f00:1::]/v1', publicLookup),
    ];

    for (const pending of unsafe) {
      await assert.rejects(() => pending, /unsafe provider endpoint/i);
    }
  });

  it('fails closed when DNS returns no addresses', async () => {
    await assert.rejects(
      () => resolveSafeHttpsEndpoint('https://api.example/v1', async () => []),
      /unsafe provider endpoint/i,
    );
  });
});
