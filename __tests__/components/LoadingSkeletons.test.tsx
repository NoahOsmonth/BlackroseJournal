import { render, screen } from '@testing-library/react-native';
import React from 'react';

import { mockReanimated } from '../mocks/reanimatedMock';

jest.mock('react-native-reanimated', () => mockReanimated());

import { EntryDetailSkeleton } from '../../components/entries/EntryDetailSkeleton';
import { EntryReflectionSkeleton } from '../../components/entries/EntryReflectionSkeleton';
import { HistorySkeleton } from '../../components/history/HistorySkeleton';
import { SuggestionsSkeleton } from '../../components/entries/SuggestionsSkeleton';
import { CheckInDetailSkeleton } from '../../components/intentions/CheckInDetailSkeleton';
import { IntentionFormSkeleton } from '../../components/intentions/IntentionFormSkeleton';
import { MemoryHubSkeleton } from '../../components/memory/MemoryHubSkeleton';
import { PersonaGenerateSkeleton } from '../../components/personas/PersonaGenerateSkeleton';
import { StreakHaikuSkeleton } from '../../components/streak/StreakHaikuSkeleton';


describe('composed loading skeletons', () => {
    it.each([
        ['entry detail', EntryDetailSkeleton, 'Loading entry'],
        ['entry reflection', EntryReflectionSkeleton, 'Loading reflection'],
        ['suggestions', SuggestionsSkeleton, 'Loading suggestions'],
        ['check-in detail', CheckInDetailSkeleton, 'Loading check-in'],
        ['intention form', IntentionFormSkeleton, 'Loading intention'],
        ['memory hub', MemoryHubSkeleton, 'Loading memory'],
        ['persona generation', PersonaGenerateSkeleton, 'Crafting persona'],
        ['streak haiku', StreakHaikuSkeleton, 'Loading haiku'],
    ])('renders an accessible %s placeholder', (_name, Component, label) => {
        render(<Component />);
        expect(screen.getByLabelText(label)).toBeTruthy();
    });

    it('uses multiple shaped blocks in the reflection placeholder', () => {
        render(<EntryReflectionSkeleton />);
        expect(screen.getAllByLabelText(/Loading (reflection text line|feedback|insight|suggestions)/).length).toBeGreaterThan(8);
    });

    it('gives history and memory loading a visible, named status', () => {
        const memory = render(<MemoryHubSkeleton />);
        expect(memory.getByLabelText('Gathering your memories')).toBeTruthy();

        const history = render(<HistorySkeleton />);
        expect(history.getByLabelText('Loading your history')).toBeTruthy();
    });
});
