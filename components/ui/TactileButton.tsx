import React, { useState } from 'react';
import {
    Pressable,
    StyleSheet,
    View,
    Platform,
    LayoutChangeEvent,
} from 'react-native';
import { GestureDetector, Gesture } from 'react-native-gesture-handler';
import Animated, {
    useSharedValue,
    useAnimatedStyle,
    withSpring,
    runOnJS,
    ReduceMotion,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { useColorScheme } from '../../hooks/theme/use-color-scheme';

export const PHYSICS_PRESETS = {
    mechanical: { stiffness: 450, damping: 38, mass: 1.4, reduceMotion: ReduceMotion.System },
    fluid: { stiffness: 180, damping: 14, mass: 0.7, reduceMotion: ReduceMotion.System },
    magnetic: { stiffness: 300, damping: 24, mass: 1.0, reduceMotion: ReduceMotion.System },
};

interface TactileButtonProps {
    onPress?: () => void;
    children: React.ReactNode;
    className?: string;
    magneticStrength?: number; // max translation offset in pixels
    physicsPreset?: keyof typeof PHYSICS_PRESETS;
    hapticType?: 'light' | 'medium' | 'selection' | 'none';
    testID?: string;
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export function TactileButton({
    onPress,
    children,
    className = '',
    magneticStrength = 12,
    physicsPreset = 'magnetic',
    hapticType = 'light',
    testID,
}: TactileButtonProps) {
    const colorScheme = useColorScheme();
    const config = PHYSICS_PRESETS[physicsPreset];

    // Shared values for physics-driven translation & scale
    const translateX = useSharedValue(0);
    const translateY = useSharedValue(0);
    const scale = useSharedValue(1);
    const isPressed = useSharedValue(false);

    // Track layout coordinates to compute relative pointer offset
    const [layout, setLayout] = useState({ width: 0, height: 0 });

    const handleLayout = (e: LayoutChangeEvent) => {
        const { width, height } = e.nativeEvent.layout;
        setLayout({ width, height });
    };

    const triggerHaptic = (type: typeof hapticType) => {
        'worklet';
        if (Platform.OS === 'web' || type === 'none') return;
        runOnJS(() => {
            if (type === 'light') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            else if (type === 'medium') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            else Haptics.selectionAsync();
        })();
    };

    // Helper worklets to update and reset coordinates
    const updateCoordinates = (x: number, y: number) => {
        'worklet';
        if (layout.width > 0 && layout.height > 0) {
            const relativeX = x - layout.width / 2;
            const relativeY = y - layout.height / 2;
            const dist = Math.hypot(relativeX, relativeY) || 1;
            const pull = Math.min(dist, magneticStrength);
            translateX.value = withSpring((relativeX / dist) * pull, config);
            translateY.value = withSpring((relativeY / dist) * pull, config);
        }
    };

    const resetCoordinates = () => {
        'worklet';
        isPressed.value = false;
        scale.value = withSpring(1, config);
        translateX.value = withSpring(0, config);
        translateY.value = withSpring(0, config);
    };

    const panGesture = Gesture.Pan()
        .onBegin((event) => {
            isPressed.value = true;
            scale.value = withSpring(0.96, config);
            triggerHaptic(hapticType);
            updateCoordinates(event.x, event.y);
        })
        .onUpdate((event) => {
            updateCoordinates(event.x, event.y);
        })
        .onFinalize(() => {
            resetCoordinates();
        });

    const hoverGesture = Gesture.Hover()
        .onUpdate((event) => {
            if (!isPressed.value) {
                updateCoordinates(event.x, event.y);
            }
        })
        .onEnd(() => {
            if (!isPressed.value) {
                resetCoordinates();
            }
        });

    const gesture = Gesture.Simultaneous(panGesture, hoverGesture);

    // Button style linked to Reanimated values
    const buttonAnimatedStyle = useAnimatedStyle(() => {
        return {
            transform: [
                { translateX: translateX.value },
                { translateY: translateY.value },
                { scale: scale.value },
            ] as any,
            borderRadius: withSpring(isPressed.value ? 12 : 16, config),
        };
    });

    // Shadow moves in the opposite direction to translate light projection
    const shadowAnimatedStyle = useAnimatedStyle(() => {
        const shadowOpacityVal = colorScheme === 'dark' ? 0.4 : 0.15;
        return {
            opacity: withSpring(isPressed.value ? shadowOpacityVal * 1.5 : shadowOpacityVal, config),
            transform: [
                { translateX: translateX.value * -0.5 },
                { translateY: translateY.value * -0.5 },
                { scale: withSpring(isPressed.value ? 0.92 : 1, config) },
            ] as any,
        };
    });

    const containerStyle = colorScheme === 'dark' ? styles.containerDark : styles.containerLight;

    return (
        <GestureDetector gesture={gesture}>
            <View
                testID={testID}
                onLayout={handleLayout}
                style={[styles.wrapper]}
            >
                {/* 3D Drop Shadow layer */}
                <Animated.View
                    style={[
                        styles.shadow,
                        containerStyle,
                        shadowAnimatedStyle,
                    ]}
                />
                {/* Animated Button Face */}
                <AnimatedPressable
                    onPress={onPress}
                    style={[
                        styles.button,
                        buttonAnimatedStyle,
                    ]}
                    className={className}
                >
                    {children}
                </AnimatedPressable>
            </View>
        </GestureDetector>
    );
}

const styles = StyleSheet.create({
    wrapper: {
        position: 'relative',
        alignItems: 'stretch',
        justifyContent: 'center',
    },
    button: {
        overflow: 'hidden',
    },
    shadow: {
        ...StyleSheet.absoluteFillObject,
        borderRadius: 16,
        backgroundColor: '#000000',
    },
    containerLight: {
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: 6 },
        shadowRadius: 10,
        elevation: 6,
    },
    containerDark: {
        shadowColor: '#FFFFFF',
        shadowOffset: { width: 0, height: 4 },
        shadowRadius: 12,
        elevation: 8,
    },
});
