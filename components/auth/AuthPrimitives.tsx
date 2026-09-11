import React, { useState } from 'react';
import { ActivityIndicator, Pressable, Text, TextInput, TextInputProps, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';

import { useColorScheme } from '@/hooks/use-color-scheme';
import { BLACKROSE_PALETTE } from '@/constants/theme';

const SERIF = { fontFamily: 'PlayfairDisplayRegular' };

/** Quiet uppercase field label — the concept's `EMAIL` / `PASSWORD` captions. */
export function FieldLabel({ text }: { text: string }) {
    return (
        <Text className="mb-2 text-[12px] uppercase tracking-[1.5px] text-text-secondary-light dark:text-text-secondary-dark">
            {text}
        </Text>
    );
}

interface AuthInputProps extends TextInputProps {
    label?: string;
    /** Show an eye toggle for password visibility (only meaningful with secureTextEntry). */
    showVisibilityToggle?: boolean;
}

/**
 * Hairline text input with a bone focus border and a comfortable 48px+ touch
 * height. Purely presentational — all behavior comes from props.
 */
export const AuthInput = React.forwardRef<TextInput, AuthInputProps>(function AuthInput(
    { label, className = '', showVisibilityToggle = false, ...props },
    ref,
) {
    const [isFocused, setIsFocused] = useState(false);
    const [reveal, setReveal] = useState(false);
    const isDark = useColorScheme() === 'dark';
    const iconColor = isDark ? BLACKROSE_PALETTE.dark.text2 : BLACKROSE_PALETTE.light.text2;

    const toggle = showVisibilityToggle && props.secureTextEntry === true;

    return (
        <View
            className={`flex-row items-center rounded-control border bg-surface-light dark:bg-surface-dark ${
                isFocused
                    ? 'border-bone-light dark:border-bone-dark'
                    : 'border-hairline-light dark:border-hairline-dark'
            }`}
        >
            <TextInput
                {...props}
                ref={ref}
                accessibilityLabel={label ?? props.accessibilityLabel}
                secureTextEntry={props.secureTextEntry === true ? !reveal : props.secureTextEntry}
                placeholderTextColor={iconColor}
                onFocus={(e) => {
                    setIsFocused(true);
                    props.onFocus?.(e);
                }}
                onBlur={(e) => {
                    setIsFocused(false);
                    props.onBlur?.(e);
                }}
                className={`min-h-12 flex-1 rounded-control px-4 py-3 text-[16px] text-text-light dark:text-text-dark ${className}`}
            />
            {toggle && (
                <Pressable
                    onPress={() => setReveal((v) => !v)}
                    accessibilityRole="button"
                    accessibilityLabel={reveal ? 'Hide password' : 'Show password'}
                    accessibilityState={{ selected: reveal }}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    style={({ pressed }) => ({ opacity: pressed ? 0.5 : 1 })}
                    className="px-3 py-2"
                >
                    <MaterialIcons
                        name={reveal ? 'visibility-off' : 'visibility'}
                        size={20}
                        color={iconColor}
                    />
                </Pressable>
            )}
        </View>
    );
});

interface StatusBannerProps {
    type: 'error' | 'success';
    message: string;
}

/** Inline status feedback: hairline card, ink label, no coloured fill. */
export function StatusBanner({ type, message }: StatusBannerProps) {
    const isError = type === 'error';

    return (
        <View
            accessible
            accessibilityRole="alert"
            accessibilityLiveRegion="polite"
            className={`mt-4 rounded-card border bg-surface-light p-4 dark:bg-surface-dark ${
                isError
                    ? 'border-danger-light dark:border-danger-dark'
                    : 'border-ok-light dark:border-ok-dark'
            }`}
        >
            <Text
                className={`text-[12px] uppercase tracking-[1.5px] ${
                    isError
                        ? 'text-danger-light dark:text-danger-dark'
                        : 'text-ok-light dark:text-ok-dark'
                }`}
            >
                {isError ? 'Error' : 'Success'}
            </Text>
            <Text className="mt-1.5 text-[14px] text-text-light dark:text-text-dark">
                {message}
            </Text>
        </View>
    );
}

interface PrimaryButtonProps {
    label: string;
    loadingLabel: string;
    isLoading: boolean;
    onPress: () => void;
}

/** Full-width bone CTA in serif with loading state and pressed feedback. */
export function PrimaryButton({ label, loadingLabel, isLoading, onPress }: PrimaryButtonProps) {
    const isDark = useColorScheme() === 'dark';
    // The spinner sits on the bone fill, so it takes the on-bone ink, not the ink
    // that would contrast with the panel behind the button.
    const spinnerColor = isDark
        ? BLACKROSE_PALETTE.dark.surface
        : BLACKROSE_PALETTE.light.surface;

    return (
        <Pressable
            onPress={onPress}
            disabled={isLoading}
            accessibilityRole="button"
            accessibilityState={{ disabled: isLoading, busy: isLoading }}
            style={({ pressed }) => ({ opacity: pressed && !isLoading ? 0.85 : 1 })}
            className={`mt-5 min-h-[52px] flex-row items-center justify-center gap-2 rounded-control py-3.5 ${
                isLoading ? 'bg-bone-light/70 dark:bg-bone-dark/70' : 'bg-bone-light dark:bg-bone-dark'
            }`}
        >
            {isLoading && <ActivityIndicator size="small" color={spinnerColor} />}
            <Text
                className="text-center text-[18px] text-on-bone-light dark:text-on-bone-dark"
                style={SERIF}
            >
                {isLoading ? loadingLabel : label}
            </Text>
        </Pressable>
    );
}

interface TextLinkProps {
    label: string;
    onPress: () => void;
    /** Extra classes for layout (e.g. margins). */
    className?: string;
    center?: boolean;
}

/** Inline text link padded to a ≥44px touch target. */
export function TextLink({ label, onPress, className = '', center = false }: TextLinkProps) {
    return (
        <Pressable
            onPress={onPress}
            accessibilityRole="link"
            style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
        >
            {({ pressed }) => (
                <Text
                    className={`px-2 py-2.5 text-[15px] text-text-light underline dark:text-text-dark ${
                        center ? 'text-center' : ''
                    } ${pressed ? 'opacity-80' : ''} ${className}`}
                >
                    {label}
                </Text>
            )}
        </Pressable>
    );
}

/** Fire-and-forget haptic feedback for form outcomes (UI-only). */
export function authHaptic(type: 'success' | 'error') {
    const feedback =
        type === 'success'
            ? Haptics.NotificationFeedbackType.Success
            : Haptics.NotificationFeedbackType.Error;
    void Haptics.notificationAsync(feedback).catch(() => {});
}
