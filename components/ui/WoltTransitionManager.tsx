import React, { useEffect } from 'react';
import { Dimensions, StyleSheet, View, ViewStyle } from 'react-native';
import Animated, {
    Easing,
    ReduceMotion,
    useAnimatedStyle,
    useSharedValue,
    withTiming,
} from 'react-native-reanimated';
import {
    useTransitionState,
} from 'expo-transition-router';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

export const WOLT_DURATION_MS = 320;
export const WOLT_BEZIER = [0.5, 0.1, 0.5, 1.0] as const;

const EASE = Easing.bezier(...WOLT_BEZIER);

const TIMING = {
    duration: WOLT_DURATION_MS,
    easing: EASE,
    reduceMotion: ReduceMotion.System,
};

/**
 * Wolt-style 3D parallax transition orchestrated by expo-transition-router's
 * lifecycle (leaving / entering / none). Slides the outgoing screen out to the
 * right while the incoming screen enters from the left with a parallax offset,
 * plus rotateY + scale for a subtle 3D depth feel (perspective 1000).
 */
export function WoltTransitionManager() {
    const { stage, activeAnimation } = useTransitionState();

    // Outgoing screen: slides out right, fades + rotates + scales slightly.
    const outX = useSharedValue(SCREEN_WIDTH);
    const outOpacity = useSharedValue(0);
    const outRotateY = useSharedValue(15);
    const outScale = useSharedValue(0.94);

    // Incoming screen: slides in from left parallax, rotates toward 0.
    const inX = useSharedValue(-SCREEN_WIDTH * 0.4);
    const inOpacity = useSharedValue(0);
    const inRotateY = useSharedValue(-24);

    // Keyed by activeAnimation so switching styles (e.g. back replay) restarts.
    const animKey = activeAnimation ?? 'wolt';

    useEffect(() => {
        const isLeaving = stage === 'leaving';
        const isEntering = stage === 'entering';

        if (isLeaving) {
            outX.value = withTiming(SCREEN_WIDTH, TIMING);
            outOpacity.value = withTiming(0, TIMING);
            outRotateY.value = withTiming(18, TIMING);
            outScale.value = withTiming(0.9, TIMING);
            inX.value = withTiming(-SCREEN_WIDTH * 0.3, TIMING);
            inOpacity.value = withTiming(1, { ...TIMING, duration: WOLT_DURATION_MS * 0.6 });
            inRotateY.value = withTiming(14, TIMING);
        } else if (isEntering) {
            outX.value = withTiming(SCREEN_WIDTH, TIMING);
            outOpacity.value = withTiming(0, TIMING);
            inX.value = withTiming(0, { ...TIMING, duration: WOLT_DURATION_MS * 0.95 });
            inOpacity.value = withTiming(1, TIMING);
            inRotateY.value = withTiming(0, TIMING);
        } else {
            // steady state: frame everything back out of view
            outX.value = withTiming(SCREEN_WIDTH, TIMING);
            outOpacity.value = withTiming(0, TIMING);
            inX.value = withTiming(-SCREEN_WIDTH * 0.4, TIMING);
            inOpacity.value = withTiming(0, TIMING);
            inRotateY.value = withTiming(-24, TIMING);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [stage, animKey]);

    const outStyle = useAnimatedStyle(() => ({
        opacity: outOpacity.value,
        transform: [
            { perspective: 1000 },
            { translateX: outX.value },
            { rotateY: `${outRotateY.value}deg` },
            { scale: outScale.value },
        ] as ViewStyle['transform'],
    }));

    const inStyle = useAnimatedStyle(() => ({
        opacity: inOpacity.value,
        transform: [
            { perspective: 1000 },
            { translateX: inX.value },
            { rotateY: `${inRotateY.value}deg` },
        ] as ViewStyle['transform'],
    }));

    if (stage === 'none') return null;

    return (
        <View pointerEvents="none" style={StyleSheet.absoluteFill}>
            <Animated.View style={[styles.frame, outStyle]} />
            <Animated.View style={[styles.frame, styles.incoming, inStyle]} />
        </View>
    );
}

const styles = StyleSheet.create({
    frame: {
        position: 'absolute',
        top: 0,
        left: 0,
        width: SCREEN_WIDTH,
        height: SCREEN_HEIGHT,
        backfaceVisibility: 'hidden',
    },
    incoming: {
        backgroundColor: 'rgba(127,127,127,0.02)',
    },
});