import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    type LayoutChangeEvent,
    Platform,
    type ViewProps,
    View,
} from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
    runOnJS,
    useAnimatedStyle,
    useSharedValue,
    withTiming,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';

import { useColorScheme } from '@/hooks/use-color-scheme';
import {
    RANGE_SLIDER_GROOVE_HEIGHT,
    RANGE_SLIDER_HIT_HEIGHT,
    RANGE_SLIDER_SNAP_MS,
    RANGE_SLIDER_THUMB_SIZE,
    RANGE_SLIDER_THUMB_WIDTH,
    RANGE_SLIDER_TICK_MAJOR_H,
    RANGE_SLIDER_TICK_MINOR_H,
    buildRangeSliderTicks,
    rangeSliderInstrumentPalette,
    roundToStep,
    valueToRatio,
} from '@/utils/rangeSlider';

export type { RangeSliderProps } from './rangeSlider.types';
export {
    RANGE_SLIDER_GROOVE_HEIGHT,
    RANGE_SLIDER_HIT_HEIGHT,
    RANGE_SLIDER_THUMB_SIZE,
    RANGE_SLIDER_THUMB_WIDTH,
    roundToStep,
} from '@/utils/rangeSlider';

import type { RangeSliderProps } from './rangeSlider.types';

/**
 * Precision-instrument slider (console fader language).
 *
 * Headless parts (Radix-equivalent for RN): Root → Track → Range → Thumb + Ticks.
 * Gesture Handler + Reanimated drive interaction; paint is solid hex only.
 */
const StyleSheetHairline = Platform.select({ ios: 0.5, android: 0.5, default: 1 }) ?? 1;

