/**
 * Congestion-aware self-heal retries in the direct transport.
 *
 * Rate-limit / queue-expiry signals (429/503/504) must back off on the order
 * of seconds, not the short network-error backoff — retrying 250ms after a
 * "request queue expired (15s)" response just hits the same saturated window.
 * A Retry-After header, when present, wins over the default congestion steps.
 */

import { activateAccount, clearActiveAccount } from '../../../services/account/accountRuntime';
import { getResolvedDirectConfig } from '../../../services/ai/directConfig';
import {
    clearModelUnavailableCache,
    fetchDirectChatCompletion,
} from '../../../services/ai/directTransport';

const TEST_ENV_RESOLVED_CONFIG = {
    apiKey: 'sk-direct-test-key',
    apiBaseUrl: 'https://nano-gpt.com/api/v1',
    model: 'moonshotai/kimi-k2.5:thinking',
    flashModel: 'moonshotai/kimi-k2.5',
    source: 'env',
} as const;

jest.mock('../../../services/ai/directConfig', () => ({
    getDirectConfig: () => ({
        apiKey: 'sk-direct-test-key',
        apiBaseUrl: 'https://nano-gpt.com/api/v1',
        model: 'moonshotai/kimi-k2.5:thinking',
        flashModel: 'moonshotai/kimi-k2.5',
    }),
    getResolvedDirectConfig: jest.fn(() => Promise.resolve(TEST_ENV_RESOLVED_CONFIG)),
}));

function jsonResponse(status: number, headers: Record<string, string> = {}): Response {
    return {
        ok: status < 400,
        status,
        headers: new Headers(headers),
        text: async () =>
            status < 400 ? '{"choices":[{"message":{"content":"ok"}}]}' : 'queue expired',
    } as unknown as Response;
}

/** Captures setTimeout delays while running them instantly (no real waits). */
function captureDelays(): { waited: number[]; restore: () => void } {
    const waited: number[] = [];
    const original = global.setTimeout;
    const spy = jest
        .spyOn(global, 'setTimeout')
        .mockImplementation(((fn: (args: void) => void, ms?: number) => {
            waited.push(typeof ms === 'number' ? ms : 0);
            return original(fn, 0);
        }) as unknown as typeof setTimeout);
    return { waited, restore: spy.mockRestore.bind(spy) };
}

describe('directTransport congestion backoff', () => {
    beforeEach(async () => {
        await activateAccount('congestion-test');
        clearModelUnavailableCache();
        jest.mocked(getResolvedDirectConfig).mockResolvedValue(TEST_ENV_RESOLVED_CONFIG);
    });

    afterEach(async () => {
        await clearActiveAccount();
        jest.restoreAllMocks();
    });

    it('backs off ~seconds (not ms) after 504 congestion before next attempt', async () => {
        const fetchMock = jest
            .spyOn(global, 'fetch')
            .mockResolvedValueOnce(jsonResponse(504))
            .mockResolvedValueOnce(jsonResponse(200));

        const { waited, restore } = captureDelays();
        try {
            const response = await fetchDirectChatCompletion({
                model: TEST_ENV_RESOLVED_CONFIG.model,
                messages: [{ role: 'user', content: 'hi' }],
            });
            expect(response.ok).toBe(true);
        } finally {
            restore();
        }

        expect(fetchMock).toHaveBeenCalledTimes(2);
        expect(waited.length).toBeGreaterThan(0);
        // Congestion backoff is in the seconds range — well above the 500ms
        // network-blip ceiling, far below any UI-relevant stall.
        expect(waited[0]).toBeGreaterThanOrEqual(800);
        expect(waited[0]).toBeLessThan(7_000);
    });

    it('honors Retry-After seconds header on 429 congestion', async () => {
        jest.spyOn(global, 'fetch')
            .mockResolvedValueOnce(jsonResponse(429, { 'retry-after': '2' }))
            .mockResolvedValueOnce(jsonResponse(200));

        const { waited, restore } = captureDelays();
        try {
            await fetchDirectChatCompletion({
                model: TEST_ENV_RESOLVED_CONFIG.model,
                messages: [{ role: 'user', content: 'hi' }],
            });
        } finally {
            restore();
        }

        expect(waited[0]).toBeGreaterThanOrEqual(1_800);
        expect(waited[0]).toBeLessThanOrEqual(2_200);
    });

    it('does not treat a plain network blip as congestion (fast retry)', async () => {
        jest.spyOn(global, 'fetch')
            .mockRejectedValueOnce(new Error('network down'))
            .mockResolvedValueOnce(jsonResponse(200));

        const { waited, restore } = captureDelays();
        try {
            await fetchDirectChatCompletion({
                model: TEST_ENV_RESOLVED_CONFIG.model,
                messages: [{ role: 'user', content: 'hi' }],
            });
        } finally {
            restore();
        }

        // Network blip keeps the original short exponential backoff.
        expect(waited[0]).toBeLessThan(800);
    });
});
