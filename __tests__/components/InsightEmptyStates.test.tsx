import React from 'react';
import { render, screen } from '@testing-library/react-native';

import { CastOfCharacters } from '../../components/insights/CastOfCharacters';
import { KeyThemes } from '../../components/insights/KeyThemes';

jest.mock('@expo/vector-icons', () => ({
    MaterialIcons: ({ name }: { name: string }) => {
        const React = jest.requireActual('react');
        const { Text } = jest.requireActual('react-native');
        return <Text>{name}</Text>;
    },
}));

jest.mock('../../hooks/use-color-scheme', () => ({
    useColorScheme: () => 'light',
}));

describe('insight empty states', () => {
    it('uses actionable copy for empty themes', () => {
        render(<KeyThemes themes={[]} />);

        expect(screen.getByText('Themes need a few entries')).toBeTruthy();
        expect(screen.queryByText('Not enough data')).toBeNull();
    });

    it('uses actionable copy for empty cast of characters', () => {
        render(<CastOfCharacters characters={[]} />);

        expect(screen.getByText('People will appear here')).toBeTruthy();
        expect(screen.queryByText('Not enough data')).toBeNull();
    });
});
