import fs from 'fs';
import path from 'path';
import { getAiConfig as getBackendAiConfig } from '../backend/src/config/aiConfig';
import { getAiConfig as getAppAiConfig } from '../services/ai/aiConfig';

jest.mock('expo-constants', () => ({
    manifest: { extra: {} },
    expoGoConfig: { extra: {} },
    expoConfig: { extra: {} },
}));

describe('Kimi-only model configuration', () => {
    const originalEnv = process.env;

    beforeEach(() => {
        process.env = { ...originalEnv };
        process.env.NANO_GPT_API_KEY = 'test-key';
        delete process.env.NANO_GPT_MODEL;
        delete process.env.NANO_GPT_FLASH_MODEL;
        delete process.env.EXPO_PUBLIC_NANO_GPT_MODEL;
        delete process.env.EXPO_PUBLIC_NANO_GPT_FLASH_MODEL;
    });

    afterAll(() => {
        process.env = originalEnv;
    });

    it('uses Kimi defaults for app and backend AI configs', () => {
        const appConfig = getAppAiConfig();
        const backendConfig = getBackendAiConfig();

        expect(appConfig.model).toBe('moonshotai/kimi-k2.5:thinking');
        expect(appConfig.flashModel).toBe('moonshotai/kimi-k2.5');
        expect(backendConfig.model).toBe('moonshotai/kimi-k2.5:thinking');
        expect(backendConfig.flashModel).toBe('moonshotai/kimi-k2.5');
    });

    it('keeps persona model picker focused on Kimi variants only', () => {
        const advancedPath = path.join(process.cwd(), 'app', 'persona', 'advanced.tsx');
        const advancedContent = fs.readFileSync(advancedPath, 'utf-8');

        expect(advancedContent).toContain("'moonshotai/kimi-k2.5:thinking'");
        expect(advancedContent).toContain("'moonshotai/kimi-k2.5'");
        expect(advancedContent).not.toContain('glm-4.7');
        expect(advancedContent).not.toContain("'agent-default'");
    });
});
