import { useColorScheme as useNativeWindColorScheme } from 'nativewind';

export type AppColorScheme = 'light' | 'dark' | null;

const SAFE_FALLBACK: AppColorScheme = 'dark';

function isAppColorScheme(value: unknown): value is AppColorScheme {
    return value === 'light' || value === 'dark' || value === null;
}

/**
 * Local `useColorScheme` wrapper around nativewind's hook.
 *
 * Nativewind's `useColorScheme` reads react-native-css-interop's `darkMode`
 * flag at first render. On Android the cssInterop runtime occasionally
 * surfaces that flag after the first paint, and calling the nativewind hook
 * during the very first root-layout render can throw. The throw happens
 * outside any `AppErrorBoundary` in `app/_layout.tsx` (the hook is called
 * at the top of the component, before the boundary is mounted), which is
 * what produces Expo Go's "Something went wrong" redbox on Android.
 *
 * To make the app robust against this race we:
 *  1. Wrap the nativewind call in try/catch.
 *  2. Coerce any non-string / unexpected return value to a known shape.
 *  3. Fall back to 'dark' (the app's default) so the UI still renders
 *     something sensible until the runtime catches up.
 */
export function useColorScheme(): AppColorScheme {
    let candidate: unknown = SAFE_FALLBACK;
    try {
        const api = useNativeWindColorScheme();
        if (api && typeof api === 'object' && 'colorScheme' in api) {
            candidate = (api as { colorScheme: unknown }).colorScheme;
        }
    } catch {
        // Keep the fallback — see the comment above for why.
    }
    return isAppColorScheme(candidate) ? candidate : SAFE_FALLBACK;
}
