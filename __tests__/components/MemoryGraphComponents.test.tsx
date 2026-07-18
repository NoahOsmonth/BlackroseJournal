import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';

import { MemoryGraphFilters } from '../../components/memory-graph/MemoryGraphFilters';
import { MemoryGraphSheet } from '../../components/memory-graph/MemoryGraphSheet';
import type { MemoryGraphAtom } from '../../services/memory/memoryGraph.types';

jest.mock('../../hooks/use-color-scheme', () => ({
    useColorScheme: () => 'light',
}));

jest.mock('react-native-safe-area-context', () => ({
    useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

jest.mock('@expo/vector-icons', () => ({
    MaterialIcons: ({ name }: { name: string }) => {
        const React = jest.requireActual('react');
        const { Text } = jest.requireActual('react-native');
        return <Text>{name}</Text>;
    },
}));

const atom: MemoryGraphAtom = {
    id: 'atom-1',
    entryId: 'entry-1',
    source: 'journal',
    sourceId: 'entry-1',
    rootSourceId: 'entry-1',
    rootSourceKind: 'journal_entry',
    title: 'Career pressure',
    content: 'The user wants recovery after career pressure.',
    layer: 'episodic',
    salience: 7,
    confidence: 0.8,
    tags: ['career', 'rest'],
    createdAt: '2026-01-01T00:00:00.000Z',
};

describe('MemoryGraph components', () => {
    it('renders layer filters and toggles a memory layer', () => {
        const onToggle = jest.fn();

        render(
            <MemoryGraphFilters
                activeLayers={new Set(['episodic', 'profile'])}
                onToggle={onToggle}
            />
        );

        fireEvent.press(screen.getByLabelText('Toggle About me memories'));

        expect(screen.getByText('Episodes')).toBeTruthy();
        expect(onToggle).toHaveBeenCalledWith('profile');
    });

    it('keeps layer filters tall enough for Android text rendering', () => {
        render(
            <MemoryGraphFilters
                activeLayers={new Set(['episodic', 'profile'])}
                onToggle={jest.fn()}
            />
        );

        expect(screen.getByTestId('memory-layer-filters').props.contentContainerStyle)
            .toMatchObject({ minHeight: 64, paddingVertical: 12 });
        expect(screen.getByTestId('memory-layer-filter-episodic').props.className)
            .toContain('min-h-10');
        expect(screen.getByText('Episodes').props.style).toMatchObject({ lineHeight: 16 });
        expect(screen.getByText('Themes').props.numberOfLines).toBe(1);
        expect(screen.getByText('About me').props.numberOfLines).toBe(1);
    });

    it('renders selected atom with local insight, source open, and deepen action', () => {
        const onClose = jest.fn();
        const onDeepen = jest.fn();
        const onOpenSource = jest.fn();

        render(
            <MemoryGraphSheet
                atom={atom}
                localInsight="That walk after work still softens the career pressure you carry."
                remoteInsight="A useful connection."
                isDeepening={false}
                sourcePreview={{
                    kind: 'journal_entry',
                    id: 'entry-1',
                    title: 'Career pressure day',
                    emoji: '💼',
                    dateLabel: 'Jan 1, 2026',
                    mood: 'Tense',
                    snippet: 'Long week at work.',
                    messageCount: 2,
                }}
                isSourceLoading={false}
                sourceMissing={false}
                relatedAtoms={[]}
                onClose={onClose}
                onDeepen={onDeepen}
                onOpenSource={onOpenSource}
            />
        );

        fireEvent.press(screen.getByLabelText('Open conversation'));
        fireEvent.press(screen.getByLabelText('Deepen with AI'));
        fireEvent.press(screen.getByLabelText('Close memory detail'));

        expect(screen.getByText('Career pressure')).toBeTruthy();
        expect(screen.getByText(/still softens the career pressure/)).toBeTruthy();
        expect(screen.getByText('A useful connection.')).toBeTruthy();
        expect(screen.getByText('Career pressure day')).toBeTruthy();
        expect(onOpenSource).toHaveBeenCalledTimes(1);
        expect(onDeepen).toHaveBeenCalledTimes(1);
        expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('truncates a remote insight longer than 50 words to 50 words', () => {
        const longInsight = Array.from({ length: 100 }, (_, i) => `word${i + 1}`).join(' ');

        render(
            <MemoryGraphSheet
                atom={atom}
                localInsight={null}
                remoteInsight={longInsight}
                isDeepening={false}
                sourcePreview={null}
                isSourceLoading={false}
                sourceMissing={false}
                relatedAtoms={[]}
                onClose={jest.fn()}
                onDeepen={jest.fn()}
                onOpenSource={jest.fn()}
            />
        );

        const insightText = screen.getByText(/word1 /).props.children;
        const wordCount = (String(insightText).match(/\b\w+\b/g) ?? []).length;

        expect(wordCount).toBeLessThanOrEqual(50);
        expect(String(insightText)).toMatch(/\.\.\.$/);
    });
});
