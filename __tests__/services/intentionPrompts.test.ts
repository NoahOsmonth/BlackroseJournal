import { buildIntentionSystemPrompt } from '../../services/intentions/intentionPrompts';

describe('intentionPrompts', () => {
    it('makes morning and evening guidance meaningfully distinct', () => {
        const morning = buildIntentionSystemPrompt({ type: 'morning' });
        const evening = buildIntentionSystemPrompt({ type: 'evening' });

        expect(morning).toContain('Morning Intention');
        expect(morning).toContain('one grounded intention for the day');
        expect(evening).toContain('Evening Reflection');
        expect(evening).toContain('what to release');
        expect(morning).not.toBe(evening);
    });

    it('guides new intentions through clarify, envision, and commit', () => {
        const prompt = buildIntentionSystemPrompt({
            type: 'intention',
            areaLabel: 'Career',
        });

        expect(prompt).toContain('Career');
        expect(prompt).toContain('Clarify what needs attention');
        expect(prompt).toContain('envision success');
        expect(prompt).toContain('commit to one concrete step');
    });

    it('includes saved feedback guidance so future responses adapt style', () => {
        const prompt = buildIntentionSystemPrompt({
            type: 'morning',
            feedbackGuidance: [
                '## Response Feedback Memory',
                'Do more of this tone/style: concise and warm',
            ].join('\n'),
        });

        expect(prompt).toContain('Morning Intention');
        expect(prompt).toContain('Response Feedback Memory');
        expect(prompt).toContain('concise and warm');
    });
});
