/**
 * AI persona generation guards (WS6)
 *
 * Verifies `generatePersonaWithAI` maps valid model JSON into a
 * `PersonaCreateInput`, and that defensive parsing clamps/falls back on
 * malformed JSON, out-of-range imagination, and unknown voices — never
 * throwing to the UI. `completeChat` is mocked so no network is touched.
 */

import { generatePersonaWithAI, safeParsePersonaJson } from '@/services/personas/personasAiGeneration';
import { completeChat } from '@/services/ai/ai';
import { DEFAULT_PERSONA_MODEL } from '@/constants/aiModels';

jest.mock('@/services/ai/ai', () => ({
    completeChat: jest.fn(),
}));

const mockCompleteChat = completeChat as jest.MockedFunction<typeof completeChat>;

const ALLOWED_VOICES = ['Onyx', 'Nova', 'Echo'];

function mockReturn(content: string) {
    mockCompleteChat.mockResolvedValueOnce({ content, reasoning: '' });
}

describe('safeParsePersonaJson', () => {
    it('parses valid JSON into a normalized persona', () => {
        const raw = JSON.stringify({
            name: 'Marcus',
            tagline: 'Blunt stoic mentor',
            prompt: 'You are a blunt stoic mentor.',
            voice: 'Onyx',
            imagination: 30,
        });
        const parsed = safeParsePersonaJson(raw, 'a blunt stoic mentor', ALLOWED_VOICES);
        expect(parsed).toEqual({
            name: 'Marcus',
            tagline: 'Blunt stoic mentor',
            prompt: 'You are a blunt stoic mentor.',
            voice: 'Onyx',
            imagination: 30,
        });
    });

    it('strips code fences before parsing', () => {
        const raw = '```json\n{"name":"Sage","tagline":"calm","prompt":"You are calm.","voice":"Nova","imagination":40}\n```';
        const parsed = safeParsePersonaJson(raw, 'calm guide', ALLOWED_VOICES);
        expect(parsed.name).toBe('Sage');
        expect(parsed.voice).toBe('Nova');
    });

    it('clamps out-of-range imagination', () => {
        const high = safeParsePersonaJson(
            JSON.stringify({ name: 'A', tagline: 'b', prompt: 'c', voice: 'Onyx', imagination: 250 }),
            'desc',
            ALLOWED_VOICES
        );
        expect(high.imagination).toBe(100);

        const low = safeParsePersonaJson(
            JSON.stringify({ name: 'A', tagline: 'b', prompt: 'c', voice: 'Onyx', imagination: -50 }),
            'desc',
            ALLOWED_VOICES
        );
        expect(low.imagination).toBe(0);
    });

    it('coerces an unknown voice to an allowed value', () => {
        const parsed = safeParsePersonaJson(
            JSON.stringify({ name: 'A', tagline: 'b', prompt: 'c', voice: 'Thunder', imagination: 50 }),
            'desc',
            ALLOWED_VOICES
        );
        expect(ALLOWED_VOICES).toContain(parsed.voice);
    });

    it('matches a known voice case-insensitively', () => {
        const parsed = safeParsePersonaJson(
            JSON.stringify({ name: 'A', tagline: 'b', prompt: 'c', voice: 'nova', imagination: 50 }),
            'desc',
            ALLOWED_VOICES
        );
        expect(parsed.voice).toBe('Nova');
    });

    it('falls back to defaults on malformed JSON and seeds tagline from the description', () => {
        const parsed = safeParsePersonaJson('not json at all', 'a playful curious friend', ALLOWED_VOICES);
        expect(parsed.name).toBeTruthy();
        expect(parsed.prompt).toBeTruthy();
        expect(ALLOWED_VOICES).toContain(parsed.voice);
        expect(parsed.imagination).toBeGreaterThanOrEqual(0);
        expect(parsed.imagination).toBeLessThanOrEqual(100);
        expect(parsed.tagline).toContain('playful curious friend');
    });

    it('fills missing fields from fallback without throwing', () => {
        const parsed = safeParsePersonaJson('{"name":"OnlyName"}', 'desc', ALLOWED_VOICES);
        expect(parsed.name).toBe('OnlyName');
        expect(parsed.prompt).toBeTruthy();
        expect(ALLOWED_VOICES).toContain(parsed.voice);
    });
});

describe('generatePersonaWithAI', () => {
    beforeEach(() => {
        mockCompleteChat.mockReset();
    });

    it('maps valid AI JSON into a PersonaCreateInput', async () => {
        mockReturn(JSON.stringify({
            name: 'Marcus',
            tagline: 'Blunt stoic mentor',
            prompt: 'You are a blunt stoic mentor who asks short questions.',
            voice: 'Onyx',
            imagination: 25,
        }));

        const result = await generatePersonaWithAI({
            description: 'a blunt stoic mentor',
            allowedVoices: ALLOWED_VOICES,
        });

        expect(result).toEqual({
            name: 'Marcus',
            tagline: 'Blunt stoic mentor',
            prompt: 'You are a blunt stoic mentor who asks short questions.',
            voice: 'Onyx',
            model: DEFAULT_PERSONA_MODEL,
            imagination: 25,
            avatarKey: 'persona-new',
        });
    });

    it('returns a clamped/fallback persona on malformed JSON, never throwing', async () => {
        mockReturn('the model rambled instead of returning json');

        const result = await generatePersonaWithAI({
            description: 'a warm encouraging coach',
            allowedVoices: ALLOWED_VOICES,
        });

        expect(result.name).toBeTruthy();
        expect(result.prompt).toBeTruthy();
        expect(ALLOWED_VOICES).toContain(result.voice);
        expect(result.imagination).toBeGreaterThanOrEqual(0);
        expect(result.imagination).toBeLessThanOrEqual(100);
        expect(result.model).toBe(DEFAULT_PERSONA_MODEL);
        expect(result.avatarKey).toBe('persona-new');
    });

    it('clamps an out-of-range imagination from the AI', async () => {
        mockReturn(JSON.stringify({
            name: 'Wild',
            tagline: 'very creative',
            prompt: 'You are wildly creative.',
            voice: 'Echo',
            imagination: 9999,
        }));

        const result = await generatePersonaWithAI({
            description: 'a wildly creative muse',
            allowedVoices: ALLOWED_VOICES,
        });

        expect(result.imagination).toBe(100);
    });

    it('coerces an unknown voice from the AI to an allowed value', async () => {
        mockReturn(JSON.stringify({
            name: 'Mystery',
            tagline: 'unknown voice',
            prompt: 'You are mysterious.',
            voice: 'Whisper',
            imagination: 50,
        }));

        const result = await generatePersonaWithAI({
            description: 'a mysterious guide',
            allowedVoices: ALLOWED_VOICES,
        });

        expect(ALLOWED_VOICES).toContain(result.voice);
    });

    it('falls back gracefully when completeChat throws', async () => {
        mockCompleteChat.mockRejectedValueOnce(new Error('network down'));

        const result = await generatePersonaWithAI({
            description: 'a playful curious friend',
            allowedVoices: ALLOWED_VOICES,
        });

        expect(result.name).toBeTruthy();
        expect(result.prompt).toBeTruthy();
        expect(ALLOWED_VOICES).toContain(result.voice);
        expect(result.model).toBe(DEFAULT_PERSONA_MODEL);
    });
});
