import AsyncStorage from '@react-native-async-storage/async-storage';
import { useColorScheme } from 'nativewind';
import { useCallback, useEffect, useState } from 'react';
import { loadRemoteUserSettings, saveRemoteUserSettings } from '@/services/settings/userSettingsRemote';

export type ThemePreference = 'light' | 'dark' | 'system';
export type EmojiStylePreference = 'native' | 'flat' | '3d';

const THEME_PREFERENCE_STORAGE_KEY = 'user-theme-preference';
const EMOJI_PREFERENCE_STORAGE_KEY = 'user-emoji-preference';

function isThemePreference(value: string | null): value is ThemePreference {
    return value === 'light' || value === 'dark' || value === 'system';
}

function isEmojiPreference(value: string | null): value is EmojiStylePreference {
    return value === 'native' || value === 'flat' || value === '3d';
}

export function useThemeSettings() {
    const { setColorScheme } = useColorScheme();
    const [theme, setThemeState] = useState<ThemePreference>('dark');
    const [emojiStyle, setEmojiStyleState] = useState<EmojiStylePreference>('native');
    const [isLoaded, setIsLoaded] = useState(false);

    const applyTheme = useCallback(
        (nextTheme: ThemePreference): boolean => {
            try {
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

        const loadSettings = async () => {
            try {
                // Load Theme
                const savedTheme = await AsyncStorage.getItem(THEME_PREFERENCE_STORAGE_KEY);
                const hasLocalTheme = isThemePreference(savedTheme);
                const nextTheme: ThemePreference = hasLocalTheme ? savedTheme : 'dark';

                const didApply = applyTheme(nextTheme);
                if (didApply && isMounted) {
                    setThemeState(nextTheme);
                }

                // Load Emoji Style
                const savedEmoji = await AsyncStorage.getItem(EMOJI_PREFERENCE_STORAGE_KEY);
                const hasLocalEmoji = isEmojiPreference(savedEmoji);
                if (hasLocalEmoji && isMounted) {
                    setEmojiStyleState(savedEmoji);
                }

                const remote = await loadRemoteUserSettings();
                if (remote && isMounted) {
                    if (!hasLocalTheme && remote.theme) {
                        const didApplyRemote = applyTheme(remote.theme);
                        if (didApplyRemote) {
                            setThemeState(remote.theme);
                            await AsyncStorage.setItem(THEME_PREFERENCE_STORAGE_KEY, remote.theme);
                        }
                    }

                    if (!hasLocalEmoji && remote.emojiStyle) {
                        setEmojiStyleState(remote.emojiStyle);
                        await AsyncStorage.setItem(EMOJI_PREFERENCE_STORAGE_KEY, remote.emojiStyle);
                    }
                } else if (!remote && (hasLocalTheme || hasLocalEmoji)) {
                    const emojiValue = hasLocalEmoji
                        ? (savedEmoji as EmojiStylePreference)
                        : undefined;
                    try {
                        await saveRemoteUserSettings({
                            theme: hasLocalTheme ? nextTheme : undefined,
                            emojiStyle: emojiValue,
                        });
                    } catch (error) {
                        console.error('Failed to seed remote settings', error);
                    }
                }

            } catch (error) {
                console.error('Failed to load settings', error);
            } finally {
                if (isMounted) {
                    setIsLoaded(true);
                }
            }
        };

        void loadSettings();

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

            try {
                await saveRemoteUserSettings({ theme: newTheme, emojiStyle });
            } catch (error) {
                console.error('Failed to sync theme preference', error);
            }
        },
        [applyTheme, emojiStyle]
    );

    const setEmojiStyle = useCallback(async (newStyle: EmojiStylePreference) => {
        setEmojiStyleState(newStyle);
        try {
            await AsyncStorage.setItem(EMOJI_PREFERENCE_STORAGE_KEY, newStyle);
        } catch (error) {
            console.error('Failed to save emoji preference', error);
        }

        try {
            await saveRemoteUserSettings({ theme, emojiStyle: newStyle });
        } catch (error) {
            console.error('Failed to sync emoji preference', error);
        }
    }, [theme]);

    return {
        theme,
        setTheme,
        emojiStyle,
        setEmojiStyle,
        isLoaded
    };
}
