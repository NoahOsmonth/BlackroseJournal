import React, { useEffect } from 'react';
import { StyleProp, ViewStyle, StyleSheet } from 'react-native';
import Animated, {
    useSharedValue,
    useAnimatedStyle,
    withTiming,
    ReduceMotion,
} from 'react-native-reanimated';

interface AnimatedRemoveProps {
    /** When true, plays the exit animation (fade + scale down). */
    removing: boolean;
    /**
     * Called after the exit animation completes. Wire this to actually remove
     * the row from state so the removal feels smooth rather than instant.
     */
    onExited: () => void;
    /** Fade-out duration in ms (default 200). */
    durationMs?: number;
    children: React.ReactNode;
    style?: StyleProp<ViewStyle>;
    className?: string;
}

/**
 * Wrapper that plays a fast fade-out + scale-down before a list item is
 * removed from state. All work happens on the UI thread via Reanimated
 * transforms/opacity (no layout animations). Set `removing` true to trigger,
 * then call `onExited` to actually drop the item.
 */
export function AnimatedRemove({
    removing,
    onExited,
    durationMs = 200,
    children,
    style,
    className = '',
}: AnimatedRemoveProps) {
    const opacity = useSharedValue(1);
    const scale = useSharedValue(1);

    const TIMING = { duration: durationMs, reduceMotion: ReduceMotion.System };

    useEffect(() => {
        if (removing) {
            opacity.value = withTiming(0, TIMING);
            scale.value = withTiming(0.95, TIMING);
            // Fire the actual removal after the animation has visually played.
            const timeout = setTimeout(onExited, durationMs);
            return () => clearTimeout(timeout);
        }
        // Restore entrance state for reused keys.
        opacity.value = withTiming(1, TIMING);
        scale.value = withTiming(1, TIMING);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [removing]);

    const animatedStyle = useAnimatedStyle(() => ({
        opacity: opacity.value,
        transform: [{ scale: scale.value }] as ViewStyle['transform'],
    }));

    return (
        <Animated.View
            style={[styles.wrapper, animatedStyle, style]}
            className={className}
        >
            {children}
        </Animated.View>
    );
}

const styles = StyleSheet.create({
    wrapper: {
        backfaceVisibility: 'hidden',
    },
});