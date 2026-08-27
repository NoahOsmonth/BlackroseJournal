import React, { useState } from 'react';
import { ActivityIndicator, Pressable, Text, TextInput, TextInputProps, View } from 'react-native';
import * as Haptics from 'expo-haptics';

/** Small uppercase field label used across auth forms. */
export function FieldLabel({ text }: { text: string }) {
    return (
        <Text className="text-xs font-bold uppercase tracking-wider text-subtext-light dark:text-subtext-dark mb-2">
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
 * Themed text input with a visible focus ring and comfortable 48px+ touch height.
 * Purely presentational — all behavior comes from props.
 */
export const AuthInput = React.forwardRef<TextInput, AuthInputProps>(function AuthInput(
    { label, className = '', showVisibilityToggle = false, ...props },
    ref,
) {
    const [isFocused, setIsFocused] = useState(false);
    const [reveal, setReveal] = useState(false);

    const toggle = showVisibilityToggle && props.secureTextEntry === true;

    return (
        <View
            className={`flex-row items-center rounded-xl border bg-background-light dark:bg-background-dark ${
                isFocused
                    ? 'border-primary dark:border-primary'
                    : 'border-divider-light dark:border-divider-dark'
            }`}
        >
            <TextInput
                {...props}
                ref={ref}
                accessibilityLabel={label ?? props.accessibilityLabel}
                secureTextEntry={props.secureTextEntry === true ? !reveal : props.secureTextEntry}
                onFocus={(e) => {
                    setIsFocused(true);
                    props.onFocus?.(e);
                }}
                onBlur={(e) => {
                    setIsFocused(false);
                    props.onBlur?.(e);
                }}
                className={`flex-1 rounded-xl px-4 py-3.5 text-text-light dark:text-text-dark ${className}`}
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
                    <Text className="text-sm text-subtext-light dark:text-subtext-dark">
                        {reveal ? '🙈' : '👁'}
                    </Text>
                </Pressable>
            )}
        </View>
    );
});

interface StatusBannerProps {
    type: 'error' | 'success';
    message: string;
}

/** Inline status feedback with distinct error vs success treatment and alert semantics. */
export function StatusBanner({ type, message }: StatusBannerProps) {
    const isError = type === 'error';

    return (
        <View
            accessible
            accessibilityRole="alert"
            accessibilityLiveRegion="polite"
            className={`mt-4 rounded-xl border-l-4 p-3 ${
                isError
                    ? 'bg-yellow-300/20 dark:bg-yellow-300/10 border-yellow-500 dark:border-yellow-400'
                    : 'bg-green-300/20 dark:bg-green-300/10 border-green-500 dark:border-green-400'
            }`}
        >
            <Text
                className={`text-xs font-bold uppercase tracking-wider ${
                    isError
                        ? 'text-yellow-700 dark:text-yellow-300'
                        : 'text-green-700 dark:text-green-300'
                }`}
            >
                {isError ? 'Error' : 'Success'}
            </Text>
            <Text className="text-sm text-text-light dark:text-text-dark mt-1">
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

/** Full-width primary CTA with loading spinner and pressed-state feedback. */
export function PrimaryButton({ label, loadingLabel, isLoading, onPress }: PrimaryButtonProps) {
    return (
        <Pressable
            onPress={onPress}
            disabled={isLoading}
            accessibilityRole="button"
            accessibilityState={{ disabled: isLoading, busy: isLoading }}
            style={({ pressed }) => ({ opacity: pressed && !isLoading ? 0.85 : 1 })}
            className={`mt-5 min-h-[48px] rounded-xl py-3.5 items-center justify-center flex-row gap-2 ${
                isLoading ? 'bg-primary/70' : 'bg-primary'
            }`}
        >
            {isLoading && <ActivityIndicator size="small" color="#FFFFFF" />}
            <Text className="text-white font-semibold text-center dark:text-white">
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
                    className={`py-2.5 px-2 text-sm text-primary font-semibold ${
                        center ? 'text-center' : ''
                    } ${pressed ? 'underline' : ''} ${className}`}
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
