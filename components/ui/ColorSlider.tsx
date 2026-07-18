import React, { useCallback, useEffect, useMemo, useRef } from 'react';
import { type LayoutChangeEvent, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
    runOnJS,
    useAnimatedStyle,
    useSharedValue,
    withSpring,
} from 'react-native-reanimated';

export interface ColorSliderProps {
    readonly ariaLabel: string;
    readonly trackColors: readonly string[];
    readonly thumbColor?: string;
    /** 0–1 position along the track. */
    readonly valueRatio: number;
    readonly onChange: (ratio: number) => void;
}

const THUMB_SIZE = 22;
const HIT_HEIGHT = 40;
const TRACK_HEIGHT = 12;
const THUMB_SPRING = { damping: 18, stiffness: 420, mass: 0.55 };

/**
 * Continuous hue/tone track for the color picker.
 * UI-thread pan (Gesture Handler + Reanimated) so the thumb follows the finger
 * without locationX drift or ScrollView gesture theft.
 */
export function ColorSlider({
    ariaLabel,
    trackColors,
    thumbColor = '#FFFFFF',
    valueRatio,
    onChange,
}: ColorSliderProps) {
    const widthSV = useSharedValue(0);
    const ratio = useSharedValue(Math.min(Math.max(valueRatio, 0), 1));
    const thumbScale = useSharedValue(1);
    const dragging = useSharedValue(false);

    const onChangeRef = useRef(onChange);
    onChangeRef.current = onChange;

    useEffect(() => {
        if (dragging.value) return;
        ratio.value = Math.min(Math.max(valueRatio, 0), 1);
    }, [valueRatio, dragging, ratio]);

    const publish = useCallback((next: number) => {
        onChangeRef.current(next);
    }, []);

    const gesture = useMemo(() => {
        const ratioFromX = (x: number) => {
            'worklet';
            const w = widthSV.value;
            if (w <= 0) return ratio.value;
            return Math.min(Math.max(x / w, 0), 1);
        };

        const applyX = (x: number) => {
            'worklet';
            const r = ratioFromX(x);
            ratio.value = r;
            runOnJS(publish)(r);
        };

        const pan = Gesture.Pan()
            .activeOffsetX([-5, 5])
            .failOffsetY([-14, 14])
            .hitSlop({ top: 8, bottom: 8 })
            .onStart((event) => {
                'worklet';
                dragging.value = true;
                thumbScale.value = withSpring(1.12, THUMB_SPRING);
                applyX(event.x);
            })
            .onUpdate((event) => {
                'worklet';
                applyX(event.x);
            })
            .onFinalize(() => {
                'worklet';
                if (!dragging.value) return;
                dragging.value = false;
                thumbScale.value = withSpring(1, THUMB_SPRING);
                runOnJS(publish)(ratio.value);
            });

        const tap = Gesture.Tap()
            .hitSlop({ top: 8, bottom: 8 })
            .onBegin(() => {
                'worklet';
                thumbScale.value = withSpring(1.12, THUMB_SPRING);
            })
            .onEnd((event) => {
                'worklet';
                applyX(event.x);
            })
            .onFinalize(() => {
                'worklet';
                if (!dragging.value) {
                    thumbScale.value = withSpring(1, THUMB_SPRING);
                }
            });

        return Gesture.Exclusive(pan, tap);
    }, [publish, widthSV, ratio, thumbScale, dragging]);

    const handleLayout = useCallback(
        (event: LayoutChangeEvent) => {
            widthSV.value = event.nativeEvent.layout.width;
        },
        [widthSV]
    );

    const thumbStyle = useAnimatedStyle(() => {
        const w = widthSV.value;
        const left =
            w <= 0
                ? 0
                : Math.max(0, Math.min(w - THUMB_SIZE, ratio.value * w - THUMB_SIZE / 2));
        return {
            left,
            transform: [{ scale: thumbScale.value }],
        };
    });

    return (
        <GestureDetector gesture={gesture}>
            <View
                accessibilityLabel={ariaLabel}
                accessibilityRole="adjustable"
                accessibilityValue={{
                    min: 0,
                    max: 100,
                    now: Math.round(valueRatio * 100),
                }}
                onLayout={handleLayout}
                className="relative w-full justify-center"
                style={{ height: HIT_HEIGHT }}
            >
                <View
                    pointerEvents="none"
                    className="w-full overflow-hidden rounded-full flex-row"
                    style={{ height: TRACK_HEIGHT }}
                >
                    {trackColors.map((color, index) => (
                        <View
                            key={`${color}-${index}`}
                            className="flex-1"
                            style={{ backgroundColor: color }}
                        />
                    ))}
                </View>
                <Animated.View
                    pointerEvents="none"
                    className="absolute top-1/2 rounded-full border-2 border-white"
                    style={[
                        {
                            width: THUMB_SIZE,
                            height: THUMB_SIZE,
                            marginTop: -(THUMB_SIZE / 2),
                            backgroundColor: thumbColor,
                            shadowColor: '#000000',
                            shadowOpacity: 0.25,
                            shadowRadius: 3,
                            shadowOffset: { width: 0, height: 1 },
                            elevation: 3,
                        },
                        thumbStyle,
                    ]}
                />
            </View>
        </GestureDetector>
    );
}
