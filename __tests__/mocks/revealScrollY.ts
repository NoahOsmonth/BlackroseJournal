import type { SharedValue } from 'react-native-reanimated';

/** A stand-in scroll offset for revealing items in tests. */
export function createScrollY(value = 0): SharedValue<number> {
    return { value } as unknown as SharedValue<number>;
}
