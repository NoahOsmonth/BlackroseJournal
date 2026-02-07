import { getSimpleMemConfig } from '../backend/src/config/simpleMemConfig';

describe('simpleMem config', () => {
    const originalEnv = process.env;

    beforeEach(() => {
        process.env = { ...originalEnv };
        delete process.env.OPENROUTER_EMBEDDING_API_KEY;
        delete process.env.SIMPLEMEM_ENABLED;
        delete process.env.SIMPLEMEM_TOP_K;
    });

    afterAll(() => {
        process.env = originalEnv;
    });

    it('disables memory by default when embedding key is missing', () => {
        const config = getSimpleMemConfig();
        expect(config.enabled).toBe(false);
    });

    it('enables memory when key exists and parses top-k', () => {
        process.env.OPENROUTER_EMBEDDING_API_KEY = 'test-key';
        process.env.SIMPLEMEM_ENABLED = 'true';
        process.env.SIMPLEMEM_TOP_K = '22';

        const config = getSimpleMemConfig();
        expect(config.enabled).toBe(true);
        expect(config.topK).toBe(22);
    });
});

