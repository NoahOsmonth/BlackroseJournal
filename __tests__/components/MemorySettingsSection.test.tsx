import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';

import { MemorySettingsSection } from '../../components/settings/MemorySettingsSection';
import type { LocalMemoryAtom } from '../../services/memory/localMemory.types';

jest.mock('../../hooks/use-color-scheme', () => ({
    useColorScheme: () => 'light',
}));

jest.mock('@expo/vector-icons', () => ({
    Ionicons: ({ name }: { name: string }) => {
        const React = jest.requireActual('react');
        const { Text } = jest.requireActual('react-native');
        return <Text>{name}</Text>;
    },
}));

const atoms: LocalMemoryAtom[] = [{
    id: 'profile-1',
    layer: 'profile',
    source: 'journal',
    title: 'About the user',
    content: 'Recent journal pattern: the user wants calmer evenings.',
    tags: ['rest'],
    salience: 0.8,
    confidence: 0.7,
    createdAt: 1,
    updatedAt: 2,
    accessCount: 0,
}];

describe('MemorySettingsSection', () => {
    it('renders memory metrics and opens the Memory hub', () => {
        const onOpenMemoryHub = jest.fn();

        render(
            <MemorySettingsSection
                atoms={atoms}
                isBusy={false}
                onOpenMemoryHub={onOpenMemoryHub}
            />
        );

        fireEvent.press(screen.getByLabelText('Open Memory hub'));

        expect(screen.getByText('Recent journal pattern: the user wants calmer evenings.'))
            .toBeTruthy();
        expect(screen.getByText('Open Memory')).toBeTruthy();
        expect(onOpenMemoryHub).toHaveBeenCalledTimes(1);
    });
});
