/* eslint-disable import/first */
/**
 * Finish-path session digest builder.
 * Mocks network (chat + embeddings), not storage/ranking logic.
 *
 * What would make these fail?
 * - Skipping upsert after LLM success
 * - Requiring embeddings to store a digest (offline must still save text)
 * - Writing without going through sharded storage
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
import { resetJsonCompletionStateForTests } from '../../../services/ai/jsonCompletion';
import {
    buildAndSaveSessionDigest,
    parseDigestJson,
} from '../../../services/memory/sessionDigestBuild';
import {
    clearSessionDigests,
    getSessionDigest,
    resetSessionDigestStorageAdapter,
    setSessionDigestStorageAdapter,
} from '../../../services/memory/sessionDigestStorage';

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
        multiGet: async (keys: readonly string[]) =>
            keys.map((k) => [k, store.get(k) ?? null] as [string, string | null]),
        multiRemove: async (keys: readonly string[]) => {
            keys.forEach((k) => store.delete(k));
        },
        getAllKeys: async () => Array.from(store.keys()),
    };
}

const mockFetch = jest.mocked(fetchDirectChatCompletion);

describe('buildAndSaveSessionDigest', () => {
    beforeEach(() => {
        setSessionDigestStorageAdapter(createInMemoryAdapter());
        resetJsonCompletionStateForTests();
        mockFetch.mockReset();
    });

    afterEach(async () => {
        await clearSessionDigests();
        resetSessionDigestStorageAdapter();
        resetJsonCompletionStateForTests();
    });

    it('saves summary and topics from the LLM call', async () => {
        mockFetch.mockResolvedValue({
            ok: true,
            json: async () => ({
                choices: [{
                    message: {
                        content: JSON.stringify({
                            oneLineSummary: 'User felt crushed by deadlines and short sleep.',
                            topics: ['work stress', 'sleep'],
                        }),
                    },
                }],
            }),
            text: async () => '',
        } as Response);

        const saved = await buildAndSaveSessionDigest({
            sessionId: 'j1',
            sourceKind: 'journal_entry',
            sourceId: 'j1',
            userMessages: ['Work is crushing me and I cannot sleep.'],
            now: new Date(2026, 6, 17, 21, 0, 0).getTime(),
        });

        expect(saved?.oneLineSummary).toContain('deadlines');
        expect(saved?.topics).toEqual(expect.arrayContaining(['work stress', 'sleep']));
        expect(saved?.dateISO).toBe('2026-07-17');
        expect(mockFetch).toHaveBeenCalled();

        const loaded = await getSessionDigest('j1');
        expect(loaded?.entryWordCount).toBeGreaterThan(0);
    });

    /**
     * Offline / embed fail: still persist text digest (Phase 3 date-range path).
     * What would make this fail: requiring non-empty embedding to upsert.
     */
    it('still stores the text digest offline', async () => {
        mockFetch.mockResolvedValue({
            ok: true,
            json: async () => ({
                choices: [{
                    message: {
                        content: JSON.stringify({
                            oneLineSummary: 'Talked about family dinner.',
                            topics: ['family'],
                        }),
                    },
                }],
            }),
            text: async () => '',
        } as Response);

        const saved = await buildAndSaveSessionDigest({
            sessionId: 'j2',
            sourceKind: 'journal_entry',
            sourceId: 'j2',
            userMessages: ['Dinner with my sister was good.'],
            now: Date.now(),
        });

        expect(saved?.oneLineSummary).toContain('family');
        expect(await getSessionDigest('j2')).not.toBeNull();
    });

    it('falls back to extractive summary when the LLM fails', async () => {
        mockFetch.mockRejectedValue(new Error('flash down'));

        const saved = await buildAndSaveSessionDigest({
            sessionId: 'j3',
            sourceKind: 'intention_checkin',
            sourceId: 'j3',
            userMessages: ['Morning focus on calm breathing exercises today.'],
            now: Date.now(),
        });

        expect(saved?.oneLineSummary).toMatch(/Journaled about|calm breathing/i);
        expect(saved?.sourceKind).toBe('intention_checkin');
    });

    /**
     * Routes through fetchDirectJsonCompletion: json_object 400 → freeform summary.
     * Break by: session digest calling fetchDirectChatCompletion with json_object only.
     */
    it('saves LLM summary via freeform when json_object is rejected (400)', async () => {
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
                json: async () => ({
                    choices: [{
                        message: {
                            content: 'Summary JSON:\n{"oneLineSummary":"Talked about sister and sleep.","topics":["family","sleep"]}',
                        },
                    }],
                }),
                text: async () => '',
            } as Response);

        const saved = await buildAndSaveSessionDigest({
            sessionId: 'j-freeform',
            sourceKind: 'journal_entry',
            sourceId: 'j-freeform',
            userMessages: ['I am tired after dinner with my sister.'],
            now: Date.now(),
        });

        expect(saved?.oneLineSummary).toContain('sister');
        expect(saved?.topics).toEqual(expect.arrayContaining(['family', 'sleep']));
        expect(mockFetch.mock.calls[0][0].response_format).toEqual({ type: 'json_object' });
        expect(mockFetch.mock.calls[1][0].response_format).toBeUndefined();
    });

    it('returns null for empty transcripts', async () => {
        const saved = await buildAndSaveSessionDigest({
            sessionId: 'empty',
            sourceKind: 'journal_entry',
            sourceId: 'empty',
            userMessages: ['  ', ''],
        });
        expect(saved).toBeNull();
        expect(mockFetch).not.toHaveBeenCalled();
    });

    /**
     * T6 eventDate: LLM returns absolute ISO → stored on digest.
     * What would make this fail: dropping eventDate from parse/upsert.
     */
    it('stores absolute eventDate from LLM when present', async () => {
        mockFetch.mockResolvedValue({
            ok: true,
            json: async () => ({
                choices: [{
                    message: {
                        content: JSON.stringify({
                            oneLineSummary: 'Has a dentist appointment on Friday.',
                            topics: ['dentist', 'health'],
                            eventDate: '2026-07-24',
                        }),
                    },
                }],
            }),
            text: async () => '',
        } as Response);

        const saturday = new Date(2026, 6, 18, 15, 0, 0).getTime();
        const saved = await buildAndSaveSessionDigest({
            sessionId: 'dentist-1',
            sourceKind: 'journal_entry',
            sourceId: 'dentist-1',
            userMessages: ['I have a dentist appointment on Friday.'],
            now: saturday,
        });

        expect(saved?.dateISO).toBe('2026-07-18');
        expect(saved?.eventDate).toBe('2026-07-24');
        expect((await getSessionDigest('dentist-1'))?.eventDate).toBe('2026-07-24');
    });

    /**
     * Relative "Friday" from model → normalize to upcoming Friday on write day Saturday.
     */
    it('normalizes relative Friday eventDate against fixed Saturday write clock', async () => {
        mockFetch.mockResolvedValue({
            ok: true,
            json: async () => ({
                choices: [{
                    message: {
                        content: JSON.stringify({
                            oneLineSummary: 'Dentist on Friday.',
                            topics: ['dentist'],
                            eventDate: 'Friday',
                        }),
                    },
                }],
            }),
            text: async () => '',
        } as Response);

        const saturday = new Date(2026, 6, 18, 12, 0, 0).getTime();
        const saved = await buildAndSaveSessionDigest({
            sessionId: 'dentist-rel',
            sourceKind: 'journal_entry',
            sourceId: 'dentist-rel',
            userMessages: ['I have a dentist appointment on Friday.'],
            now: saturday,
        });
        expect(saved?.eventDate).toBe('2026-07-24');
    });

    /**
     * Malformed eventDate → null + warn; digest still succeeds.
     * What would make this fail: throwing on bad eventDate or dropping the whole digest.
     */
    it('stores null eventDate and warns when model returns malformed date; write still succeeds', async () => {
        const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
        mockFetch.mockResolvedValue({
            ok: true,
            json: async () => ({
                choices: [{
                    message: {
                        content: JSON.stringify({
                            oneLineSummary: 'Thoughts about the future.',
                            topics: ['mood'],
                            eventDate: 'sometime-soon-ish',
                        }),
                    },
                }],
            }),
            text: async () => '',
        } as Response);

        const saved = await buildAndSaveSessionDigest({
            sessionId: 'bad-event',
            sourceKind: 'journal_entry',
            sourceId: 'bad-event',
            userMessages: ['I feel weird about something coming up.'],
            now: new Date(2026, 6, 18).getTime(),
        });

        expect(saved).not.toBeNull();
        expect(saved?.oneLineSummary).toContain('future');
        expect(saved?.eventDate).toBeNull();
        expect(warnSpy).toHaveBeenCalledWith(
            expect.stringContaining('[eventDate]'),
            expect.anything(),
        );
        warnSpy.mockRestore();
    });

    it('parseDigestJson normalizes bare Friday against write day without network', () => {
        const saturday = new Date(2026, 6, 18);
        const parsed = parseDigestJson(
            JSON.stringify({
                oneLineSummary: 'Dentist Friday',
                topics: ['dentist'],
                eventDate: 'Friday',
            }),
            saturday,
        );
        expect(parsed?.eventDate).toBe('2026-07-24');
        expect(parseDigestJson(
            JSON.stringify({ oneLineSummary: 'ok', topics: [], eventDate: null }),
            saturday,
        )?.eventDate).toBeNull();
    });

    /**
     * Test B day-slip investigation: dateISO is the Finish/write local day,
     * NOT a weekday parsed from user prose ("on Sunday").
     * What would make this fail: deriving dateISO from transcript content.
     */
    it('sets dateISO from finish timestamp even when user text says a different weekday', async () => {
        mockFetch.mockResolvedValue({
            ok: true,
            json: async () => ({
                choices: [{
                    message: {
                        content: JSON.stringify({
                            oneLineSummary:
                                'Had lunch with sister and kids on Sunday (pasta and juice).',
                            topics: ['family', 'lunch'],
                        }),
                    },
                }],
            }),
            text: async () => '',
        } as Response);

        // Saturday 2026-07-18 afternoon — same shape as the live Test B device day.
        const saturdayFinish = new Date(2026, 6, 18, 14, 30, 0).getTime();
        const saved = await buildAndSaveSessionDigest({
            sessionId: 'j-dayslip',
            sourceKind: 'journal_entry',
            sourceId: 'j-dayslip',
            userMessages: [
                'I had lunch with my sister and her kids on Sunday. We ate pasta and drank juice.',
            ],
            now: saturdayFinish,
        });

        expect(saved?.dateISO).toBe('2026-07-18'); // Saturday write day
        expect(saved?.dateISO).not.toBe('2026-07-12'); // prior Sunday (event day in prose)
        // Summary may still mention Sunday — event day lives in free text only.
        expect(saved?.oneLineSummary.toLowerCase()).toContain('sunday');
    });
});
