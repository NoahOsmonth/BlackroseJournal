import React from 'react';
import { Pressable, Text, View } from 'react-native';

import { memoryRangeRatio, MEMORY_RANGE_STOPS } from '@/utils/memoryRange';

interface RailProps {
    /** Active stop index into MEMORY_RANGE_STOPS. */
    value: number;
    onChange: (index: number) => void;
}

const HANDLE_SIZE = 14;
/** 44pt touch target centred on each tick. */
const ZONE_SIZE = 44;

/**
 * The concept's time rail (black-rose-threads.png): a hairline track, five
 * graduation ticks, the active window named at the left, and a bone handle
 * resting on the chosen tick. Each tick is its own button, so the rail works
 * with a tap, a screen reader, and a keyboard without a drag gesture.
 */
export function MemoryGraphRangeRail({ value, onChange }: RailProps) {
    const activeStop = MEMORY_RANGE_STOPS[Math.min(Math.max(value, 0), MEMORY_RANGE_STOPS.length - 1)];

    return (
        <View className="flex-row items-center gap-3 px-5 py-2">
            <Text
                className="w-[74px] text-[15px] text-text-light dark:text-text-dark"
                style={{ fontFamily: 'PlayfairDisplayRegular' }}
                numberOfLines={1}
            >
                {activeStop.label}
            </Text>

            <View testID="memory-range-track" className="relative h-11 flex-1 justify-center">
                <View className="h-px w-full bg-hairline-light dark:bg-hairline-dark" />

                {MEMORY_RANGE_STOPS.map((stop, index) => {
                    const ratio = memoryRangeRatio(index);
                    return (
                        <Pressable
                            key={stop.key}
                            testID={`memory-range-stop-${stop.key}`}
                            accessibilityRole="button"
                            accessibilityLabel={`Show memories from the ${stop.label.toLowerCase()}`}
                            accessibilityState={{ selected: index === value }}
                            onPress={() => onChange(index)}
                            className="absolute top-0 h-11 items-center justify-center"
                            style={{ left: `${ratio * 100}%`, width: ZONE_SIZE, marginLeft: -ZONE_SIZE / 2 }}
                        >
                            <View
                                pointerEvents="none"
                                className="h-[9px] w-px bg-hairline-light dark:bg-hairline-dark"
                            />
                        </Pressable>
                    );
                })}

                <View
                    pointerEvents="none"
                    testID="memory-range-handle"
                    className="absolute rounded-full bg-bone-light dark:bg-bone-dark"
                    style={{
                        left: `${memoryRangeRatio(value) * 100}%`,
                        width: HANDLE_SIZE,
                        height: HANDLE_SIZE,
                        marginLeft: -HANDLE_SIZE / 2,
                        top: '50%',
                        marginTop: -HANDLE_SIZE / 2,
                    }}
                />
            </View>
        </View>
    );
}
