import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';

import { HistoryEmpty } from '../../components/history/HistoryEmpty';

describe('HistoryEmpty', () => {
    it('shows write CTA for a fully empty ledger', () => {
        const onWrite = jest.fn();
        render(
            <HistoryEmpty hasAnyItems={false} isSearching={false} onWritePress={onWrite} />
        );
        expect(screen.getByText('Nothing written yet')).toBeTruthy();
        // Give the CTA a full 44pt target and a fixed max width so the label
        // cannot be squeezed by a narrow content width.
        const cta = screen.getByLabelText('Write an entry');
        expect(cta.props.className).toContain('min-h-[44px]');
        expect(cta.props.className).toContain('max-w-[220px]');
        fireEvent.press(cta);
        expect(onWrite).toHaveBeenCalled();
    });

    it('explains an empty search and hides the write CTA', () => {
        render(
            <HistoryEmpty hasAnyItems isSearching onWritePress={jest.fn()} />
        );
        expect(screen.getByText('Nothing found')).toBeTruthy();
        expect(screen.queryByLabelText('Write an entry')).toBeNull();
    });
});
