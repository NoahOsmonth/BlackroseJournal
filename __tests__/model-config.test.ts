import fs from 'fs';
import path from 'path';
import { getAiConfig as getBackendAiConfig } from '../backend/src/config/aiConfig';

jest.mock('expo-constants', () => ({
    manifest: { extra: {} },
    expoGoConfig: { extra: {} },
    expoConfig: { extra: {} },
}));

describe('NVIDIA default model configuration', () => {
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

    it('uses Nemotron Ultra defaults for the backend AI config', () => {
        const backendConfig = getBackendAiConfig();
        expect(backendConfig.model).toBe('nvidia/nemotron-3-ultra-550b-a55b');
        expect(backendConfig.flashModel).toBe('nvidia/nemotron-3-ultra-550b-a55b');
    });

    it('keeps persona model picker focused on supported NanoGPT variants', () => {
        // The model list was extracted from app/persona/advanced.tsx into the
        // shared constants/aiModels.ts (WS3/WS6) so generation and the picker
        // draw from one source. Assert against that source of truth.
        const modelsPath = path.join(process.cwd(), 'constants', 'aiModels.ts');
        const modelsContent = fs.readFileSync(modelsPath, 'utf-8');

        expect(modelsContent).toContain("'nvidia/nemotron-3-ultra-550b-a55b'");
        expect(modelsContent).toContain("'moonshotai/kimi-k2.5:thinking'");
        expect(modelsContent).toContain("'moonshotai/kimi-k2.5'");
        expect(modelsContent).not.toContain('glm-4.7');
        expect(modelsContent).not.toContain("'agent-default'");

        // The advanced screen still draws its model list from the shared constants.
        const advancedPath = path.join(process.cwd(), 'app', 'persona', 'advanced.tsx');
        const advancedContent = fs.readFileSync(advancedPath, 'utf-8');
        expect(advancedContent).toContain("@/constants/aiModels");
        expect(advancedContent).not.toContain('glm-4.7');
    });
});
