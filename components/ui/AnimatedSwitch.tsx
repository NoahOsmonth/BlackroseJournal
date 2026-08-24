import React from 'react';
import { Pressable, StyleSheet, View, AccessibilityProps } from 'react-native';
import Animated, {
    useSharedValue,
    useAnimatedStyle,
    withSpring,
    ReduceMotion,
} from 'react-native-reanimated';
import { useColorScheme } from '@/hooks/use-color-scheme';
import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

const SPRING_CONFIG = {
    damping: 22,
    stiffness: 280,
    mass: 0.8,
    reduceMotion: ReduceMotion.System,
};

interface AnimatedSwitchProps extends AccessibilityProps {
    value: boolean;
    onValueChange: (value: boolean) => void;
    disabled?: boolean;
    thumbColor?: string;
    trackColorOn?: string;
    trackColorOff?: string;
    testID?: string;
}

export function AnimatedSwitch({
    value,
    onValueChange,
    disabled = false,
    thumbColor = '#FFFFFF',
    trackColorOn,
    trackColorOff,
    testID,
    accessibilityLabel,
    accessibilityState,
    ...accessibilityProps
}: AnimatedSwitchProps) {
    const isDark = useColorScheme() === 'dark';
    const translateX = useSharedValue(value ? 28 : 0);
    const trackBg = useSharedValue(value ? (trackColorOn ?? (isDark ? '#10B981' : '#059669')) : (trackColorOff ?? '#D1D5DB'));

    React.useEffect(() => {
        translateX.value = withSpring(value ? 28 : 0, SPRING_CONFIG);
        trackBg.value = withSpring(value ? (trackColorOn ?? (isDark ? '#10B981' : '#059669')) : (trackColorOff ?? '#D1D5DB'), SPRING_CONFIG);
    }, [value, trackColorOn, trackColorOff, isDark]);

    const triggerHaptic = () => {
        'worklet';
        if (Platform.OS === 'web') return;
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    };

    const handlePress = () => {
        if (disabled) return;
        const nextValue = !value;
        onValueChange(nextValue);
        triggerHaptic();
    };

    const animatedTrackStyle = useAnimatedStyle(() => ({
        backgroundColor: trackBg.value,
    }));

    const animatedThumbStyle = useAnimatedStyle(() => ({
        transform: [{ translateX: translateX.value }],
    }));

    return (
        <Pressable
            onPress={handlePress}
            disabled={disabled}
            accessibilityRole="switch"
            accessibilityState={{ checked: value, disabled, ...accessibilityState }}
            accessibilityLabel={accessibilityLabel}
            testID={testID}
            hitSlop={8}
            android_ripple={disabled ? undefined : { color: 'rgba(0,0,0,0.1)', borderless: true, radius: 24 }}
            {...accessibilityProps}
        >
            <View style={styles.trackContainer}>
                <Animated.View style={[styles.track, animatedTrackStyle]} />
                <Animated.View style={[styles.thumb, animatedThumbStyle, { backgroundColor: thumbColor }]} />
            </View>
        </Pressable>
    );
}

const styles = StyleSheet.create({
    trackContainer: {
        width: 52,
        height: 30,
        borderRadius: 15,
        position: 'relative',
    },
    track: {
        ...StyleSheet.absoluteFillObject,
        borderRadius: 15,
    },
    thumb: {
        position: 'absolute',
        top: 3,
        left: 3,
        width: 24,
        height: 24,
        borderRadius: 12,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowRadius: 4,
        shadowOpacity: 0.2,
        elevation: 3,
    },
});