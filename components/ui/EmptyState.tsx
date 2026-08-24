import React, { ComponentProps, useEffect } from 'react';
import { Pressable, Text, View } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import Animated, {
    Easing,
    useAnimatedStyle,
    useReducedMotion,
    useSharedValue,
    withRepeat,
    withSequence,
    withTiming,
} from 'react-native-reanimated';

import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

type MaterialIconName = ComponentProps<typeof MaterialIcons>['name'];

interface EmptyStateProps {
    title: string;
    message: string;
    icon?: MaterialIconName;
    actionLabel?: string;
    onActionPress?: () => void;
}

export function EmptyState({
    title,
    message,
    icon = 'auto-awesome',
    actionLabel,
    onActionPress,
}: EmptyStateProps) {
    const isDark = useColorScheme() === 'dark';
    const iconColor = isDark ? Colors.dark.primary : Colors.light.primary;
    const hasAction = Boolean(actionLabel && onActionPress);

    const reduceMotion = useReducedMotion();
    const breath = useSharedValue(1);

    useEffect(() => {
        if (reduceMotion) {
            breath.value = 1;
            return;
        }
        breath.value = withRepeat(
            withSequence(
                withTiming(1.02, { duration: 1500, easing: Easing.inOut(Easing.ease) }),
                withTiming(1, { duration: 1500, easing: Easing.inOut(Easing.ease) })
            ),
            -1,
            true
        );
    }, [reduceMotion, breath]);

    const iconStyle = useAnimatedStyle(() => ({
        transform: [{ scale: breath.value }],
    }));

    return (
        <View
            className="items-center rounded-2xl border border-divider-light bg-background-light px-4 py-5 dark:border-divider-dark dark:bg-background-dark"
            accessibilityLabel={`${title}. ${message}`}
        >
            <Animated.View
                className="mb-3 rounded-full bg-primary/10 p-3 dark:bg-primary-dark/20"
                style={iconStyle}
            >
                <MaterialIcons name={icon} size={22} color={iconColor} />
            </Animated.View>
            <Text className="text-center text-sm font-semibold text-text-light dark:text-text-dark">
                {title}
            </Text>
            <Text className="mt-1 text-center text-xs text-text-secondary-light dark:text-text-secondary-dark">
                {message}
            </Text>
            {hasAction ? (
                <Pressable
                    onPress={onActionPress}
                    className="mt-4 rounded-full bg-primary px-4 py-2"
                    accessibilityRole="button"
                    accessibilityLabel={actionLabel}
                >
                    <Text className="text-xs font-bold text-white">
                        {actionLabel}
                    </Text>
                </Pressable>
            ) : null}
        </View>
    );
}
