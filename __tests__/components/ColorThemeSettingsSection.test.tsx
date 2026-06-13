import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';

import { ColorThemeSettingsSection } from '../../components/settings/ColorThemeSettingsSection';
import { DEFAULT_COLOR_THEME } from '../../constants/theme';
import { derivePartnerHex } from '../../services/theme/colorDerivation';

jest.mock('@expo/vector-icons', () => ({
    MaterialIcons: () => null,
}));

jest.mock('../../hooks/use-color-scheme', () => ({
    useColorScheme: () => 'light',
}));

describe('ColorThemeSettingsSection', () => {
    it('renders the 8 palette presets and editable swatch rows', () => {
        const { getByLabelText, getByText } = render(
            <ColorThemeSettingsSection
                colorTheme={DEFAULT_COLOR_THEME}
                onPresetChange={jest.fn()}
                onPickerConfirm={jest.fn().mockResolvedValue(true)}
                onReset={jest.fn()}
            />
        );

        // All 8 palettes are present in the grid.
        expect(getByLabelText('Select Rosebud colors')).toBeTruthy();
        expect(getByLabelText('Select Ocean colors')).toBeTruthy();
        expect(getByLabelText('Select Forest colors')).toBeTruthy();
        expect(getByLabelText('Select Plum colors')).toBeTruthy();
        expect(getByLabelText('Select Sunset colors')).toBeTruthy();
        expect(getByLabelText('Select Lavender colors')).toBeTruthy();
        expect(getByLabelText('Select Mint colors')).toBeTruthy();
        expect(getByLabelText('Select Mocha colors')).toBeTruthy();

        // Swatch rows for every editable group render with tappable swatches.
        expect(getByText('Journal preview')).toBeTruthy();
        expect(getByLabelText('Edit Accent Light color')).toBeTruthy();
        expect(getByLabelText('Edit Accent Dark color')).toBeTruthy();
        expect(getByLabelText('Edit App font Light color')).toBeTruthy();
        expect(getByLabelText('Edit App font Dark color')).toBeTruthy();
        expect(getByLabelText('Edit Muted font Light color')).toBeTruthy();
        expect(getByLabelText('Edit Chat — you Light color')).toBeTruthy();
        expect(getByLabelText('Edit Chat — Rosebud Dark color')).toBeTruthy();
        expect(getByLabelText('Edit Background Light color')).toBeTruthy();
        expect(getByLabelText('Edit Background Dark color')).toBeTruthy();
    });

    it('wires preset, reset, and swatch-tap callbacks to the host', () => {
        const onPresetChange = jest.fn();
        const onPickerConfirm = jest.fn().mockResolvedValue(true);
        const onReset = jest.fn();
        const { getByLabelText } = render(
            <ColorThemeSettingsSection
                colorTheme={DEFAULT_COLOR_THEME}
                onPresetChange={onPresetChange}
                onPickerConfirm={onPickerConfirm}
                onReset={onReset}
            />
        );

        fireEvent.press(getByLabelText('Select Ocean colors'));
        fireEvent.press(getByLabelText('Select Sunset colors'));
        fireEvent.press(getByLabelText('Reset color theme'));

        // Tapping a swatch opens the picker (state transition); the actual
        // confirm/cancel flows are covered by the dedicated ColorPickerModal
        // and useThemeSettings tests since React Native's <Modal /> does not
        // render its children in the Jest tree.
        fireEvent.press(getByLabelText('Edit Accent Light color'));
        fireEvent.press(getByLabelText('Edit Chat — you Dark color'));

        expect(onPresetChange).toHaveBeenCalledWith('ocean');
        expect(onPresetChange).toHaveBeenCalledWith('sunset');
        expect(onReset).toHaveBeenCalledTimes(1);
    });

    it('shows customized colors in the preview', () => {
        const colorTheme = {
            presetId: 'custom' as const,
            colors: {
                ...DEFAULT_COLOR_THEME.colors,
                appTextLight: '#102030',
                chatUserTextLight: '#405060',
                chatAiTextLight: '#708090',
            },
        };

        const { getByText } = render(
            <ColorThemeSettingsSection
                colorTheme={colorTheme}
                onPresetChange={jest.fn()}
                onPickerConfirm={jest.fn().mockResolvedValue(true)}
                onReset={jest.fn()}
            />
        );

        expect(getByText('Journal preview').props.style.color).toBe('#102030');
        expect(getByText('I want the chat to feel like mine.').props.style.color).toBe('#405060');
        expect(getByText('Rosebud can match that tone.').props.style.color).toBe('#708090');
    });

    it('marks the auto-derived partner swatch with an "auto" badge', () => {
        // Construct a theme where accentDark is exactly what
        // derivePartnerHex(accentLight, true) would return. The badge is
        // only displayed when the live partner value matches the auto-derivation.
        const accentLight = '#0EA5E9';
        const accentDark = derivePartnerHex(accentLight, true);
        const customTheme = {
            presetId: 'custom' as const,
            colors: {
                ...DEFAULT_COLOR_THEME.colors,
                accentLight,
                accentDark,
            },
        };
        const { queryAllByText } = render(
            <ColorThemeSettingsSection
                colorTheme={customTheme}
                onPresetChange={jest.fn()}
                onPickerConfirm={jest.fn().mockResolvedValue(true)}
                onReset={jest.fn()}
            />
        );

        const badges = queryAllByText('auto');
        expect(badges.length).toBeGreaterThan(0);
    });
});
