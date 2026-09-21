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

/** The band tone is what replaced the hairline — assert it alternates. */
function bandClassOf(testID: string): string {
    return screen.getByTestId(testID).props.className ?? '';
}

describe('SettingsAccordionSection', () => {
    it('hides children when collapsed and shows the summary', () => {
        render(
            <SettingsAccordionSection
                id="appearance"
                title="Appearance"
                summary="Dark · Soft"
                icon="brightness-6"
                index={0}
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
                index={0}
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

    it('separates collapsed rows by alternating band tone, not a hairline', () => {
        render(
            <>
                <SettingsAccordionSection
                    id="even" title="A" summary="one" index={0} expanded={false} onToggle={jest.fn()}
                >
                    <Text>x</Text>
                </SettingsAccordionSection>
                <SettingsAccordionSection
                    id="odd" title="B" summary="two" index={1} expanded={false} onToggle={jest.fn()}
                >
                    <Text>x</Text>
                </SettingsAccordionSection>
            </>
        );

        expect(bandClassOf('settings-band-even')).toContain('bg-band-light');
        expect(bandClassOf('settings-band-odd')).toContain('bg-background-light');
        // The old chrome was a hairline under every row; it must be gone.
        expect(bandClassOf('settings-band-even')).not.toContain('bg-hairline');
        expect(bandClassOf('settings-band-odd')).not.toContain('bg-hairline');
    });

    it('promotes the open row to the surface tone', () => {
        render(
            <SettingsAccordionSection
                id="open" title="A" summary="one" index={0} expanded onToggle={jest.fn()}
            >
                <Text>x</Text>
            </SettingsAccordionSection>
        );

        const cls = bandClassOf('settings-band-open');
        expect(cls).toContain('bg-surface-light');
        expect(cls).toContain('overflow-hidden');
    });

    it('lets the value pill absorb the squeeze so the label stays readable', () => {
        render(
            <SettingsAccordionSection
                id="a" title="Data Management" hint="Everything stays on device"
                summary="Export · Backup" index={0} expanded={false} onToggle={jest.fn()}
            >
                <Text>x</Text>
            </SettingsAccordionSection>
        );

        // The prototype keeps the label readable and clips the value instead, so
        // the pill carries `shrink` + a single line, and the label is free to
        // wrap rather than being cut off at 320px.
        const summary = screen.getByText('Export · Backup');
        expect(summary.props.numberOfLines).toBe(1);
        expect(summary.props.className).toContain('shrink');

        expect(screen.getByText('Data Management').props.numberOfLines).toBeUndefined();
        expect(screen.getByTestId('settings-row-text-a').props.className).toContain('min-w-0');
    });

    it('renders the index numeral and the hint line', () => {
        render(
            <SettingsAccordionSection
                id="a" title="Memory" hint="Atoms, files and Dream"
                summary="34 memories" index={6} expanded={false} onToggle={jest.fn()}
            >
                <Text>x</Text>
            </SettingsAccordionSection>
        );

        // index is zero-based; row 7 shows as "07".
        expect(screen.getByText('07')).toBeTruthy();
        expect(screen.getByText('Atoms, files and Dream')).toBeTruthy();
    });

    it('omits the hint line when none is given', () => {
        render(
            <SettingsAccordionSection
                id="a" title="About" summary="v0.0.1" index={0} expanded={false} onToggle={jest.fn()}
            >
                <Text>x</Text>
            </SettingsAccordionSection>
        );

        expect(screen.getByText('01')).toBeTruthy();
        expect(screen.queryByText('Version and privacy')).toBeNull();
    });
});
