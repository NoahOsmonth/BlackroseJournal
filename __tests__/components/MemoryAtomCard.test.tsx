import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';

import { MemoryAtomCard } from '../../components/memory/MemoryAtomCard';
import type { LocalMemoryAtom } from '../../services/memory/localMemory.types';

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
    id: 'profile-1',
    layer: 'profile',
    source: 'journal',
    title: 'About the user',
    content: 'Recent journal pattern: quieter evenings help.',
    tags: ['rest', 'evening'],
    salience: 0.82,
    confidence: 0.76,
    createdAt: 1,
    updatedAt: 2,
    accessCount: 0,
};

describe('MemoryAtomCard', () => {
    it('shows memory details and exposes tag and delete actions', () => {
        const onDelete = jest.fn();
        const onTagPress = jest.fn();

        render(
            <MemoryAtomCard
                atom={atom}
                onDelete={onDelete}
                onTagPress={onTagPress}
            />
        );

        fireEvent.press(screen.getByLabelText('Filter memory by rest'));
        fireEvent.press(screen.getByLabelText('Delete memory About the user'));

        expect(screen.getByText('About the user')).toBeTruthy();
        expect(screen.getByText('salience 82%')).toBeTruthy();
        expect(screen.getByText('confidence 76%')).toBeTruthy();
        expect(onTagPress).toHaveBeenCalledWith('rest');
        expect(onDelete).toHaveBeenCalledWith(atom);
    });
});
