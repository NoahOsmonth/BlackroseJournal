import AsyncStorage from '@react-native-async-storage/async-storage';
import { useColorScheme } from 'nativewind';
import { useCallback, useEffect, useState } from 'react';

export type ThemePreference = 'light' | 'dark' | 'system';

const THEME_PREFERENCE_STORAGE_KEY = 'user-theme-preference';

function isThemePreference(value: string | null): value is ThemePreference {
  return value === 'light' || value === 'dark' || value === 'system';
}

export function useThemeSettings() {
  const { setColorScheme } = useColorScheme();
  const [theme, setThemeState] = useState<ThemePreference>('system');
  const [isLoaded, setIsLoaded] = useState(false);

  const applyTheme = useCallback(
    (nextTheme: ThemePreference): boolean => {
      try {
        // NativeWind may throw on web if Tailwind isn't configured with darkMode: 'class'.
        setColorScheme(nextTheme);
        return true;
      } catch (error) {
        console.error('Failed to apply theme preference', error);
        return false;
      }
    },
    [setColorScheme]
  );

  useEffect(() => {
    let isMounted = true;

    const loadTheme = async () => {
      try {
        const savedTheme = await AsyncStorage.getItem(THEME_PREFERENCE_STORAGE_KEY);
        const nextTheme: ThemePreference = isThemePreference(savedTheme) ? savedTheme : 'system';

        const didApply = applyTheme(nextTheme);
        if (didApply && isMounted) {
          setThemeState(nextTheme);
        }
      } catch (error) {
        console.error('Failed to load theme preference', error);
      } finally {
        if (isMounted) {
          setIsLoaded(true);
        }
      }
    };

    void loadTheme();

    return () => {
      isMounted = false;
    };
  }, [applyTheme]);

  const setTheme = useCallback(
    async (newTheme: ThemePreference) => {
      const didApply = applyTheme(newTheme);
      if (!didApply) {
        return;
      }

      setThemeState(newTheme);

      try {
        await AsyncStorage.setItem(THEME_PREFERENCE_STORAGE_KEY, newTheme);
      } catch (error) {
        console.error('Failed to save theme preference', error);
      }
    },
    [applyTheme]
  );

  return {
    theme,
    setTheme,
    isLoaded
  };
}