export function RangeSlider({
    value,
    min,
    max,
    step,
    onChange,
    onSliding,
    accessibilityLabel,
}: RangeSliderProps) {
    const colorScheme = useColorScheme();
    const isDark = colorScheme === 'dark';
    const palette = useMemo(() => rangeSliderInstrumentPalette(isDark), [isDark]);
    const ticks = useMemo(() => buildRangeSliderTicks(min, max, step), [min, max, step]);

    const widthSV = useSharedValue(0);
    const ratio = useSharedValue(valueToRatio(value, min, max));
    /** 0 = rest, 1 = hover, 2 = active press */
    const interaction = useSharedValue(0);
    const dragging = useSharedValue(false);
    const lastStepped = useSharedValue(roundToStep(value, step, min, max));
    const [hovered, setHovered] = useState(false);

    const minSV = useSharedValue(min);
    const maxSV = useSharedValue(max);
    const stepSV = useSharedValue(step);
    const hoverEdge = useSharedValue(palette.thumbEdgeHover);
    const restEdge = useSharedValue(palette.thumbEdge);

    const onSlidingRef = useRef(onSliding);
    const onChangeRef = useRef(onChange);
    onSlidingRef.current = onSliding;
    onChangeRef.current = onChange;

    useEffect(() => {
        minSV.value = min;
        maxSV.value = max;
        stepSV.value = step;
    }, [min, max, step, minSV, maxSV, stepSV]);

    useEffect(() => {
        hoverEdge.value = palette.thumbEdgeHover;
        restEdge.value = palette.thumbEdge;
    }, [palette.thumbEdgeHover, palette.thumbEdge, hoverEdge, restEdge]);

    useEffect(() => {
        if (dragging.value) return;
        ratio.value = valueToRatio(value, min, max);
        lastStepped.value = roundToStep(value, step, min, max);
    }, [value, min, max, step, dragging, ratio, lastStepped]);

    useEffect(() => {
        if (dragging.value) return;
        interaction.value = withTiming(hovered ? 1 : 0, { duration: RANGE_SLIDER_SNAP_MS });
    }, [hovered, dragging, interaction]);

    const publishSliding = useCallback((next: number) => {
        onSlidingRef.current?.(next);
    }, []);

    const commit = useCallback((next: number) => {
        onChangeRef.current(next);
    }, []);

    const fireStepHaptic = useCallback(() => {
        if (Platform.OS === 'web') return;
        void Haptics.selectionAsync();
    }, []);

    const snapRatioFromStepped = useCallback(
        (stepped: number) => {
            ratio.value = valueToRatio(stepped, min, max);
        },
        [max, min, ratio]
    );

    const gesture = useMemo(() => {
        const roundWorklet = (raw: number, s: number, lo: number, hi: number) => {
            'worklet';
            if (hi <= lo) return lo;
            if (s <= 0) return Math.min(Math.max(raw, lo), hi);
            const steps = Math.round((raw - lo) / s);
            let snapped = lo + steps * s;
            const decimals =
                s >= 1
                    ? 0
                    : Math.max(0, Math.min(6, Math.ceil(-Math.log(s) / Math.log(10) + 1e-9)));
            const factor = Math.pow(10, decimals);
            snapped = Math.round(snapped * factor) / factor;
            return Math.min(Math.max(snapped, lo), hi);
        };

        const ratioFromX = (x: number) => {
            'worklet';
            const w = widthSV.value;
            if (w <= 0) return ratio.value;
            return Math.min(Math.max(x / w, 0), 1);
        };

        const steppedFromRatio = (r: number) => {
            'worklet';
            const lo = minSV.value;
            const hi = maxSV.value;
            return roundWorklet(lo + r * (hi - lo), stepSV.value, lo, hi);
        };

        const applyContinuous = (x: number) => {
            'worklet';
            const r = ratioFromX(x);
            ratio.value = r;
            const stepped = steppedFromRatio(r);
            if (stepped !== lastStepped.value) {
                lastStepped.value = stepped;
                runOnJS(publishSliding)(stepped);
                runOnJS(fireStepHaptic)();
            }
        };

        const finishAtRatio = (r: number) => {
            'worklet';
            dragging.value = false;
            interaction.value = withTiming(0, { duration: RANGE_SLIDER_SNAP_MS });
            const stepped = steppedFromRatio(r);
            lastStepped.value = stepped;
            const lo = minSV.value;
            const hi = maxSV.value;
            const range = hi - lo;
            ratio.value = range <= 0 ? 0 : (stepped - lo) / range;
            runOnJS(publishSliding)(stepped);
            runOnJS(commit)(stepped);
        };

        const hitSlop = { top: 18, bottom: 18, left: 10, right: 10 };

        const pan = Gesture.Pan()
            .activeOffsetX([-3, 3])
            .failOffsetY([-14, 14])
            .hitSlop(hitSlop)
            .onStart((event) => {
                'worklet';
                dragging.value = true;
                interaction.value = withTiming(2, { duration: RANGE_SLIDER_SNAP_MS });
                applyContinuous(event.x);
            })
            .onUpdate((event) => {
                'worklet';
                applyContinuous(event.x);
            })
            .onFinalize(() => {
                'worklet';
                if (!dragging.value) return;
                finishAtRatio(ratio.value);
            });

        const tap = Gesture.Tap()
            .hitSlop(hitSlop)
            .onBegin(() => {
                'worklet';
                interaction.value = withTiming(2, { duration: RANGE_SLIDER_SNAP_MS });
            })
            .onEnd((event) => {
                'worklet';
                const r = ratioFromX(event.x);
                ratio.value = r;
                finishAtRatio(r);
            })
            .onFinalize(() => {
                'worklet';
                if (!dragging.value) {
                    interaction.value = withTiming(0, { duration: RANGE_SLIDER_SNAP_MS });
                }
            });

        return Gesture.Exclusive(pan, tap);
    }, [
        commit,
        fireStepHaptic,
        publishSliding,
        widthSV,
        ratio,
        interaction,
        dragging,
        lastStepped,
        minSV,
        maxSV,
        stepSV,
    ]);

    const handleLayout = useCallback(
        (event: LayoutChangeEvent) => {
            widthSV.value = event.nativeEvent.layout.width;
        },
        [widthSV]
    );

    const rangeStyle = useAnimatedStyle(() => ({
        width: Math.max(0, ratio.value * widthSV.value),
    }));

    const thumbStyle = useAnimatedStyle(() => {
        const w = widthSV.value;
        const d = RANGE_SLIDER_THUMB_SIZE;
        const left =
            w <= 0 ? 0 : Math.max(0, Math.min(w - d, ratio.value * w - d / 2));
        // Uniform scale only — keeps the disc round (no vertical squash).
        const level = interaction.value;
        const scale = level >= 2 ? 1.08 : level === 1 ? 1.04 : 1;
        return {
            left,
            transform: [{ scale }] as const,
        };
    });

    const thumbChromeStyle = useAnimatedStyle(() => {
        const active = interaction.value > 0;
        return {
            borderColor: active ? hoverEdge.value : restEdge.value,
            // Thin same-family ring only — never a heavy black outline.
            borderWidth: 1,
        };
    });

    const accessibilityNow = roundToStep(value, step, min, max);

    const a11yAdjust = useCallback(
        (direction: 1 | -1) => {
            const next = roundToStep(value + direction * step, step, min, max);
            if (next === accessibilityNow) return;
            snapRatioFromStepped(next);
            onSlidingRef.current?.(next);
            onChangeRef.current(next);
            if (Platform.OS !== 'web') {
                void Haptics.selectionAsync();
            }
        },
        [accessibilityNow, max, min, snapRatioFromStepped, step, value]
    );

    const webExtraProps = (
        Platform.OS === 'web'
            ? {
                  onMouseEnter: () => setHovered(true),
                  onMouseLeave: () => setHovered(false),
                  tabIndex: 0,
                  onKeyDown: (event: { key?: string; preventDefault?: () => void }) => {
                      const key = event.key;
                      if (key === 'ArrowRight' || key === 'ArrowUp') {
                          event.preventDefault?.();
                          a11yAdjust(1);
                      } else if (key === 'ArrowLeft' || key === 'ArrowDown') {
                          event.preventDefault?.();
                          a11yAdjust(-1);
                      } else if (key === 'Home') {
                          event.preventDefault?.();
                          snapRatioFromStepped(min);
                          onSlidingRef.current?.(min);
                          onChangeRef.current(min);
                      } else if (key === 'End') {
                          event.preventDefault?.();
                          snapRatioFromStepped(max);
                          onSlidingRef.current?.(max);
                          onChangeRef.current(max);
                      }
                  },
              }
            : {}
    ) as ViewProps;

    return (
        <GestureDetector gesture={gesture}>
            <View
                testID="range-slider"
                className="relative w-full justify-center"
                style={{ height: RANGE_SLIDER_HIT_HEIGHT }}
                onLayout={handleLayout}
                accessibilityRole="adjustable"
                accessibilityLabel={accessibilityLabel}
                accessibilityValue={{
                    min,
                    max,
                    now: accessibilityNow,
                    text: String(accessibilityNow),
                }}
                accessibilityActions={[
                    { name: 'increment', label: 'Increase' },
                    { name: 'decrement', label: 'Decrease' },
                ]}
                onAccessibilityAction={(event) => {
                    if (event.nativeEvent.actionName === 'increment') {
                        a11yAdjust(1);
                    } else if (event.nativeEvent.actionName === 'decrement') {
                        a11yAdjust(-1);
                    }
                }}
                {...webExtraProps}
            >
                {/* Ticks — fine hairlines (major taller) */}
                <View
                    testID="range-slider-ticks"
                    pointerEvents="none"
                    className="absolute left-0 right-0"
                    style={{
                        height: RANGE_SLIDER_TICK_MAJOR_H,
                        top: (RANGE_SLIDER_HIT_HEIGHT - RANGE_SLIDER_TICK_MAJOR_H) / 2 - 10,
                    }}
                >
                    {ticks.map((tick) => (
                        <View
                            key={`tick-${tick.value}`}
                            style={{
                                position: 'absolute',
                                left: `${tick.ratio * 100}%`,
                                marginLeft: -0.5,
                                width: tick.major ? 1.5 : 1,
                                height: tick.major
                                    ? RANGE_SLIDER_TICK_MAJOR_H
                                    : RANGE_SLIDER_TICK_MINOR_H,
                                bottom: 0,
                                backgroundColor: tick.major
                                    ? palette.tickMajor
                                    : palette.tickMinor,
                                borderRadius: 0.5,
                            }}
                        />
                    ))}
                </View>

                {/* Track (groove) */}
                <View
                    testID="range-slider-track"
                    pointerEvents="none"
                    className="w-full justify-center"
                    style={{
                        height: RANGE_SLIDER_GROOVE_HEIGHT + 4,
                        borderRadius: 1,
                        borderTopWidth: StyleSheetHairline,
                        borderBottomWidth: StyleSheetHairline,
                        borderColor: palette.grooveEdge,
                        backgroundColor: palette.groove,
                        overflow: 'hidden',
                    }}
                >
                    <Animated.View
                        testID="range-slider-fill"
                        style={[
                            {
                                position: 'absolute',
                                left: 0,
                                top: 0,
                                bottom: 0,
                                backgroundColor: palette.range,
                            },
                            rangeStyle,
                        ]}
                    />
                </View>

                {/* Thumb — compact circle, vertically centered on the groove */}
                <Animated.View
                    testID="range-slider-thumb"
                    pointerEvents="none"
                    className="absolute top-1/2"
                    style={[
                        {
                            width: RANGE_SLIDER_THUMB_SIZE,
                            height: RANGE_SLIDER_THUMB_SIZE,
                            // Center the disc on the track midline (parent is justify-center).
                            marginTop: -(RANGE_SLIDER_THUMB_SIZE / 2),
                            borderRadius: RANGE_SLIDER_THUMB_SIZE / 2,
                            backgroundColor: palette.thumbBody,
                            zIndex: 2,
                            // Soft depth — not a hard cartoon outline.
                            shadowColor: '#000000',
                            shadowOpacity: isDark ? 0.35 : 0.16,
                            shadowRadius: 3,
                            shadowOffset: { width: 0, height: 1 },
                            elevation: 2,
                        },
                        thumbStyle,
                        thumbChromeStyle,
                    ]}
                />
            </View>
        </GestureDetector>
    );
}
