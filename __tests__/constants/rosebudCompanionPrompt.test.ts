/**
 * PR8b-1 gates: companion budget ≤5k est tokens; doctrine presence; non-directive persona.
 */

import {
    THERAPIST_SYSTEM_PROMPT,
    THERAPIST_SYSTEM_PROMPT_WORD_COUNT,
    GUIDED_COMPANION_SYSTEM_PROMPT,
} from '../../constants/aiPrompts';
import {
    COMPANION_PROMPT_BUDGET,
    ROSEBUD_COMPANION_SYSTEM_PROMPT,
    ROSEBUD_COMPANION_WORD_COUNT,
    ROSEBUD_COMPANION_EST_TOKENS,
    countPromptWords,
    estimateCompanionPromptTokens,
} from '../../constants/rosebudCompanionPrompt';
import { HISTORY_TOOLS_POLICY } from '../../services/ai/tools';
import { shouldEnableHistoryTools } from '../../services/ai/ai';
import type { Message } from '../../services/ai/chatTypes';
import { buildClockContext } from '../../utils/date';
import { formatIdentityContext } from '../../services/memory/identityProfile';
import type { IdentityProfile } from '../../services/memory/identityProfile.types';

describe('Rosebud companion system prompt — PR8b-1 budget', () => {
    it('static companion est tokens stay under COMPANION_PROMPT_BUDGET (hard cap)', () => {
        const est = estimateCompanionPromptTokens(ROSEBUD_COMPANION_SYSTEM_PROMPT);
        expect(est).toBe(ROSEBUD_COMPANION_EST_TOKENS);
        expect(est).toBeLessThanOrEqual(COMPANION_PROMPT_BUDGET);
        expect(COMPANION_PROMPT_BUDGET).toBe(5000);
        // Sanity: diet actually landed (was ~11900)
        expect(est).toBeLessThan(6000);
        expect(est).toBeGreaterThan(500);
    });

    it('exports the dieted prompt as THERAPIST_SYSTEM_PROMPT for freeform chat', () => {
        expect(THERAPIST_SYSTEM_PROMPT).toBe(ROSEBUD_COMPANION_SYSTEM_PROMPT);
        expect(THERAPIST_SYSTEM_PROMPT_WORD_COUNT).toBe(ROSEBUD_COMPANION_WORD_COUNT);
        expect(countPromptWords(ROSEBUD_COMPANION_SYSTEM_PROMPT)).toBe(ROSEBUD_COMPANION_WORD_COUNT);
    });

    /**
     * Sabotage: inflate static prose past budget → red; restored prompt → green.
     * (Diet is short enough that 2× may still fit; pad until over the hard cap.)
     */
    it('sabotage: inflated static prose exceeds budget; restored prompt stays under', () => {
        let inflated = ROSEBUD_COMPANION_SYSTEM_PROMPT;
        while (estimateCompanionPromptTokens(inflated) <= COMPANION_PROMPT_BUDGET) {
            inflated += '\n\n' + ROSEBUD_COMPANION_SYSTEM_PROMPT;
        }
        expect(estimateCompanionPromptTokens(inflated)).toBeGreaterThan(COMPANION_PROMPT_BUDGET);

        const restoredEst = estimateCompanionPromptTokens(ROSEBUD_COMPANION_SYSTEM_PROMPT);
        expect(restoredEst).toBeLessThanOrEqual(COMPANION_PROMPT_BUDGET);
    });
});

