import { getHindsightConfig, isHindsightEnabled } from '../../../services/memory/hindsight/hindsightConfig';

describe('hindsight gateway configuration', () => {
    const originalGateway = process.env.EXPO_PUBLIC_AGENT_BASE_URL;
    afterEach(() => { process.env.EXPO_PUBLIC_AGENT_BASE_URL = originalGateway; });

    it('soft-disables without the managed gateway', () => {
        delete process.env.EXPO_PUBLIC_AGENT_BASE_URL;
        expect(getHindsightConfig()).toEqual({ baseUrl: '', enabled: false });
        expect(isHindsightEnabled()).toBe(false);
    });

    it('uses only the managed gateway and strips trailing slashes', () => {
        process.env.EXPO_PUBLIC_AGENT_BASE_URL = 'https://gateway.example///';
        process.env.EXPO_PUBLIC_HINDSIGHT_BASE_URL = 'http://shared-bank.invalid:8888';
        process.env.EXPO_PUBLIC_HINDSIGHT_BANK = 'rosebud';
        expect(getHindsightConfig()).toEqual({ baseUrl: 'https://gateway.example', enabled: true });
        delete process.env.EXPO_PUBLIC_HINDSIGHT_BASE_URL;
        delete process.env.EXPO_PUBLIC_HINDSIGHT_BANK;
    });
});
