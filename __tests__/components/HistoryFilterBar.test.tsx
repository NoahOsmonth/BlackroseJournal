import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';

import { HistoryFilterBar } from '../../components/history/HistoryFilterBar';

describe('HistoryFilterBar', () => {
    it('highlights the active filter and reports changes', () => {
        const onChange = jest.fn();
        render(<HistoryFilterBar value="all" onChange={onChange} />);

        expect(screen.getByLabelText('All')).toBeTruthy();
        fireEvent.press(screen.getByLabelText('Rituals'));
        expect(onChange).toHaveBeenCalledWith('ritual');
    });
});
