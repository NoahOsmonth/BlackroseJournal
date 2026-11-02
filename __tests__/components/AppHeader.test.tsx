import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';

import { AppHeader } from '../../components/navigation/AppHeader';

jest.mock('@expo/vector-icons', () => ({
    MaterialIcons: () => null,
}));

jest.mock('../../hooks/theme/use-color-scheme', () => ({
    useColorScheme: () => 'dark',
}));

jest.mock('../../components/ui/RoseMark', () => ({
    RoseMark: () => null,
}));

describe('AppHeader history variant', () => {
    it('renders the drafts count as a quiet bordered chip, not an underlined link', () => {
        const onDraftsPress = jest.fn();
        const { getByLabelText, getByTestId, getByText } = render(
            <AppHeader
                variant="history"
                weekLabel="This week · Jan 18–24"
                draftCount={3}
                onDraftsPress={onDraftsPress}
            />
        );

        expect(getByText('Archive')).toBeTruthy();
        expect(getByText('This week · Jan 18–24')).toBeTruthy();
        expect(getByText('3 drafts')).toBeTruthy();

        const chip = getByTestId('drafts-button');
        expect(chip).toBeTruthy();
        expect(getByText('3 drafts').props.className).not.toContain('underline');

        const chrome = getByTestId('drafts-chip');
        expect(chrome.props.className).toContain('rounded-control');
        expect(chrome.props.className).toContain('border');

        fireEvent.press(getByLabelText('Open drafts'));
        expect(onDraftsPress).toHaveBeenCalledTimes(1);
    });

    it('keeps the plain Drafts label when there is nothing in drafts', () => {
        const { getByText } = render(
            <AppHeader variant="history" draftCount={0} onDraftsPress={jest.fn()} />
        );

        expect(getByText('Drafts')).toBeTruthy();
    });
});
