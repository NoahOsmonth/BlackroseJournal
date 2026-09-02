import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useColorScheme } from '@/hooks/use-color-scheme';
import React, { useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import Animated, {
    FadeIn,
    FadeOut,
    useReducedMotion,
} from 'react-native-reanimated';

export interface SuccessOverlayProps {
    /** When true the overlay mounts and animates in; when false it fades out then unmounts. */
    visible: boolean;
    /** MaterialIcons glyph rendered inside the celebratory circle (e.g. 'check-circle'). */
    icon?: React.ComponentProps<typeof MaterialIcons>['name'];
    /** Main message shown under the icon (e.g. 'Entry saved ✨'). */
    message: string;
    /** Optional secondary detail line. */
    detail?: string;
    /** Optional text for a call-to-action button. */
    actionLabel?: string;
    /** Fired when the action button is pressed. */
    onAction?: () => void;
    /** Fired when the backdrop is tapped (tap anywhere to dismiss). */
    onDismiss?: () => void;
}

/**
 * Reusable success overlay: dimmed backdrop + centered icon + message + optional
 * action button. Fades in/out with Reanimated and respects reduced-motion by
 * skipping the enter/exit transitions entirely (a plain fade is always safe).
 */
export function SuccessOverlay({
    visible,
    icon = 'check-circle',
    message,
    detail,
    actionLabel,
    onAction,
    onDismiss,
}: SuccessOverlayProps) {
    const reduceMotion = useReducedMotion();
    const isDark = useColorScheme() === 'dark';

    // Keep the element mounted briefly after `visible` flips false so the
    // exiting (FadeOut) transition can play before unmounting.
    const [mounted, setMounted] = useState(visible);
    useEffect(() => {
        if (visible) {
            setMounted(true);
            return;
        }
        const timer = setTimeout(() => setMounted(false), 220);
        return () => clearTimeout(timer);
    }, [visible]);

    if (!mounted) return null;

    const backdropColor = isDark ? 'rgba(0,0,0,0.7)' : 'rgba(255,255,255,0.9)';
    // Backdrop contrasting text/icon derive from theme tokens (both schemes).
    const iconAccent = isDark ? '#FFB340' : '#FF9F0A';

    return (
        <Animated.View
            className="absolute inset-0 items-center justify-center px-8"
            style={[{ backgroundColor: backdropColor }]}
            entering={reduceMotion ? undefined : FadeIn.duration(200)}
            exiting={reduceMotion ? undefined : FadeOut.duration(200)}
            accessibilityRole="alert"
            accessibilityLabel={message}
            accessibilityLiveRegion="assertive"
        >
            <Pressable
                className="absolute inset-0"
                accessibilityRole="button"
                accessibilityLabel="Dismiss"
                onPress={onDismiss}
            />

            <View className="items-center gap-4">
                <View className="items-center justify-center">
                    <MaterialIcons name={icon} size={76} color={iconAccent} />
                </View>

                <View className="items-center gap-1">
                    <Text className="text-2xl font-bold text-center text-text-light dark:text-white">
                        {message}
                    </Text>
                    {detail ? (
                        <Text className="text-sm text-center text-text-secondary-light dark:text-text-secondary-dark">
                            {detail}
                        </Text>
                    ) : null}
                </View>

                {actionLabel && onAction ? (
                    <Pressable
                        onPress={onAction}
                        accessibilityRole="button"
                        accessibilityLabel={actionLabel}
                        className="mt-2 px-6 py-3 bg-primary rounded-full active:opacity-80"
                    >
                        <Text className="font-bold text-[15px] text-white">{actionLabel}</Text>
                    </Pressable>
                ) : null}
            </View>
        </Animated.View>
    );
}