/* eslint-disable import/first */

import { fireEvent, render } from '@testing-library/react-native';
import { Text } from 'react-native';

const mockConfirmOwnership = jest.fn(async () => undefined);
const mockContinueWithoutLegacyData = jest.fn();
const mockUseLegacyDataOwnership = jest.fn();

jest.mock('../../hooks/auth/useLegacyDataOwnership', () => ({
    useLegacyDataOwnership: (...args: unknown[]) => mockUseLegacyDataOwnership(...args),
}));

import { LegacyDataOwnershipGate } from '../../components/auth/LegacyDataOwnershipGate';

describe('LegacyDataOwnershipGate', () => {
    beforeEach(() => {
        mockConfirmOwnership.mockClear();
        mockContinueWithoutLegacyData.mockClear();
        mockUseLegacyDataOwnership.mockReturnValue({
            isChecking: false,
            needsConfirmation: true,
            isMigrating: false,
            error: null,
            confirmOwnership: mockConfirmOwnership,
            continueWithoutLegacyData: mockContinueWithoutLegacyData,
        });
    });

    it('requires an explicit ownership choice before protected children mount', () => {
        const screen = render(
            <LegacyDataOwnershipGate accountId="user-a">
                <Text>Protected journal</Text>
            </LegacyDataOwnershipGate>
        );

        expect(screen.queryByText('Protected journal')).toBeNull();
        fireEvent.press(screen.getByText('Yes, this data is mine'));
        expect(mockConfirmOwnership).toHaveBeenCalledTimes(1);
    });

    it('lets the user leave unclaimed data quarantined and continue empty', () => {
        const screen = render(
            <LegacyDataOwnershipGate accountId="user-a">
                <Text>Protected journal</Text>
            </LegacyDataOwnershipGate>
        );

        fireEvent.press(screen.getByText('Continue with an empty account'));
        expect(mockContinueWithoutLegacyData).toHaveBeenCalledTimes(1);
    });

    it('does not inspect or block an auth recovery route', () => {
        mockUseLegacyDataOwnership.mockClear();
        const screen = render(
            <LegacyDataOwnershipGate accountId="user-a" enabled={false}>
                <Text>Set a new password</Text>
            </LegacyDataOwnershipGate>
        );

        expect(screen.getByText('Set a new password')).toBeTruthy();
        expect(mockUseLegacyDataOwnership).not.toHaveBeenCalled();
    });
});
