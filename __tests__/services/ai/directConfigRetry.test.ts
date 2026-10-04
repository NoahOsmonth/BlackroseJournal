/* eslint-disable import/first */

/**
 * A provider-configuration error (`DirectConfigError`) is thrown purely from
 * reading env/settings, before any transport exists — so it can never succeed
 * on retry. The finish-path extracts must fail fast on it (one attempt, no
 * backoff) and surface its actionable message once, not once per step.
 *
 * What would make these fail: reverting the `isDirectConfigError` branch in
 * identityExtraction / sessionDigestBuild / memoryAtomExtraction — attempts
 * return to 2, and the wrapper log ('… failed after retries:') returns.
 */

jest.mock('@react-native-async-storage/async-storage', () => ({
    __esModule: true,
    default: {
        getItem: jest.fn(),
        setItem: jest.fn(),
        removeItem: jest.fn(),
    },
}));

jest.mock('../../../services/ai/aiTransport', () => ({
    fetchAiChatCompletion: jest.fn(),
}));

import { fetchAiChatCompletion } from '../../../services/ai/aiTransport';
import {
    DirectConfigError,
    resetDirectConfigWarningForTests,
} from '../../../services/ai/directConfig';
import { resetJsonCompletionStateForTests } from '../../../services/ai/jsonCompletion';
import {
    extractAndApplyIdentity,
    resetIdentityExtractionStateForTests,
} from '../../../services/memory/identityExtraction';
import { extractMemoryAtoms } from '../../../services/memory/memoryAtomExtraction';
import { buildAndSaveSessionDigest } from '../../../services/memory/sessionDigestBuild';
import {
    resetSessionDigestStorageAdapter,
    setSessionDigestStorageAdapter,
} from '../../../services/memory/sessionDigestStorage';

const mockFetch = jest.mocked(fetchAiChatCompletion);

/** The exact copy services/ai/directConfig.ts throws on a fresh install. */
const CONFIG_MESSAGE =
    'No AI provider is configured. Add a base URL, API key and model in Settings, '
    + 'or set EXPO_PUBLIC_AI_CUSTOM_BASE / EXPO_PUBLIC_AI_CUSTOM_API_KEY in .env.';

const MEMORY_CTX = {
    source: 'journal' as const,
    rootSourceId: 'cfg-mem',
    rootSourceKind: 'journal_entry' as const,
    sessionTitle: 'Quiet evening',
    sessionKindLabel: 'journal entry',
    entryText: 'I am Sigurd. Work was loud and I could not sleep.',
};

function inMemoryAdapter() {
    const store = new Map<string, string>();
    return {
        getItem: async (k: string) => store.get(k) ?? null,
        setItem: async (k: string, v: string) => { store.set(k, v); },
        removeItem: async (k: string) => { store.delete(k); },
        multiGet: async (keys: readonly string[]) =>
            keys.map((k) => [k, store.get(k) ?? null] as [string, string | null]),
        multiRemove: async (keys: readonly string[]) => { keys.forEach((k) => store.delete(k)); },
        getAllKeys: async () => Array.from(store.keys()),
    };
}

describe('DirectConfigError fail-fast in finish-path extracts', () => {
    let warnSpy: jest.SpyInstance;

    beforeEach(() => {
        setSessionDigestStorageAdapter(inMemoryAdapter() as never);
        resetIdentityExtractionStateForTests();
        resetJsonCompletionStateForTests();
        resetDirectConfigWarningForTests();
        mockFetch.mockReset();
        warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    });

    afterEach(() => {
        warnSpy.mockRestore();
        resetSessionDigestStorageAdapter();
        resetIdentityExtractionStateForTests();
        resetJsonCompletionStateForTests();
        resetDirectConfigWarningForTests();
    });

    it('identity: one attempt, no retry, logs the actionable message once', async () => {
        mockFetch.mockRejectedValue(new DirectConfigError(CONFIG_MESSAGE));

        const profile = await extractAndApplyIdentity('I am Sigurd', { forceLlm: true });

        expect(profile).toBeNull();
        expect(mockFetch).toHaveBeenCalledTimes(1); // was 2 before fail-fast
        expect(warnSpy).toHaveBeenCalledTimes(1);
        expect(warnSpy).toHaveBeenCalledWith(CONFIG_MESSAGE);
    });

    it('session digest: one attempt, no retry, still saves the extractive fallback', async () => {
        mockFetch.mockRejectedValue(new DirectConfigError(CONFIG_MESSAGE));

        const saved = await buildAndSaveSessionDigest({
            sessionId: 'cfg-1',
            sourceKind: 'journal_entry',
            sourceId: 'cfg-1',
            userMessages: ['Work was loud and I could not sleep.'],
            now: new Date(2026, 6, 18).getTime(),
        });

        expect(saved).not.toBeNull(); // soft-fail: the digest still saves
        expect(mockFetch).toHaveBeenCalledTimes(1); // was 2 before fail-fast
        expect(warnSpy).toHaveBeenCalledTimes(1);
        expect(warnSpy).toHaveBeenCalledWith(CONFIG_MESSAGE);
    });

    it('memory atoms: logs the actionable message once, not the wrapper', async () => {
        mockFetch.mockRejectedValue(new DirectConfigError(CONFIG_MESSAGE));

        const atoms = await extractMemoryAtoms(MEMORY_CTX);

        expect(atoms).toEqual([]);
        expect(mockFetch).toHaveBeenCalledTimes(1);
        expect(warnSpy).toHaveBeenCalledTimes(1);
        expect(warnSpy).toHaveBeenCalledWith(CONFIG_MESSAGE);
        expect(warnSpy).not.toHaveBeenCalledWith('AI memory extraction failed:', expect.anything());
    });

    it('a single finish turn prints the config message exactly once across all steps', async () => {
        mockFetch.mockRejectedValue(new DirectConfigError(CONFIG_MESSAGE));

        await extractMemoryAtoms(MEMORY_CTX);
        await extractAndApplyIdentity('I am Sigurd', { forceLlm: true });
        await buildAndSaveSessionDigest({
            sessionId: 'cfg-2',
            sourceKind: 'journal_entry',
            sourceId: 'cfg-2',
            userMessages: ['I am Sigurd. Work was loud.'],
            now: Date.now(),
        });

        expect(mockFetch).toHaveBeenCalledTimes(3); // one attempt per step, no retries
        expect(warnSpy).toHaveBeenCalledTimes(1);    // deduped to a single line
        expect(warnSpy).toHaveBeenCalledWith(CONFIG_MESSAGE);
    });

    it('still retries a transient error (retry policy unchanged)', async () => {
        mockFetch.mockRejectedValue(new Error('network down'));

        const profile = await extractAndApplyIdentity('I am Sigurd', { forceLlm: true });

        expect(profile).toBeNull();
        expect(mockFetch).toHaveBeenCalledTimes(2); // MAX_LLM_ATTEMPTS still applies
        // The transient path keeps its wrapper log, not the config message.
        expect(warnSpy).toHaveBeenCalledWith(
            'Identity LLM extraction failed after retries:',
            expect.any(Error),
        );
    });
});
