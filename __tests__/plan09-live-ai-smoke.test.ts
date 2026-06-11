/* eslint-disable import/first */
/**
 * Live AI integration test — exercises the real backend at localhost:8787
 * to confirm the intention chat's "AI title" path returns a real title
 * and that morning/evening flows save with the right type and a non-empty
 * AI-generated title.
 *
 * Skipped automatically if the backend is unreachable.
 */

jest.mock('@react-native-async-storage/async-storage', () => {
    const store = new Map<string, string>();
    return {
        __esModule: true,
        default: {
            getItem: async (key: string) => store.get(key) ?? null,
            setItem: async (key: string, value: string) => { store.set(key, value); },
            removeItem: async (key: string) => { store.delete(key); },
            clear: async () => { store.clear(); },
            getAllKeys: async () => Array.from(store.keys()),
            multiGet: async (keys: string[]) => keys.map((k) => [k, store.get(k) ?? null] as [string, string | null]),
            multiSet: async (pairs: [string, string][]) => { pairs.forEach(([k, v]) => store.set(k, v)); },
            multiRemove: async (keys: string[]) => { keys.forEach((k) => store.delete(k)); },
        },
    };
});

import AsyncStorage from '@react-native-async-storage/async-storage';
import {
    finishIntentionChat,
    saveIntentionChatDraft,
} from '../services/intentions/intentionChatCompletion';
import { generateEntryTitle } from '../services/ai';

const BACKEND_URL = process.env.EXPO_PUBLIC_AGENT_BASE_URL ?? 'http://localhost:8787';

async function backendUp(): Promise<boolean> {
    try {
        const res = await fetch(`${BACKEND_URL}/health`);
        const data = await res.json() as { status?: string };
        return data.status === 'ok';
    } catch {
        return false;
    }
}

describe('Live AI title generation (Plan 09 Phase B)', () => {
    beforeEach(async () => {
        await AsyncStorage.clear();
    });

    it('returns a real AI title for the morning flow', async () => {
        if (!(await backendUp())) {
            console.warn('Backend not reachable, skipping live AI test');
            return;
        }

        const userText = 'I want to begin each morning with five minutes of slow breathing and a glass of water before any screens.';
        const title = await generateEntryTitle({ entryText: userText });
        // The title must be a real AI response — not empty, not just the input echoed
        expect(title.length).toBeGreaterThan(0);
        expect(title).not.toBe(userText);
        // Titles should be short (the prompt asks for a title), so cap at 200 chars
        expect(title.length).toBeLessThan(200);

        const { resolvedIntention } = await finishIntentionChat({
            messages: [
                { id: 'u1', role: 'user', content: userText, timestamp: 1 },
                { id: 'a1', role: 'assistant', content: 'How would that feel after a week?', timestamp: 2 },
            ],
            inputValue: '',
            draftCheckInId: null,
            checkInType: 'morning',
            personaId: undefined,
            intention: null,
            isRefineMode: false,
            title,
        });

        const stored = JSON.parse((await AsyncStorage.getItem('@intention_checkins')) ?? '{}');
        const checkIns = Object.values(stored) as { type: string; title: string; status: string }[];
        const morning = checkIns.find((c) => c.type === 'morning');
        expect(morning).toBeDefined();
        expect(morning?.title).toBe(title);
        expect(morning?.status).toBe('completed');
        expect(resolvedIntention).toBeNull(); // morning check-ins don't create intentions
    });

    it('returns a real AI title for the evening flow and keeps it on the evening check-in', async () => {
        if (!(await backendUp())) {
            console.warn('Backend not reachable, skipping live AI test');
            return;
        }

        const userText = 'Today I want to close with a slow walk and notice what went well before sleep.';
        const title = await generateEntryTitle({ entryText: userText });
        expect(title.length).toBeGreaterThan(0);

        await finishIntentionChat({
            messages: [
                { id: 'u1', role: 'user', content: userText, timestamp: 1 },
            ],
            inputValue: '',
            draftCheckInId: null,
            checkInType: 'evening',
            personaId: undefined,
            intention: null,
            isRefineMode: false,
            title,
        });

        const stored = JSON.parse((await AsyncStorage.getItem('@intention_checkins')) ?? '{}');
        const checkIns = Object.values(stored) as { type: string; title: string }[];
        const evening = checkIns.find((c) => c.type === 'evening');
        expect(evening).toBeDefined();
        expect(evening?.title).toBe(title);
    });

    it('falls back to the chat summary when AI is unavailable', async () => {
        // The summary fallback path is exercised by passing title: undefined
        const userText = 'I want to set an intention to take slow mornings.';
        const { resolvedIntention } = await finishIntentionChat({
            messages: [{ id: 'u1', role: 'user', content: userText, timestamp: 1 }],
            inputValue: '',
            draftCheckInId: null,
            checkInType: 'morning',
            personaId: undefined,
            intention: null,
            isRefineMode: false,
            title: undefined, // simulate AI failure
        });

        const stored = JSON.parse((await AsyncStorage.getItem('@intention_checkins')) ?? '{}');
        const checkIns = Object.values(stored) as { type: string; title: string }[];
        const morning = checkIns.find((c) => c.type === 'morning');
        expect(morning).toBeDefined();
        expect(morning?.title).toContain('slow mornings');
        expect(resolvedIntention).toBeNull();
    });

    it('saves a draft with status="draft" that can be loaded back', async () => {
        const draftId = await saveIntentionChatDraft({
            messages: [{ id: 'u1', role: 'user', content: 'Draft message in flight.', timestamp: 1 }],
            inputValue: 'unsent text',
            draftCheckInId: null,
            checkInType: 'morning',
            personaId: undefined,
        });

        expect(draftId).toBeTruthy();
        const stored = JSON.parse((await AsyncStorage.getItem('@intention_checkins')) ?? '{}');
        const draft = stored[draftId as string];
        expect(draft).toBeDefined();
        expect(draft.status).toBe('draft');
        expect(draft.type).toBe('morning');
        // Pending input was appended
        const lastMsg = draft.messages[draft.messages.length - 1];
        expect(lastMsg.content).toBe('unsent text');
    });
});
