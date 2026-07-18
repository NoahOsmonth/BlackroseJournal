/* eslint-disable import/first */

jest.mock('@react-native-async-storage/async-storage', () => ({
    __esModule: true,
    default: {
        getItem: jest.fn(),
        setItem: jest.fn(),
        removeItem: jest.fn(),
    },
}));

jest.mock('../../../services/ai/directTransport', () => ({
    fetchDirectChatCompletion: jest.fn(),
}));

import { fetchDirectChatCompletion } from '../../../services/ai/directTransport';
import { resetJsonCompletionStateForTests } from '../../../services/ai/jsonCompletion';
import {
    extractAndApplyIdentity,
    extractIdentityDeterministic,
    looksLikeIdentitySignal,
    resetIdentityExtractionStateForTests,
} from '../../../services/memory/identityExtraction';
import {
    clearIdentityProfile,
    getIdentityProfile,
    resetIdentityStorageAdapter,
    setIdentityStorageAdapter,
} from '../../../services/memory/identityProfile';

function createInMemoryAdapter() {
    const store = new Map<string, string>();
    return {
        store,
        getItem: async (key: string) => store.get(key) ?? null,
        setItem: async (key: string, value: string) => {
            store.set(key, value);
        },
        removeItem: async (key: string) => {
            store.delete(key);
        },
    };
}

const mockFetch = jest.mocked(fetchDirectChatCompletion);

function mockLlmJson(payload: Record<string, unknown>): void {
    mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
            choices: [{
                message: {
                    content: JSON.stringify(payload),
                },
            }],
        }),
        text: async () => '',
    } as Response);
}

function mockLlmMalformedThenOk(okPayload: Record<string, unknown>): void {
    mockFetch
        .mockResolvedValueOnce({
            ok: true,
            json: async () => ({
                choices: [{ message: { content: 'not-json-at-all' } }],
            }),
            text: async () => '',
        } as Response)
        .mockResolvedValueOnce({
            ok: true,
            json: async () => ({
                choices: [{ message: { content: JSON.stringify(okPayload) } }],
            }),
            text: async () => '',
        } as Response);
}

