import { getHindsightConfig, isHindsightEnabled } from '../../../services/memory/hindsight/hindsightConfig';

describe('hindsightConfig', () => {
    beforeEach(() => {
        // NOTE: babel-preset-expo rewrites process.env.EXPO_PUBLIC_* reads to
        // `expo/virtual/env` (a live reference captured at module load), so we
        // must mutate the existing process.env object in place rather than
        // replace it (`process.env = { ...OLD_ENV }` would be invisible).
        delete process.env.EXPO_PUBLIC_HINDSIGHT_BASE_URL;
        delete process.env.EXPO_PUBLIC_HINDSIGHT_API_KEY;
        delete process.env.EXPO_PUBLIC_HINDSIGHT_BANK;
    });

    it('is disabled when no base URL is configured', () => {
        expect(isHindsightEnabled()).toBe(false);
        expect(getHindsightConfig().enabled).toBe(false);
    });

    it('uses defaults for bank when only base URL is set', () => {
        process.env.EXPO_PUBLIC_HINDSIGHT_BASE_URL = 'http://localhost:8888';
        const cfg = getHindsightConfig();
        expect(cfg.enabled).toBe(true);
        expect(cfg.baseUrl).toBe('http://localhost:8888');
        expect(cfg.bank).toBe('rosebud');
        expect(cfg.apiKey).toBeUndefined();
    });

    it('reads bank and api key', () => {
        process.env.EXPO_PUBLIC_HINDSIGHT_BASE_URL = 'http://100.107.7.52:8888';
        process.env.EXPO_PUBLIC_HINDSIGHT_BANK = 'intentions';
        process.env.EXPO_PUBLIC_HINDSIGHT_API_KEY = 'secret';
        const cfg = getHindsightConfig();
        expect(cfg.bank).toBe('intentions');
        expect(cfg.apiKey).toBe('secret');
    });

    it('treats placeholder keys as unset', () => {
        process.env.EXPO_PUBLIC_HINDSIGHT_BASE_URL = 'http://localhost:8888';
        process.env.EXPO_PUBLIC_HINDSIGHT_API_KEY = 'YOUR_HINDSIGHT_API_KEY';
        expect(getHindsightConfig().apiKey).toBeUndefined();
    });

    it('strips trailing slashes from baseUrl', () => {
        process.env.EXPO_PUBLIC_HINDSIGHT_BASE_URL = 'http://localhost:8888/';
        expect(getHindsightConfig().baseUrl).toBe('http://localhost:8888');
    });
});
