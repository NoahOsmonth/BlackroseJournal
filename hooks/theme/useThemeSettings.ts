import AsyncStorage from '@react-native-async-storage/async-storage';
import { useColorScheme } from 'nativewind';
import { useCallback, useEffect, useRef, useState } from 'react';

import {
    DEFAULT_COLOR_THEME,
    colorThemeFromPreset,
    normalizeHexColor,
    updateColorThemeSlot,
    type ColorTheme,
    type ColorThemePresetId,
    type ColorThemeSlot,
} from '@/constants/theme';
import { loadRemoteUserSettings, saveRemoteUserSettings } from '@/services/settings/userSettingsRemote';
import { loadStoredColorTheme, saveStoredColorTheme } from '@/services/theme/colorThemeStorage';

export type ThemePreference = 'light' | 'dark' | 'system';
export type EmojiStylePreference = 'native' | 'flat' | '3d';

const THEME_PREFERENCE_STORAGE_KEY = 'user-theme-preference';
const EMOJI_PREFERENCE_STORAGE_KEY = 'user-emoji-preference';

interface ThemeSettingsState {
    readonly theme: ThemePreference;
    readonly emojiStyle: EmojiStylePreference;
    readonly colorTheme: ColorTheme;
    readonly isLoaded: boolean;
}

const DEFAULT_SETTINGS_STATE: ThemeSettingsState = {
    theme: 'dark',
    emojiStyle: 'native',
    colorTheme: DEFAULT_COLOR_THEME,
    isLoaded: false,
};

let sharedSettingsState = DEFAULT_SETTINGS_STATE;
const settingsSubscribers = new Set<(state: ThemeSettingsState) => void>();

function publishSettings(partial: Partial<ThemeSettingsState>) {
    sharedSettingsState = { ...sharedSettingsState, ...partial };
    settingsSubscribers.forEach((listener) => listener(sharedSettingsState));
}

function isThemePreference(value: string | null): value is ThemePreference {
    return value === 'light' || value === 'dark' || value === 'system';
}

function isEmojiPreference(value: string | null): value is EmojiStylePreference {
    return value === 'native' || value === 'flat' || value === '3d';
}

