/* eslint-disable import/first */
/**
 * Memory v2 §9 golden: preferred name survives across sessions without capsule ranking.
 *
 * What specific code change would make these tests fail?
 * - Stop calling extractAndApplyIdentity / extractIdentityFromSessionTranscript (write path)
 * - Stop injecting identityContext into composeSystemPrompt / freeform flow (read path)
 * - buildIdentityContext always returns undefined even when preferredName is stored
 * - AI extract path never applies preferredName from structured JSON
 * Any of those leave Session B's composed prompt without "Preferred name: Sigurd".
 */

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
import { THERAPIST_SYSTEM_PROMPT } from '../../../constants/aiPrompts';
import { FLOWS, composeSystemPrompt } from '../../../features/chat/flows';
import {
    extractAndApplyIdentity,
    extractIdentityFromSessionTranscript,
    resetIdentityExtractionStateForTests,
} from '../../../services/memory/identityExtraction';
import {
    buildIdentityContext,
    clearIdentityProfile,
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

function mockIdentityLlm(name = 'Sigurd'): void {
    mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
            choices: [{
                message: {
                    content: JSON.stringify({
                        preferredName: name,
                        pronouns: null,
                        about: null,
                        keyPeople: [],
                        facts: [],
                        confidence: 0.93,
                    }),
                },
            }],
        }),
        text: async () => '',
    } as Response);
}

/** Session B: fresh freeform compose with a competing (non-name) capsule. */
async function composeSessionBPrompt(): Promise<string> {
    const identityContext = await buildIdentityContext();
    return FLOWS.freeform.buildSystemPrompt({
        now: new Date(2026, 6, 17, 10, 0, 0).getTime(),
        identityContext,
        // Capsule must not be required for the name — fill it with unrelated text.
        localMemoryContext:
            '## Local Memory Capsule\n- (2026-07-16) work stress about deadlines, no personal names',
    });
}

describe('identity name survives session (Memory v2 §9 golden)', () => {
    beforeEach(() => {
        setIdentityStorageAdapter(createInMemoryAdapter());
        resetIdentityExtractionStateForTests();
        mockFetch.mockReset();
        mockIdentityLlm('Sigurd');
    });

    afterEach(async () => {
        await clearIdentityProfile();
        resetIdentityStorageAdapter();
        resetIdentityExtractionStateForTests();
    });

    it('Session A states name mid-chat without Finish → Session B Identity block has it', async () => {
        // Session A: turn-level AI extract only (abandoned chat — no Finish).
        // Literal production bug phrase: capital I, bare name.
        const applied = await extractAndApplyIdentity('I am Sigurd');
        expect(mockFetch).toHaveBeenCalled();
        expect(applied?.preferredName?.value).toBe('Sigurd');
        expect(applied?.preferredName?.pendingCandidate).toBeUndefined();

        // eslint-disable-next-line no-console
        console.log(
            '[identity-diag] Session A store after AI "I am Sigurd":',
            JSON.stringify(applied, null, 2),
        );

        // Session B: new freeform session prompt weave (fresh buildIdentityContext read).
        const prompt = await composeSessionBPrompt();

        // eslint-disable-next-line no-console
        console.log(
            '[identity-diag] Session B Identity slice:',
            (await buildIdentityContext()) ?? '<EMPTY — bug>',
        );

        expect(prompt).toContain(THERAPIST_SYSTEM_PROMPT);
        expect(prompt).toContain('## Identity');
        expect(prompt).toContain('Preferred name: Sigurd');
        expect(prompt).toContain('Local Memory Capsule');
        expect(prompt.indexOf('## Identity')).toBeLessThan(prompt.indexOf('Local Memory Capsule'));
    });

    it('Session A states name and Finish backstop runs → Session B Identity block has it', async () => {
        const applied = await extractIdentityFromSessionTranscript([
            'hello',
            'Just checking in',
            'I am Sigurd — please use that.',
        ]);
        expect(applied?.preferredName?.value).toBe('Sigurd');

        const prompt = await composeSessionBPrompt();
        expect(prompt).toContain('Preferred name: Sigurd');
        expect(prompt).toContain('## Identity');
    });

    it('composeSystemPrompt still carries name when capsule context is omitted', async () => {
        await extractAndApplyIdentity('Please call me Sigurd.');
        const identityContext = await buildIdentityContext();
        const out = composeSystemPrompt(THERAPIST_SYSTEM_PROMPT, {
            now: Date.now(),
            identityContext,
        });
        expect(out).toContain('## Identity');
        expect(out).toContain('Preferred name: Sigurd');
        expect(identityContext).toBeDefined();
        expect(identityContext).toContain('Preferred name: Sigurd');
    });
});
