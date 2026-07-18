import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';

import { HistoryEmpty } from '../../components/history/HistoryEmpty';

describe('HistoryEmpty', () => {
    it('shows write CTA for a fully empty ledger', () => {
        const onWrite = jest.fn();
        render(
            <HistoryEmpty filter="all" hasAnyItems={false} onWritePress={onWrite} />
        );
        expect(screen.getByText('Nothing written yet')).toBeTruthy();
        fireEvent.press(screen.getByLabelText('Write an entry'));
        expect(onWrite).toHaveBeenCalled();
    });

    it('shows ritual-specific copy without CTA when filtering empty rituals', () => {
        render(
            <HistoryEmpty filter="ritual" hasAnyItems onWritePress={jest.fn()} />
        );
        expect(screen.getByText('No rituals yet')).toBeTruthy();
        expect(screen.queryByLabelText('Write an entry')).toBeNull();
    });
});
