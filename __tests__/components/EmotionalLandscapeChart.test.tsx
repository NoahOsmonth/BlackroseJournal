import React from 'react';
import { render, screen } from '@testing-library/react-native';

import { EmotionalLandscapeChart } from '../../components/insights/EmotionalLandscapeChart';

const nuancedEmotions = [
    { emotion: 'grieving', score: 9, emoji: '💔' },
    { emotion: 'hopeful', score: 6, emoji: '🌅' },
    { emotion: 'overwhelmed', score: 8, emoji: '😰' },
    { emotion: 'content', score: 4, emoji: '😌' },
];

describe('EmotionalLandscapeChart', () => {
    it('names the two strongest emotions under the rail', () => {
        render(<EmotionalLandscapeChart data={nuancedEmotions} />);

        // Concept shows exactly two end labels beneath a hairline rail.
        expect(screen.getByText('grieving')).toBeTruthy();
        expect(screen.getByText('hopeful')).toBeTruthy();
        expect(screen.queryByText('overwhelmed')).toBeNull();
        expect(screen.queryByText('content')).toBeNull();
    });

    it('places one dot per emotion on the rail, positioned by score', () => {
        render(<EmotionalLandscapeChart data={nuancedEmotions} />);

        expect(screen.getByLabelText('grieving 9 of 10')).toBeTruthy();
        expect(screen.getByLabelText('hopeful 6 of 10')).toBeTruthy();
    });

    it('renders no emoji — the rail is typographic', () => {
        render(<EmotionalLandscapeChart data={nuancedEmotions} />);

        expect(screen.queryByText('💔')).toBeNull();
        expect(screen.queryByText('😰')).toBeNull();
    });

    it('shows the empty state when no emotions are provided', () => {
        render(<EmotionalLandscapeChart data={[]} />);

        expect(screen.getByText('Not enough data')).toBeTruthy();
    });
});