export function useThemeSettings() {
    const didStartLoad = useRef(false);

    // Defensive: nativewind's useColorScheme can throw on some Android
    // configurations (e.g. when the cssInterop darkMode flag isn't initialized
    // before the first render). Wrap the lookup in try/catch and stash the
    // resolved setter in a ref so the function reference stays stable across
    // renders and downstream useCallbacks don't have to list it as a dep.
    const setColorSchemeRef = useRef<(scheme: ThemePreference) => void>(() => {
        // no-op fallback until nativewind is ready
    });
    try {
        const colorSchemeApi = useColorScheme();
        if (colorSchemeApi && typeof colorSchemeApi.setColorScheme === 'function') {
            setColorSchemeRef.current = colorSchemeApi.setColorScheme;
        }
    } catch {
        // Keep the no-op fallback.
    }
    const setColorSchemeSafe = setColorSchemeRef.current;

    const [settings, setSettings] = useState<ThemeSettingsState>(sharedSettingsState);

    useEffect(() => {
        settingsSubscribers.add(setSettings);
        setSettings(sharedSettingsState);
        return () => {
            settingsSubscribers.delete(setSettings);
        };
    }, []);

    const applyTheme = useCallback(
        (nextTheme: ThemePreference): boolean => {
            try {
                setColorSchemeSafe(nextTheme);
                return true;
            } catch (error) {
                console.error('Failed to apply theme preference', error);
                return false;
            }
        },
        [setColorSchemeSafe]
    );

    useEffect(() => {
        if (didStartLoad.current) {
            return;
        }
        didStartLoad.current = true;

        const loadSettings = async () => {
            try {
                const [savedTheme, savedEmoji, storedColorTheme] = await Promise.all([
                    AsyncStorage.getItem(THEME_PREFERENCE_STORAGE_KEY),
                    AsyncStorage.getItem(EMOJI_PREFERENCE_STORAGE_KEY),
                    loadStoredColorTheme(),
                ]);
                const hasLocalTheme = isThemePreference(savedTheme);
                const hasLocalEmoji = isEmojiPreference(savedEmoji);
                const nextTheme: ThemePreference = hasLocalTheme ? savedTheme : 'dark';

                if (applyTheme(nextTheme)) {
                    publishSettings({ theme: nextTheme });
                }

                publishSettings({
                    colorTheme: storedColorTheme,
                    emojiStyle: hasLocalEmoji ? savedEmoji : sharedSettingsState.emojiStyle,
                });

                const remote = await loadRemoteUserSettings();
                if (remote) {
                    if (!hasLocalTheme && remote.theme) {
                        const didApplyRemote = applyTheme(remote.theme);
                        if (didApplyRemote) {
                            publishSettings({ theme: remote.theme });
                            await AsyncStorage.setItem(THEME_PREFERENCE_STORAGE_KEY, remote.theme);
                        }
                    }

                    if (!hasLocalEmoji && remote.emojiStyle) {
                        publishSettings({ emojiStyle: remote.emojiStyle });
                        await AsyncStorage.setItem(EMOJI_PREFERENCE_STORAGE_KEY, remote.emojiStyle);
                    }
                } else if (hasLocalTheme || hasLocalEmoji) {
                    try {
                        await saveRemoteUserSettings({
                            theme: hasLocalTheme ? nextTheme : undefined,
                            emojiStyle: hasLocalEmoji ? savedEmoji : undefined,
                        });
                    } catch (error) {
                        console.error('Failed to seed remote settings', error);
                    }
                }
            } catch (error) {
                console.error('Failed to load settings', error);
            } finally {
                publishSettings({ isLoaded: true });
            }
        };

        void loadSettings();
    }, [applyTheme]);

    const setTheme = useCallback(
        async (newTheme: ThemePreference) => {
            if (!applyTheme(newTheme)) {
                return;
            }

            publishSettings({ theme: newTheme });

            try {
                await AsyncStorage.setItem(THEME_PREFERENCE_STORAGE_KEY, newTheme);
            } catch (error) {
                console.error('Failed to save theme preference', error);
            }

            try {
                await saveRemoteUserSettings({
                    theme: newTheme,
                    emojiStyle: sharedSettingsState.emojiStyle,
                });
            } catch (error) {
                console.error('Failed to sync theme preference', error);
            }
        },
        [applyTheme]
    );

    const setEmojiStyle = useCallback(async (newStyle: EmojiStylePreference) => {
        publishSettings({ emojiStyle: newStyle });
        try {
            await AsyncStorage.setItem(EMOJI_PREFERENCE_STORAGE_KEY, newStyle);
        } catch (error) {
            console.error('Failed to save emoji preference', error);
        }

        try {
            await saveRemoteUserSettings({
                theme: sharedSettingsState.theme,
                emojiStyle: newStyle,
            });
        } catch (error) {
            console.error('Failed to sync emoji preference', error);
        }
    }, []);

    const setColorThemePreset = useCallback(async (presetId: ColorThemePresetId) => {
        const nextColorTheme = colorThemeFromPreset(presetId);
        publishSettings({ colorTheme: nextColorTheme });

        try {
            await saveStoredColorTheme(nextColorTheme);
        } catch (error) {
            console.error('Failed to save color theme preset', error);
        }
    }, []);

    const setColorThemeColor = useCallback(
        async (slot: ColorThemeSlot, value: string): Promise<boolean> => {
            const nextColorTheme = updateColorThemeSlot(sharedSettingsState.colorTheme, slot, value);
            if (!nextColorTheme) {
                return false;
            }

            publishSettings({ colorTheme: nextColorTheme });

            try {
                await saveStoredColorTheme(nextColorTheme);
            } catch (error) {
                console.error('Failed to save custom color theme', error);
            }

            return true;
        },
        []
    );

    /**
     * Apply a picker edit: set the source slot to `value` and, when
     * `syncPartner` is true, also rewrite the partner slot to
     * `partnerValue`. This is the path the Color Studio uses so picking
     * a single color can refresh the dark/light counterpart atomically.
     */
    const applyColorThemeEdit = useCallback(
        async (edit: {
            readonly slot: ColorThemeSlot;
            readonly value: string;
            readonly partnerSlot: ColorThemeSlot;
            readonly partnerValue: string;
            readonly syncPartner: boolean;
        }): Promise<boolean> => {
            const sourceNormalized = normalizeHexColor(edit.value);
            if (!sourceNormalized) {
                return false;
            }
            const partnerNormalized = edit.syncPartner
                ? normalizeHexColor(edit.partnerValue)
                : null;
            const nextColors: Record<ColorThemeSlot, string> = {
                ...sharedSettingsState.colorTheme.colors,
                [edit.slot]: sourceNormalized,
            };
            if (edit.syncPartner && partnerNormalized) {
                nextColors[edit.partnerSlot] = partnerNormalized;
            }
            const nextColorTheme: ColorTheme = {
                presetId: 'custom',
                colors: nextColors,
            };
            publishSettings({ colorTheme: nextColorTheme });
            try {
                await saveStoredColorTheme(nextColorTheme);
            } catch (error) {
                console.error('Failed to save color theme edit', error);
            }
            return true;
        },
        []
    );

    const resetColorTheme = useCallback(async () => {
        publishSettings({ colorTheme: DEFAULT_COLOR_THEME });
        try {
            await saveStoredColorTheme(DEFAULT_COLOR_THEME);
        } catch (error) {
            console.error('Failed to reset color theme', error);
        }
    }, []);

    return {
        theme: settings.theme,
        setTheme,
        emojiStyle: settings.emojiStyle,
        setEmojiStyle,
        colorTheme: settings.colorTheme,
        setColorThemePreset,
        setColorThemeColor,
        applyColorThemeEdit,
        resetColorTheme,
        isLoaded: settings.isLoaded,
    };
}
