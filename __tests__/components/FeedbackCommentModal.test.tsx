import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';

import { FeedbackCommentModal } from '../../components/intentions/FeedbackCommentModal';

jest.mock('@expo/vector-icons', () => ({
    MaterialIcons: () => null,
}));

jest.mock('../../hooks/use-color-scheme', () => ({
    useColorScheme: () => 'dark',
}));

describe('FeedbackCommentModal', () => {
    it('opens with a comment field and saves feedback notes', () => {
        const onCommentChange = jest.fn();
        const onSubmit = jest.fn();
        const { getByPlaceholderText, getByText } = render(
            <FeedbackCommentModal
                visible
                value="down"
                comment=""
                onCommentChange={onCommentChange}
                onClose={jest.fn()}
                onSubmit={onSubmit}
            />
        );

        fireEvent.changeText(
            getByPlaceholderText('Add a note about tone, pacing, or wording...'),
            'Too formal.'
        );
        fireEvent.press(getByText('Save'));

        expect(getByText('What missed?')).toBeTruthy();
        expect(onCommentChange).toHaveBeenCalledWith('Too formal.');
        expect(onSubmit).toHaveBeenCalledTimes(1);
    });
});
