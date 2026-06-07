import React from 'react';
import { render } from '@testing-library/react-native';

import { EntryAnalysisPanel } from '../../components/entries/EntryAnalysisPanel';

describe('EntryAnalysisPanel', () => {
    it('renders insight quote mood and topics for history entries', () => {
        const { getByText } = render(
            <EntryAnalysisPanel
                analysis={{
                    insight: 'You need more spacious mornings.',
                    quote: 'Leave room for your own pace.',
                    mood: 'Hopeful',
                    topics: ['Morning', 'Energy'],
                    generatedAt: 0,
                }}
            />
        );

        expect(getByText('Insight')).toBeTruthy();
        expect(getByText('You need more spacious mornings.')).toBeTruthy();
        expect(getByText('"Leave room for your own pace."')).toBeTruthy();
        expect(getByText('Hopeful')).toBeTruthy();
        expect(getByText('Morning')).toBeTruthy();
        expect(getByText('Energy')).toBeTruthy();
    });
});
