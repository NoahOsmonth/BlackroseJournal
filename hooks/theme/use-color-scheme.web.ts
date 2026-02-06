import { useColorScheme as useNativeWindColorScheme } from 'nativewind';

/**
 * On web, use NativeWind's hook so setColorScheme('dark') is respected.
 */
export function useColorScheme() {
    const { colorScheme } = useNativeWindColorScheme();
    return colorScheme;
}
