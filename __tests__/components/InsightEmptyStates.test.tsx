import React from 'react';
import { render, screen } from '@testing-library/react-native';

import { CastOfCharacters } from '../../components/insights/CastOfCharacters';
import { KeyThemes } from '../../components/insights/KeyThemes';

describe('insight empty states', () => {
    it('uses actionable copy for empty themes', () => {
        render(<KeyThemes themes={[]} />);

        expect(screen.getByText(/Themes need a few entries/)).toBeTruthy();
        expect(screen.queryByText('Not enough data')).toBeNull();
    });

    it('uses actionable copy for empty people list', () => {
        render(<CastOfCharacters characters={[]} />);

        expect(screen.getByText(/People will appear here/)).toBeTruthy();
        expect(screen.queryByText('Not enough data')).toBeNull();
    });
});
