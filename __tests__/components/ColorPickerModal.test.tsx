import React from 'react';
import { act, fireEvent, render } from '@testing-library/react-native';

import { ColorPickerModal } from '../../components/settings/ColorPickerModal';
import { DEFAULT_COLOR_THEME } from '../../constants/theme';
import { derivePartnerHex } from '../../services/theme/colorDerivation';

jest.mock('@expo/vector-icons', () => ({
    MaterialIcons: () => null,
}));

jest.mock('../../hooks/use-color-scheme', () => ({
    useColorScheme: () => 'light',
}));

describe('ColorPickerModal', () => {
    const baseProps = {
        onConfirm: jest.fn().mockResolvedValue(undefined),
        onClose: jest.fn(),
    };

    it('renders nothing visible when slot is null', () => {
        const { queryByText } = render(
            <ColorPickerModal slot={null} value="#000000" partnerValue="#FFFFFF" {...baseProps} />
        );
        expect(queryByText('Accent · Light')).toBeNull();
    });

    it('shows the source and partner labels for the active slot', () => {
        const { getByText } = render(
            <ColorPickerModal
                slot="accentLight"
                value={DEFAULT_COLOR_THEME.colors.accentLight}
                partnerValue={DEFAULT_COLOR_THEME.colors.accentDark}
                {...baseProps}
            />
        );
        expect(getByText('Accent · Light')).toBeTruthy();
        expect(getByText(/Light · you/)).toBeTruthy();
        expect(getByText(/Dark · auto/)).toBeTruthy();
    });

    it('exposes the synced partner preview computed via derivePartnerHex', () => {
        const sourceHex = '#0EA5E9';
        const expectedPartner = derivePartnerHex(sourceHex, true);
        const { getByText } = render(
            <ColorPickerModal
                slot="accentLight"
                value={sourceHex}
                partnerValue="#FFFFFF"
                {...baseProps}
            />
        );
        // The partner preview shows the auto-derived hex value.
        expect(getByText(expectedPartner ?? '')).toBeTruthy();
    });

    it('emits onConfirm with the new source, partner, and sync flag', async () => {
        const onConfirm = jest.fn();
        const { getByLabelText } = render(
            <ColorPickerModal
                slot="accentLight"
                value="#0EA5E9"
                partnerValue="#FFFFFF"
                onConfirm={onConfirm}
                onClose={jest.fn()}
            />
        );

        await act(async () => {
            fireEvent.press(getByLabelText('Apply color'));
        });

        expect(onConfirm).toHaveBeenCalledWith(expect.objectContaining({
            slot: 'accentLight',
            syncPartner: true,
        }));
        // Source value normalises to upper case.
        const call = onConfirm.mock.calls[0]?.[0];
        expect(call?.value).toBe('#0EA5E9');
        // The auto-derived partner is non-empty.
        expect(call?.partnerValue).toMatch(/^#[0-9A-F]{6}$/);
    });

    it('toggles the sync-partner switch and reflects it in the emitted edit', async () => {
        const onConfirm = jest.fn();
        const { getByLabelText, getByText } = render(
            <ColorPickerModal
                slot="accentLight"
                value="#0EA5E9"
                partnerValue="#FFFFFF"
                onConfirm={onConfirm}
                onClose={jest.fn()}
            />
        );

        // Flip the "Sync dark partner" switch off.
        fireEvent(getByLabelText('Sync partner color'), 'valueChange', false);

        await act(async () => {
            fireEvent.press(getByLabelText('Apply color'));
        });

        expect(onConfirm).toHaveBeenCalledWith(expect.objectContaining({
            syncPartner: false,
            // When sync is off, the original partner value is preserved.
            partnerValue: '#FFFFFF',
        }));

        // The description text changes to reflect the toggle.
        expect(getByText(/Keep the current dark value as-is/)).toBeTruthy();
    });

    it('emits a no-op (does not call onConfirm) when the source hex is invalid', async () => {
        const onConfirm = jest.fn();
        const { getByLabelText } = render(
            <ColorPickerModal
                slot="accentLight"
                value="#0EA5E9"
                partnerValue="#FFFFFF"
                onConfirm={onConfirm}
                onClose={jest.fn()}
            />
        );

        // Type a malformed hex into the input — the modal should refuse
        // to confirm while the value is unparseable.
        fireEvent.changeText(getByLabelText('Hex value'), 'zzz');
        await act(async () => {
            fireEvent.press(getByLabelText('Apply color'));
        });

        expect(onConfirm).not.toHaveBeenCalled();
    });

    it('fires onClose when the user dismisses the modal', () => {
        const onClose = jest.fn();
        const { getByLabelText } = render(
            <ColorPickerModal
                slot="accentLight"
                value="#0EA5E9"
                partnerValue="#FFFFFF"
                onConfirm={jest.fn()}
                onClose={onClose}
            />
        );
        fireEvent.press(getByLabelText('Cancel color change'));
        expect(onClose).toHaveBeenCalledTimes(1);
    });
});
