import {
    THERAPIST_SYSTEM_PROMPT,
    THERAPIST_SYSTEM_PROMPT_WORD_COUNT,
    GUIDED_COMPANION_SYSTEM_PROMPT,
} from '../../constants/aiPrompts';
import {
    ROSEBUD_COMPANION_SYSTEM_PROMPT,
    ROSEBUD_COMPANION_WORD_COUNT,
    countPromptWords,
} from '../../constants/rosebudCompanionPrompt';
import { HISTORY_TOOLS_POLICY } from '../../services/ai/tools';
import { shouldEnableHistoryTools } from '../../services/ai/ai';
import type { Message } from '../../services/ai/chatTypes';

describe('Rosebud companion system prompt', () => {
    it('is about 5000–8000 words (acceptance near 8000)', () => {
        const words = countPromptWords(ROSEBUD_COMPANION_SYSTEM_PROMPT);
        expect(words).toBe(ROSEBUD_COMPANION_WORD_COUNT);
        expect(words).toBeGreaterThanOrEqual(5000);
        expect(words).toBeLessThanOrEqual(8200);
        // Target band around 8k
        expect(words).toBeGreaterThanOrEqual(7000);
    });

    it('exports the long prompt as THERAPIST_SYSTEM_PROMPT for freeform chat', () => {
        expect(THERAPIST_SYSTEM_PROMPT).toBe(ROSEBUD_COMPANION_SYSTEM_PROMPT);
        expect(THERAPIST_SYSTEM_PROMPT_WORD_COUNT).toBe(ROSEBUD_COMPANION_WORD_COUNT);
    });

    it('encodes curiosity + proactive clock/history tool doctrine', () => {
        const prompt = ROSEBUD_COMPANION_SYSTEM_PROMPT;
        expect(prompt).toContain('Rosebud');
        expect(prompt.toLowerCase()).toContain('curious');
        expect(prompt).toContain('get_clock');
        expect(prompt).toContain('list_recent_days');
        expect(prompt).toContain('get_day');
        expect(prompt).toContain('get_conversation');
        expect(prompt).toContain('search_history');
        expect(prompt).toMatch(/proactive|freely|liberally/i);
        expect(prompt).toMatch(/night|late/i);
    });

    it('keeps a shorter guided prompt for intention / daily check-in', () => {
        const words = countPromptWords(GUIDED_COMPANION_SYSTEM_PROMPT);
        expect(words).toBeLessThan(800);
        expect(GUIDED_COMPANION_SYSTEM_PROMPT).toContain('get_clock');
        expect(GUIDED_COMPANION_SYSTEM_PROMPT).toContain('Rosebud');
    });

    it('history tools policy is proactive (not only when asked)', () => {
        expect(HISTORY_TOOLS_POLICY).toContain('use freely');
        expect(HISTORY_TOOLS_POLICY).toContain('get_clock');
        expect(HISTORY_TOOLS_POLICY).toContain('update_identity');
        expect(HISTORY_TOOLS_POLICY).not.toMatch(/only when the user asks/i);
    });
});

describe('proactive tool enablement', () => {
    const base: Message[] = [
        { id: '1', role: 'user', content: 'I am exhausted and work crushed me today', timestamp: 1 },
    ];

    it('enables tools for rants / temporal language / first real turns', () => {
        expect(shouldEnableHistoryTools('auto', base[0].content, base)).toBe(true);
        expect(shouldEnableHistoryTools('auto', 'What did I talk about yesterday?', base)).toBe(true);
        expect(shouldEnableHistoryTools('auto', 'hello', base)).toBe(false);
        expect(shouldEnableHistoryTools(true, 'hello', base)).toBe(true);
        expect(shouldEnableHistoryTools(false, 'yesterday', base)).toBe(false);
    });

    it('does not enable tools for synthetic bootstrap triggers', () => {
        const bootstrap: Message[] = [
            { id: '1', role: 'user', content: '[Start intention check-in]', timestamp: 1 },
        ];
        expect(shouldEnableHistoryTools('auto', bootstrap[0].content, bootstrap)).toBe(false);
        expect(shouldEnableHistoryTools('auto', '[Start daily check-in]', bootstrap)).toBe(false);
        expect(shouldEnableHistoryTools(true, '[Start intention check-in]', bootstrap)).toBe(true);
    });
});

