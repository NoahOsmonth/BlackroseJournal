import React from 'react';
import { Text, TouchableOpacity } from 'react-native';

import { SettingsSection } from './SettingsSection';

interface AccountSettingsSectionProps {
    readonly email: string | null;
    readonly isAuthLoading: boolean;
    readonly isSigningOut: boolean;
    readonly onSignOut: () => void;
    readonly onSignIn: () => void;
    readonly onCreateAccount: () => void;
    readonly onForgotPassword: () => void;
}

export function AccountSettingsSection({
    email,
    isAuthLoading,
    isSigningOut,
    onSignOut,
    onSignIn,
    onCreateAccount,
    onForgotPassword,
}: AccountSettingsSectionProps) {
    if (email) {
        return (
            <SettingsSection title="Account">
                <Text className="text-text-light dark:text-text-dark font-medium text-base">
                    Signed in as {email}
                </Text>
                <Text className="text-sm text-subtext-light dark:text-subtext-dark mt-2">
                    Sessions stay active until you sign out.
                </Text>
                <TouchableOpacity
                    onPress={onSignOut}
                    disabled={isSigningOut}
                    className={`mt-4 rounded-xl py-3 ${isSigningOut ? 'bg-primary/70' : 'bg-primary'}`}
                >
                    <Text className="text-white font-semibold text-center">
                        {isSigningOut ? 'Signing out...' : 'Sign out'}
                    </Text>
                </TouchableOpacity>
            </SettingsSection>
        );
    }

    return (
        <SettingsSection title="Account">
            <Text className="text-text-light dark:text-text-dark font-medium text-base">
                Sign in to your account
            </Text>
            <Text className="text-sm text-subtext-light dark:text-subtext-dark mt-2">
                {isAuthLoading
                    ? 'Checking session...'
                    : 'Core journal data stays local unless remote data sync is explicitly enabled.'}
            </Text>

            <TouchableOpacity onPress={onSignIn} className="mt-4 rounded-xl py-3 bg-primary">
                <Text className="text-white font-semibold text-center">Sign in</Text>
            </TouchableOpacity>

            <TouchableOpacity
                onPress={onCreateAccount}
                className="mt-3 rounded-xl py-3 border border-divider-light dark:border-divider-dark"
            >
                <Text className="text-text-light dark:text-text-dark font-semibold text-center">
                    Create account
                </Text>
            </TouchableOpacity>

            <TouchableOpacity onPress={onForgotPassword} className="mt-3">
                <Text className="text-sm text-primary font-semibold text-center">
                    Forgot password?
                </Text>
            </TouchableOpacity>
        </SettingsSection>
    );
}
