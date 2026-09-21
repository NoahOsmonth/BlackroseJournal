import React from 'react';
import { fireEvent, render, waitFor } from '@testing-library/react-native';

import EntryDetailScreen from '../../app/entry-detail';
import { getLocalDateKey, formatLocalTime } from '@/utils/date';
import type { JournalEntry } from '@/services/journal/journalStorage.types';

jest.mock('@expo/vector-icons', () => ({
    MaterialIcons: () => null,
}));

jest.mock('expo-router', () => ({
    useLocalSearchParams: () => ({ id: 'entry-1' }),
    useRouter: () => ({ canGoBack: () => false, back: jest.fn(), replace: jest.fn() }),
}));

jest.mock('react-native-safe-area-context', () => ({
    SafeAreaView: ({ children }: { children: React.ReactNode }) => {
        const { View } = jest.requireActual('react-native');
        return <View>{children}</View>;
    },
    useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

jest.mock('@/hooks/use-color-scheme', () => ({
    useColorScheme: () => 'light',
}));

jest.mock('@/hooks/useThemeSettings', () => ({
    useThemeSettings: () => ({
        colorTheme: {
            colors: {
                accentLight: '#AA5500',
                accentDark: '#FFCC88',
                appTextLight: '#111827',
                appTextDark: '#F9FAFB',
                secondaryTextLight: '#6B7280',
                secondaryTextDark: '#9CA3AF',
                chatUserTextLight: '#445566',
                chatUserTextDark: '#DDEEFF',
                chatAiTextLight: '#123ABC',
                chatAiTextDark: '#89ABCD',
            },
        },
    }),
}));

jest.mock('@/services/ai', () => ({
    generateEntryAnalysis: jest.fn(),
}));

// `react-native-marked` ships ESM whose `export` fails to transform under the
// Expo preset; the screen renders ChatMessage, which pulls it in. Same shim as
// `__tests__/ChatMessage.test.tsx`.
jest.mock('react-native-marked', () => {
    const React = jest.requireActual('react');
    const { Text: RNText } = jest.requireActual('react-native');
    return function MockMarkdown({ value }: { value: string }) {
        return React.createElement(RNText, { testID: 'markdown' }, value);
    };
});

const mockEntry: { current: JournalEntry } = {
    current: {
        id: 'entry-1',
        title: 'A calm morning',
        emoji: '📝',
        messages: [{ id: 'm1', role: 'user', content: 'Hello', timestamp: 1 }],
        status: 'completed',
        createdAt: Date.UTC(2026, 8, 19, 6, 30),
        updatedAt: Date.UTC(2026, 8, 19, 6, 30),
        // Present so the backfill effect short-circuits; without it the screen
        // fires `generateEntryAnalysis` asynchronously and the tree churns.
        analysis: {
            insight: 'Steady.',
            quote: 'Hello',
            mood: 'calm',
            topics: ['rest'],
            generatedAt: 1,
        },
    },
};

// Stable identities, matching the real hook's `useCallback`s: a fresh
// `getById` each render would re-run the screen's load effect and clobber the
// entry that `setEntry(updated)` just installed.
jest.mock('@/hooks/journal/useJournalEntries', () => {
    const getById = async () => mockEntry.current;
    const update = async () => mockEntry.current;
    return {
        useJournalEntries: () => ({ getById, update }),
    };
});

/** What the next `saveText` call resolves to (defaults to the current entry). */
const mockSaveResult: { current: JournalEntry | null } = { current: null };

jest.mock('@/hooks/journal/useJournalEntryActions', () => ({
    useJournalEntryActions: () => ({
        isSaving: false,
        isDeleting: false,
        error: null,
        saveText: async () => mockSaveResult.current ?? mockEntry.current,
        remove: async () => true,
        clearError: jest.fn(),
    }),
}));

/** The exact base label the screen builds, from the same helpers it uses. */
function expectedBaseLabel(entry: JournalEntry): string {
    const authored = new Date(entry.createdAt);
    return `Written ${getLocalDateKey(authored)} · ${formatLocalTime(authored)}`;
}

function renderWithOrigin(origin: JournalEntry['origin']) {
    mockEntry.current = { ...mockEntry.current, origin };
    return render(<EntryDetailScreen />);
}

describe('EntryDetailScreen authored-label provenance', () => {
    beforeEach(() => {
        mockSaveResult.current = null;
    });

    it('appends Written on Threads for a threads entry', async () => {
        const { findByText } = renderWithOrigin('threads');

        const base = expectedBaseLabel(mockEntry.current);
        expect(await findByText(`${base} · Written on Threads`)).toBeTruthy();
    });

    it('does not append an origin suffix for a chat entry', async () => {
        const { findByText, queryByText } = renderWithOrigin('chat');

        const base = expectedBaseLabel(mockEntry.current);
        expect(await findByText(base)).toBeTruthy();
        // The half the guard protects: no suffix, and specifically no "Journal".
        expect(queryByText(`${base} · Journal`)).toBeNull();
        expect(queryByText(`${base} · Written on Threads`)).toBeNull();
    });

    it('renders a pre-Explore entry (no origin) byte-identically to the chat case', async () => {
        const chat = renderWithOrigin('chat');
        const chatLabel = expectedBaseLabel(mockEntry.current);
        expect(await chat.findByText(chatLabel)).toBeTruthy();
        chat.unmount();

        const legacy = renderWithOrigin(undefined);
        const legacyLabel = expectedBaseLabel(mockEntry.current);
        expect(legacyLabel).toBe(chatLabel);
        expect(await legacy.findByText(legacyLabel)).toBeTruthy();
        expect(legacy.queryByText(`${legacyLabel} · Journal`)).toBeNull();
    });

    it('relabels after a save swaps in a threads origin with the same createdAt', async () => {
        // A save replaces the whole `entry` (setEntry(updated)) and keeps
        // createdAt, so the label memo must recompute on `origin` alone.
        const { findByLabelText, findByText, queryByText } =
            renderWithOrigin('chat');

        const base = expectedBaseLabel(mockEntry.current);
        expect(await findByText(base)).toBeTruthy();

        mockSaveResult.current = { ...mockEntry.current, origin: 'threads' };

        fireEvent.press(await findByLabelText('Entry actions'));
        fireEvent.press(await findByText('Edit entry'));
        fireEvent.press(await findByLabelText('Save entry'));

        // The stale-memo symptom: the old suffix-less label survives the swap.
        expect(await findByText(`${base} · Written on Threads`)).toBeTruthy();
        await waitFor(() => expect(queryByText(base)).toBeNull());
    });
});
