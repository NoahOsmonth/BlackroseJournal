import React from 'react';
import { Pressable, Text, View } from 'react-native';

import { SettingsSection } from './SettingsSection';

interface AccountSettingsSectionProps {
    readonly email: string | null;
    readonly isAuthLoading: boolean;
    readonly isSigningOut: boolean;
    readonly onSignOut: () => void;
    readonly onSignIn: () => void;
    readonly onCreateAccount: () => void;
    readonly onForgotPassword: () => void;
    readonly embedded?: boolean;
}

const PRIMARY_ACTION = [
    'mt-4 min-h-12 items-center justify-center rounded-control',
    'border border-hairline-light dark:border-hairline-dark',
].join(' ');
const SECONDARY_ACTION = [
    'mt-3 min-h-12 items-center justify-center rounded-control',
    'border border-hairline-light dark:border-hairline-dark',
].join(' ');
const ACTION_LABEL = 'text-[15px] text-text-light dark:text-text-dark';
const BODY = 'text-[15px] leading-6 text-text-secondary-light dark:text-text-secondary-dark';

/** Account body: quiet prose, outline actions on the shared hairline tokens. */
export function AccountSettingsSection({
    email,
    isAuthLoading,
    isSigningOut,
    onSignOut,
    onSignIn,
    onCreateAccount,
    onForgotPassword,
    embedded = false,
}: AccountSettingsSectionProps) {
    if (email) {
        return (
            <SettingsSection title="Account" embedded={embedded}>
                <Text className="text-[16px] text-text-light dark:text-text-dark">
                    Signed in as {email}
                </Text>
                <Text className={`mt-2 ${BODY}`}>
                    Sessions stay active until you sign out.
                </Text>
                <Pressable
                    onPress={onSignOut}
                    disabled={isSigningOut}
                    accessibilityRole="button"
                    accessibilityState={{ disabled: isSigningOut }}
                    className={`${PRIMARY_ACTION} ${isSigningOut ? 'opacity-60' : ''}`}
                >
                    <Text className={ACTION_LABEL} style={{ fontFamily: 'PlayfairDisplayRegular' }}>
                        {isSigningOut ? 'Signing out…' : 'Sign out'}
                    </Text>
                </Pressable>
            </SettingsSection>
        );
    }

    return (
        <SettingsSection title="Account" embedded={embedded}>
            <Text className="text-[16px] text-text-light dark:text-text-dark">
                Sign in to your account
            </Text>
            <Text className={`mt-2 ${BODY}`}>
                {isAuthLoading
                    ? 'Checking session…'
                    : 'Core journal data stays local unless remote data sync is explicitly enabled.'}
            </Text>

            <Pressable
                onPress={onSignIn}
                accessibilityRole="button"
                className={PRIMARY_ACTION}
            >
                <Text className={ACTION_LABEL} style={{ fontFamily: 'PlayfairDisplayRegular' }}>
                    Sign in
                </Text>
            </Pressable>

            <Pressable
                onPress={onCreateAccount}
                accessibilityRole="button"
                className={SECONDARY_ACTION}
            >
                <Text className={ACTION_LABEL} style={{ fontFamily: 'PlayfairDisplayRegular' }}>
                    Create account
                </Text>
            </Pressable>

            <View className="mt-4 items-center">
                <Pressable onPress={onForgotPassword} accessibilityRole="button" hitSlop={6}>
                    <Text className="text-[15px] text-text-light underline dark:text-text-dark">
                        Forgot password?
                    </Text>
                </Pressable>
            </View>
        </SettingsSection>
    );
}
