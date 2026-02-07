import { buildSystemPrompt } from '../backend/src/agent/systemPrompt';

describe('backend system prompt memory context', () => {
    it('returns base prompt when memory context is empty', () => {
        const result = buildSystemPrompt('You are a helper.');
        expect(result).toBe('You are a helper.');
    });

    it('appends memory guidance and context when provided', () => {
        const result = buildSystemPrompt(
            'You are a helper.',
            '## Long-Term Memory Context\n1. User prefers early mornings.'
        );

        expect(result).toContain('You are a helper.');
        expect(result).toContain('Memory Guidance');
        expect(result).toContain('User prefers early mornings');
    });
});

