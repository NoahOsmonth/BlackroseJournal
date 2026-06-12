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
    it('renders top emotion tags with nuanced, non-generic labels', () => {
        render(<EmotionalLandscapeChart data={nuancedEmotions} />);

        expect(screen.getByText('grieving')).toBeTruthy();
        expect(screen.getByText('hopeful')).toBeTruthy();
        expect(screen.getByText('overwhelmed')).toBeTruthy();
    });

    it('renders emojis that semantically match each emotion', () => {
        render(<EmotionalLandscapeChart data={nuancedEmotions} />);

        expect(screen.getByText('💔')).toBeTruthy();
        expect(screen.getByText('🌅')).toBeTruthy();
        expect(screen.getByText('😰')).toBeTruthy();
        expect(screen.getByText('😌')).toBeTruthy();
    });

    it('uses scores in the 1-10 range to size bars', () => {
        render(<EmotionalLandscapeChart data={nuancedEmotions} />);

        expect(nuancedEmotions.every((e) => e.score >= 1 && e.score <= 10)).toBe(true);
    });

    it('shows an empty state when no emotions are provided', () => {
        render(<EmotionalLandscapeChart data={[]} />);

        expect(screen.getByText('No emotional data yet')).toBeTruthy();
    });
});
