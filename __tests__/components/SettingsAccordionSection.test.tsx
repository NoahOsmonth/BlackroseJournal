import React from 'react';
import { Text } from 'react-native';
import { fireEvent, render, screen } from '@testing-library/react-native';

import { SettingsAccordionSection } from '../../components/settings/SettingsAccordionSection';

jest.mock('../../hooks/use-color-scheme', () => ({
    useColorScheme: () => 'light',
}));

jest.mock('@expo/vector-icons', () => ({
    MaterialIcons: () => null,
}));

describe('SettingsAccordionSection', () => {
    it('hides children when collapsed and shows the summary', () => {
        render(
            <SettingsAccordionSection
                id="appearance"
                title="Appearance"
                summary="Dark · Soft"
                icon="brightness-6"
                expanded={false}
                onToggle={jest.fn()}
            >
                <Text>Theme controls</Text>
            </SettingsAccordionSection>
        );

        expect(screen.getByText('Appearance')).toBeTruthy();
        expect(screen.getByText('Dark · Soft')).toBeTruthy();
        expect(screen.queryByText('Theme controls')).toBeNull();
        expect(screen.getByLabelText('Appearance, Dark · Soft').props.accessibilityState)
            .toEqual({ expanded: false });
    });

    it('shows children when expanded and toggles on press', () => {
        const onToggle = jest.fn();
        render(
            <SettingsAccordionSection
                id="appearance"
                title="Appearance"
                summary="Light · Native"
                icon="brightness-6"
                expanded
                onToggle={onToggle}
            >
                <Text>Theme controls</Text>
            </SettingsAccordionSection>
        );

        expect(screen.getByText('Theme controls')).toBeTruthy();
        fireEvent.press(screen.getByLabelText('Appearance, Light · Native'));
        expect(onToggle).toHaveBeenCalledWith('appearance');
        expect(screen.getByLabelText('Appearance, Light · Native').props.accessibilityState)
            .toEqual({ expanded: true });
    });
});
