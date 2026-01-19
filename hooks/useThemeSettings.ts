import { useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useColorScheme } from 'nativewind';

export type ThemePreference = 'light' | 'dark' | 'system';

export function useThemeSettings() {
  const { setColorScheme } = useColorScheme();
  const [theme, setThemeState] = useState<ThemePreference>('system');
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    loadTheme();
  }, []);

  const loadTheme = async () => {
    try {
      const savedTheme = await AsyncStorage.getItem('user-theme-preference');
      if (savedTheme === 'light' || savedTheme === 'dark' || savedTheme === 'system') {
        setThemeState(savedTheme as ThemePreference);
        setColorScheme(savedTheme as ThemePreference);
      } else {
        setThemeState('system');
        setColorScheme('system');
      }
    } catch (error) {
      console.error('Failed to load theme preference', error);
    } finally {
        setIsLoaded(true);
    }
  };

  const setTheme = async (newTheme: ThemePreference) => {
    try {
      setThemeState(newTheme);
      setColorScheme(newTheme);
      await AsyncStorage.setItem('user-theme-preference', newTheme);
    } catch (error) {
      console.error('Failed to save theme preference', error);
    }
  };

  return {
    theme,
    setTheme,
    isLoaded
  };
}
