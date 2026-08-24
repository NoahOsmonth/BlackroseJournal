import { MaterialIcons } from '@expo/vector-icons';
import { useColorScheme } from '@/hooks/use-color-scheme';
import React, { useEffect } from 'react';
import { Text, View } from 'react-native';
import Animated, {
    useAnimatedStyle,
    useReducedMotion,
    useSharedValue,
    withSpring,
    withTiming,
} from 'react-native-reanimated';
import {
    ConfettiCanvas,
    useConfetti,
    presets,
} from 'react-native-confetti-reanimated';

import { SuccessOverlay } from './SuccessOverlay';

const PRIMARY = '#FF9F0A';
const PRIMARY_DARK = '#FFB340';
const CONFETTI_COLORS = [PRIMARY, PRIMARY_DARK, '#FFFFFF'];

interface EntryFinishCelebrationProps {
    /** Called when the celebration auto-dismisses (3s) or the overlay is tapped. */
    onDismiss: () => void;
}

/**
 * Full-screen entry-finish celebration: a confetti burst from the bottom plus
 * a spring-in success checkmark. Auto-dismisses after 3 seconds or when tapped.
 *
 * When the user has Reduce Motion enabled we skip the confetti entirely and
 * fall back to a plain, immediate scale-fade checkmark (never hides content
 * behind an animation the user prefers to avoid).
 */
export function EntryFinishCelebration({ onDismiss }: EntryFinishCelebrationProps) {
    const reduceMotion = useReducedMotion();
    const isDark = useColorScheme() === 'dark';

    const { confettiRef, fire } = useConfetti();
    const iconScale = useSharedValue(reduceMotion ? 1 : 0);
    const iconOpacity = useSharedValue(reduceMotion ? 1 : 0);

    // Arbitrary "bounces" a touch before the checkmark so the burst reads first.
    useEffect(() => {
        if (!reduceMotion) {
            fire({
                ...presets.basicCannon,
                particleCount: 130,
                colors: CONFETTI_COLORS,
                origin: { x: 0.5, y: 0.35 },
                ticks: 220,
            });
            iconScale.value = withSpring(1, { damping: 12, stiffness: 150, mass: 0.7 });
        }
        iconOpacity.value = withTiming(1, { duration: reduceMotion ? 0 : 260 });

        const timer = setTimeout(() => onDismiss(), 3000);
        return () => clearTimeout(timer);
        // Fire once per mount — the screen re-mounts it via a key each finish.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const iconStyle = useAnimatedStyle(() => ({
        opacity: iconOpacity.value,
        transform: [{ scale: iconScale.value }],
    }));

    const accent = isDark ? PRIMARY_DARK : PRIMARY;

    return (
        <View className="absolute inset-0">
            <SuccessOverlay
                visible
                icon="check-circle"
                message="Entry saved ✨"
                onDismiss={onDismiss}
            />

            {/* Animated checkmark layered on top of the SuccessOverlay content.
                Rendered here (not in SuccessOverlay) so the spring is part of the
                celebration and skipped under reduced motion. The message text rides
                in the same animated container so no Animated.Text is needed. */}
            <View className="absolute inset-0 items-center justify-center pointer-events-none" >
                <Animated.View style={iconStyle} className="items-center gap-4">
                    <MaterialIcons name="check-circle" size={76} color={accent} />
                    <Text
                        style={[{ textAlign: 'center' }]}
                        className="font-bold text-2xl text-text-light dark:text-white"
                    >
                        Entry saved ✨
                    </Text>
                </Animated.View>
            </View>

            {!reduceMotion && (
                <ConfettiCanvas
                    ref={confettiRef}
                    fullScreen
                    zIndex={1001}
                    containerStyle={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
                />
            )}
        </View>
    );
}