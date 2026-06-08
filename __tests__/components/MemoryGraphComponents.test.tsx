import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';

import { MemoryGraphFilters } from '../../components/memory-graph/MemoryGraphFilters';
import { MemoryGraphSheet } from '../../components/memory-graph/MemoryGraphSheet';
import type { LocalMemoryAtom } from '../../services/memory/memoryGraph.types';

jest.mock('../../hooks/use-color-scheme', () => ({
    useColorScheme: () => 'light',
}));

jest.mock('@expo/vector-icons', () => ({
    MaterialIcons: ({ name }: { name: string }) => {
        const React = jest.requireActual('react');
        const { Text } = jest.requireActual('react-native');
        return <Text>{name}</Text>;
    },
}));

const atom: LocalMemoryAtom = {
    id: 'atom-1',
    entryId: 'entry-1',
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

        fireEvent.press(screen.getByLabelText('Toggle profile memories'));

        expect(screen.getByText('episodic')).toBeTruthy();
        expect(onToggle).toHaveBeenCalledWith('profile');
    });

    it('renders selected atom details and synthesis action', () => {
        const onClose = jest.fn();
        const onSynthesize = jest.fn();

        render(
            <MemoryGraphSheet
                atom={atom}
                insight="A useful connection."
                isLoading={false}
                onClose={onClose}
                onSynthesize={onSynthesize}
            />
        );

        fireEvent.press(screen.getByLabelText('Synthesize memory insight'));
        fireEvent.press(screen.getByLabelText('Close memory detail'));

        expect(screen.getByText('Career pressure')).toBeTruthy();
        expect(screen.getByText('A useful connection.')).toBeTruthy();
        expect(onSynthesize).toHaveBeenCalledTimes(1);
        expect(onClose).toHaveBeenCalledTimes(1);
    });
});
