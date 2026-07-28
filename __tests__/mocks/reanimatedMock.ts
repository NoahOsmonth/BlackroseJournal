export function mockReanimated() {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { View } = require('react-native');

    return {
        __esModule: true,
        default: {
            View,
            createAnimatedComponent: (Component: unknown) => Component,
        },
        useSharedValue: (value: number) => ({ value }),
        useAnimatedStyle: (factory: () => object) => factory(),
        useReducedMotion: () => false,
        withTiming: (value: unknown) => value,
        withRepeat: (value: unknown) => value,
        withDelay: (_delay: unknown, value: unknown) => value,
        withSequence: (...values: unknown[]) => values.at(-1),
        withSpring: (value: unknown) => value,
        Easing: { inOut: (value: unknown) => value, ease: 0 },
        ReduceMotion: { System: 'system' },
        FadeInDown: { duration: () => ({}) },
        FadeOutUp: { duration: () => ({}) },
    };
}
