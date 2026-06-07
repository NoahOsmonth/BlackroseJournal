import { buildSystemPrompt } from '../backend/src/agent/systemPrompt';

describe('backend system prompt', () => {
    it('returns the trimmed base prompt', () => {
        const result = buildSystemPrompt('You are a helper.');
        expect(result).toBe('You are a helper.');
    });

    it('does not append long-term memory guidance', () => {
        const result = buildSystemPrompt('You are a helper.\n');

        expect(result).toBe('You are a helper.');
        expect(result).not.toContain('Memory Guidance');
        expect(result).not.toContain('Long-Term Memory');
    });
});
