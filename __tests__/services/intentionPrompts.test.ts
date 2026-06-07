import { buildIntentionSystemPrompt } from '../../services/intentions/intentionPrompts';

describe('intentionPrompts', () => {
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
