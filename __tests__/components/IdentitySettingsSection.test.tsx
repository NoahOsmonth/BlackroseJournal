import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';

import { IdentitySettingsSection } from '../../components/settings/IdentitySettingsSection';
import type { IdentityScalarRow } from '../../services/memory/identityProfileView';

jest.mock('../../hooks/use-color-scheme', () => ({
    useColorScheme: () => 'light',
}));

function scalar(
    key: IdentityScalarRow['key'],
    value: string,
    pending?: string,
): IdentityScalarRow {
    return {
        key,
        label: key === 'preferredName' ? 'Preferred name' : key === 'pronouns' ? 'Pronouns' : 'About',
        hasPending: Boolean(pending),
        field: {
            value,
            confidence: 0.9,
            source: 'extraction',
            updatedAt: 1,
            pendingCandidate: pending,
        },
    };
}

describe('IdentitySettingsSection', () => {
    it('renders empty state when no profile fields', () => {
        render(
            <IdentitySettingsSection
                scalarRows={[]}
                pendingRows={[]}
                collectionRows={[]}
                onConfirmPending={jest.fn()}
                onDismissPending={jest.fn()}
            />,
        );
        expect(screen.getByTestId('identity-empty-state')).toBeTruthy();
        expect(screen.getByTestId('identity-no-pending')).toBeTruthy();
    });

    it('renders confirmed-only fields without pending cards', () => {
        render(
            <IdentitySettingsSection
                scalarRows={[scalar('preferredName', 'Mara')]}
                pendingRows={[]}
                collectionRows={[]}
                onConfirmPending={jest.fn()}
                onDismissPending={jest.fn()}
            />,
        );
        expect(screen.getByTestId('identity-confirmed-preferredName')).toBeTruthy();
        expect(screen.getByText('Mara')).toBeTruthy();
        expect(screen.getByTestId('identity-no-pending')).toBeTruthy();
        expect(screen.queryByTestId('identity-pending-preferredName')).toBeNull();
    });

    it('renders one pending candidate with Confirm and Dismiss', () => {
        const onConfirm = jest.fn();
        const onDismiss = jest.fn();
        const pending = scalar('preferredName', 'Mara', 'Ren');

        // Web confirm path: simulate acceptance for Confirm.
        const originalConfirm = global.window?.confirm;
        // @ts-expect-error test seam
        global.window = { ...(global.window ?? {}), confirm: jest.fn(() => true) };

        render(
            <IdentitySettingsSection
                scalarRows={[pending]}
                pendingRows={[pending]}
                collectionRows={[]}
                onConfirmPending={onConfirm}
                onDismissPending={onDismiss}
            />,
        );

        expect(screen.getByTestId('identity-pending-preferredName')).toBeTruthy();
        expect(screen.getByText('Ren')).toBeTruthy();
        expect(screen.getByText('Mara')).toBeTruthy();

        fireEvent.press(screen.getByTestId('identity-confirm-preferredName'));
        expect(onConfirm).toHaveBeenCalledWith('preferredName');

        // Dismiss with accept
        (global as { window: { confirm: jest.Mock } }).window.confirm.mockReturnValueOnce(true);
        fireEvent.press(screen.getByTestId('identity-dismiss-preferredName'));
        expect(onDismiss).toHaveBeenCalledWith('preferredName');

        if (typeof originalConfirm === 'function') {
            (global as { window: { confirm: typeof originalConfirm } }).window.confirm = originalConfirm;
        }
    });

    it('renders multiple pending candidates when shape allows', () => {
        const rows = [
            scalar('preferredName', 'Mara', 'Ren'),
            scalar('about', 'Writer', 'Painter'),
        ];
        render(
            <IdentitySettingsSection
                scalarRows={rows}
                pendingRows={rows}
                collectionRows={[
                    {
                        kind: 'person',
                        id: 'person:Ada',
                        label: 'Key person',
                        value: 'Ada (partner)',
                    },
                ]}
                onConfirmPending={jest.fn()}
                onDismissPending={jest.fn()}
            />,
        );
        expect(screen.getByTestId('identity-pending-preferredName')).toBeTruthy();
        expect(screen.getByTestId('identity-pending-about')).toBeTruthy();
        expect(screen.getByTestId('identity-collection-person:Ada')).toBeTruthy();
        expect(screen.getByText('Ada (partner)')).toBeTruthy();
    });
});