describe('Rosebud companion — load-bearing doctrine', () => {
    /** Full date doctrine from buildClockContext (day-slip fix). */
    const FIXED = new Date(2026, 6, 18, 15, 0, 0);
    const clock = buildClockContext(FIXED);

    it('clock block contains full date doctrine (write day vs event day)', () => {
        expect(clock).toContain('## Date doctrine (write day vs event day)');
        expect(clock).toContain(
            'Dates labeled on past entries, digests, session recall lines, and memory capsule lines (e.g. "Written YYYY-MM-DD") are when those items were WRITTEN or finished on this device — not when life events described in the prose occurred.',
        );
        expect(clock).toContain(
            "Weekday and calendar names in the user's own words are authoritative for event timing. Resolve them against this clock (most recent past occurrence unless clearly future). Prefer absolute YYYY-MM-DD over relative phrases when you state when something happened.",
        );
        expect(clock).toContain(
            'Never call an event "today" or "yesterday" unless its resolved date matches this clock. Never say "the day before", "the day after", or similar unless the arithmetic actually holds for the absolute dates you state.',
        );
        expect(clock).toContain(
            'When an "Event: YYYY-MM-DD" label is present on a past-context line, that absolute date is authoritative for when the event occurs — do not re-resolve or contradict it.',
        );
    });

    it('identity context keeps no-invent + trust-live-message doctrine', () => {
        const profile: IdentityProfile = {
            schemaVersion: 1,
            preferredName: {
                value: 'Sigurd',
                confidence: 0.9,
                source: 'extraction',
                updatedAt: 1,
            },
            keyPeople: [],
            facts: [],
            updatedAt: 1,
        };
        const ctx = formatIdentityContext(profile);
        expect(ctx).toBeDefined();
        // Load-bearing line kept verbatim (header was dieted separately).
        expect(ctx).toContain(
            'Do not invent identity details that are not listed. If a fact conflicts with the live message, trust the live message and treat the stored value as possibly outdated.',
        );
        expect(ctx).toContain('Preferred name: Sigurd');
    });

    it('static companion keeps safety/crisis stance', () => {
        const p = ROSEBUD_COMPANION_SYSTEM_PROMPT;
        expect(p).toMatch(/self-harm|hopelessness/i);
        expect(p).toMatch(/emergency resources|crisis/i);
        expect(p).toMatch(/never mock or dismiss crisis/i);
    });

    it('static companion keeps memory conflict → trust live message', () => {
        expect(ROSEBUD_COMPANION_SYSTEM_PROMPT).toContain(
            'If memory conflicts with the live message, trust the live message and ask gently',
        );
    });

    it('tools policy stays proactive and names core tools', () => {
        expect(HISTORY_TOOLS_POLICY).toMatch(/use freely|proactive/i);
        expect(HISTORY_TOOLS_POLICY).toContain('get_clock');
        expect(HISTORY_TOOLS_POLICY).toContain('update_identity');
        expect(HISTORY_TOOLS_POLICY).not.toMatch(/only when the user asks/i);
        // Diet: should be far shorter than pre-PR8b ~1889 chars
        expect(HISTORY_TOOLS_POLICY.length).toBeLessThan(900);
    });
});

describe('Rosebud companion — non-directive persona', () => {
    it('encodes reflect-first / max one suggestion / prefer question over advice', () => {
        const p = ROSEBUD_COMPANION_SYSTEM_PROMPT;
        expect(p).toMatch(/Reflect first/i);
        expect(p).toMatch(/at most ONE gentle suggestion per turn/i);
        expect(p).toMatch(/Prefer a question over advice/i);
        expect(p).toMatch(/No unsolicited advice lists/i);
        expect(p).toMatch(/non-directive|Non-directive/i);
        expect(p).toContain('Rosebud');
        expect(p.toLowerCase()).toContain('curious');
        expect(p).toContain('get_clock');
    });
});

describe('guided + proactive enablement (unchanged behavior)', () => {
    it('keeps a shorter guided prompt for intention / daily check-in', () => {
        const words = countPromptWords(GUIDED_COMPANION_SYSTEM_PROMPT);
        expect(words).toBeLessThan(800);
        expect(GUIDED_COMPANION_SYSTEM_PROMPT).toContain('get_clock');
        expect(GUIDED_COMPANION_SYSTEM_PROMPT).toContain('Rosebud');
        expect(GUIDED_COMPANION_SYSTEM_PROMPT).toMatch(/Non-directive|one gentle suggestion/i);
    });

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