describe('identityExtraction', () => {
    beforeEach(() => {
        setIdentityStorageAdapter(createInMemoryAdapter());
        resetIdentityExtractionStateForTests();
        resetJsonCompletionStateForTests();
        mockFetch.mockReset();
    });

    afterEach(async () => {
        await clearIdentityProfile();
        resetIdentityStorageAdapter();
        resetIdentityExtractionStateForTests();
        resetJsonCompletionStateForTests();
    });

    it('pre-filter deterministically extracts "my name is" (does not write alone)', () => {
        const patch = extractIdentityDeterministic('Hey, my name is Sigurd and I am tired.');
        expect(patch.preferredName).toBe('Sigurd');
    });

    it('pre-filter deterministically extracts "call me"', () => {
        expect(extractIdentityDeterministic('Please call me Alex.').preferredName).toBe('Alex');
    });

    /**
     * Pre-filter still understands the natural capital-I phrasing that used to
     * miss entirely. What would make this fail: restore IM_NAME_RE without
     * capital-I variants or end-of-string boundary.
     * Store write is AI-only — covered in the AI sabotage test below.
     */
    it('pre-filter extracts bare "I am Sigurd" (capital I, no trailing period)', () => {
        expect(extractIdentityDeterministic('I am Sigurd').preferredName).toBe('Sigurd');
        expect(extractIdentityDeterministic("I'm Sigurd").preferredName).toBe('Sigurd');
        expect(extractIdentityDeterministic('I am Sigurd.').preferredName).toBe('Sigurd');
        expect(extractIdentityDeterministic('Hey, I am Sigurd and work is loud.').preferredName)
            .toBe('Sigurd');
        expect(extractIdentityDeterministic('I am tired').preferredName).toBeUndefined();
        expect(extractIdentityDeterministic('I am fine').preferredName).toBeUndefined();
    });

    it('detects identity signals and ignores pure greetings', () => {
        expect(looksLikeIdentitySignal('hi')).toBe(false);
        expect(looksLikeIdentitySignal('My name is Jordan')).toBe(true);
        expect(looksLikeIdentitySignal('my partner Maya is visiting')).toBe(true);
        expect(looksLikeIdentitySignal('I am Sigurd')).toBe(true);
        expect(looksLikeIdentitySignal("I'm Alex")).toBe(true);
    });

    /**
     * Phase 1: AI is write authority. deterministicOnly remains a test fixture only.
     * What would make this fail: removing the deterministicOnly branch.
     */
    it('test fixture deterministicOnly can still apply without LLM', async () => {
        const profile = await extractAndApplyIdentity('My name is Sigurd.', {
            deterministicOnly: true,
        });
        expect(profile?.preferredName?.value).toBe('Sigurd');
        expect(mockFetch).not.toHaveBeenCalled();
    });

    /**
     * Sabotage target (a): AI extraction catches literal "I am Sigurd" and writes
     * a confirmed preferredName — the phrase that previously never landed.
     * What would make this fail: skip LLM write path; require deterministicOnly
     * to write; or put first capture into pendingCandidate only.
     */
    it('AI path confirms preferredName for literal "I am Sigurd" (not pending)', async () => {
        mockLlmJson({
            preferredName: 'Sigurd',
            pronouns: null,
            about: null,
            keyPeople: [],
            facts: [],
            confidence: 0.91,
        });

        const profile = await extractAndApplyIdentity('I am Sigurd');
        expect(mockFetch).toHaveBeenCalled();
        expect(profile?.preferredName?.value).toBe('Sigurd');
        expect(profile?.preferredName?.pendingCandidate).toBeUndefined();

        const stored = await getIdentityProfile();
        // eslint-disable-next-line no-console
        console.log(
            '[identity-diag] @rosebud_identity_profile after AI "I am Sigurd":',
            JSON.stringify(stored, null, 2),
        );
        expect(stored.preferredName?.value).toBe('Sigurd');
        expect(stored.preferredName?.pendingCandidate).toBeUndefined();
    });

    /**
     * Phase 1 priority: regex alone never writes in production.
     * What would make this fail: mergePatches(prefilter) when LLM fails.
     */
    it('does not write when the flash model errors (regex alone never stores)', async () => {
        mockFetch.mockRejectedValue(new Error('network down'));
        const profile = await extractAndApplyIdentity('My name is Riley.', { forceLlm: true });
        expect(profile).toBeNull();
        const stored = await getIdentityProfile();
        expect(stored.preferredName).toBeUndefined();
    });

    it('retries once on malformed JSON then applies valid second response', async () => {
        mockLlmMalformedThenOk({
            preferredName: 'Sigurd',
            pronouns: null,
            about: null,
            keyPeople: [],
            facts: [],
            confidence: 0.88,
        });
        const profile = await extractAndApplyIdentity('I am Sigurd', { forceLlm: true });
        expect(mockFetch).toHaveBeenCalledTimes(2);
        expect(profile?.preferredName?.value).toBe('Sigurd');
    });

    it('applies LLM people/facts (AI-only write, not regex merge)', async () => {
        mockLlmJson({
            preferredName: 'Sigurd',
            pronouns: null,
            about: 'software engineer',
            keyPeople: [{ name: 'Maya', relation: 'partner' }],
            facts: ['night owl'],
            confidence: 0.8,
        });

        const profile = await extractAndApplyIdentity(
            'My name is Sigurd. My partner Maya and I are night owls — I am a software engineer.',
            { forceLlm: true },
        );

        expect(profile?.preferredName?.value).toBe('Sigurd');
        expect(profile?.about?.value).toContain('software');
        expect(profile?.keyPeople.some((p) => p.name === 'Maya')).toBe(true);
        expect(profile?.facts.some((f) => f.content.includes('night'))).toBe(true);
    });

    /**
     * SABOTAGE 1 (json_object 400 → freeform write):
     * Force structured mode 400 like tencent/hy3; freeform returns valid JSON.
     * Break by: skipping freeform retry in jsonCompletion (no store write).
     */
    it('sabotage: json_object 400 still writes preferredName via freeform fallback', async () => {
        const rejectBody = JSON.stringify({
            error: {
                message: "Model 'tencent/hy3' does not support 'json_object' response format",
                code: 400,
            },
        });
        mockFetch
            .mockResolvedValueOnce({
                ok: false,
                status: 400,
                text: async () => rejectBody,
                json: async () => JSON.parse(rejectBody),
            } as Response)
            .mockResolvedValueOnce({
                ok: true,
                status: 200,
                json: async () => ({
                    choices: [{
                        message: {
                            content: '```json\n{"preferredName":"Sigurd","confidence":0.9,"keyPeople":[],"facts":[]}\n```',
                        },
                    }],
                }),
                text: async () => '',
            } as Response);

        const profile = await extractAndApplyIdentity('I am Sigurd', { forceLlm: true });
        expect(profile?.preferredName?.value).toBe('Sigurd');
        const stored = await getIdentityProfile();
        expect(stored.preferredName?.value).toBe('Sigurd');
        expect(mockFetch).toHaveBeenCalledTimes(2);
        expect(mockFetch.mock.calls[0][0].response_format).toEqual({ type: 'json_object' });
        expect(mockFetch.mock.calls[1][0].response_format).toBeUndefined();
    });

    /**
     * SABOTAGE 2 (freeform parse fail → fail closed, no write):
     * Structured 400 + freeform prose without JSON → null write.
     * Break by: writing regex prefilter when parse fails.
     */
    it('sabotage: freeform garbage after json_object 400 fails closed (no write)', async () => {
        const rejectBody = JSON.stringify({
            error: { message: "does not support 'json_object' response format", code: 400 },
        });
        mockFetch
            .mockResolvedValueOnce({
                ok: false,
                status: 400,
                text: async () => rejectBody,
                json: async () => JSON.parse(rejectBody),
            } as Response)
            .mockResolvedValueOnce({
                ok: true,
                status: 200,
                json: async () => ({
                    choices: [{ message: { content: 'Sorry, I cannot help with that.' } }],
                }),
                text: async () => '',
            } as Response);
        // Outer identity retry will hit freeform-only (model marked rejecting) twice more.
        mockFetch.mockResolvedValue({
            ok: true,
            status: 200,
            json: async () => ({
                choices: [{ message: { content: 'Still not JSON.' } }],
            }),
            text: async () => '',
        } as Response);

        const profile = await extractAndApplyIdentity('I am Sigurd', { forceLlm: true });
        expect(profile).toBeNull();
        const stored = await getIdentityProfile();
        expect(stored.preferredName).toBeUndefined();
    });
});
