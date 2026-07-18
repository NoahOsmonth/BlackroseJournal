import React from 'react';
import { Text, View } from 'react-native';

interface KeyThemesProps {
    themes: string[];
}

export function KeyThemes({ themes }: KeyThemesProps) {
    const mainTheme = themes && themes.length > 0 ? themes[0] : null;
    const secondaryThemes = themes && themes.length > 1 ? themes.slice(1) : [];

    return (
        <View className="rounded-2xl border border-divider-light dark:border-divider-dark bg-surface-light dark:bg-surface-dark px-5 py-5">
            <Text className="text-xs font-semibold text-text-secondary-light dark:text-text-secondary-dark">
                Themes
            </Text>

            {!mainTheme ? (
                <Text className="mt-3 text-sm leading-relaxed text-text-secondary-light dark:text-text-secondary-dark">
                    Themes need a few entries. Keep journaling and patterns will surface.
                </Text>
            ) : (
                <>
                    <Text
                        className="mt-3 text-2xl font-bold leading-snug text-text-light dark:text-text-dark"
                        style={{ fontFamily: 'PlayfairDisplayBold' }}
                    >
                        {mainTheme}
                    </Text>
                    {secondaryThemes.length > 0 ? (
                        <View className="mt-4 flex-row flex-wrap gap-2">
                            {secondaryThemes.map((theme) => (
                                <View
                                    key={theme}
                                    className="rounded-full bg-background-light dark:bg-background-dark px-3 py-1.5"
                                >
                                    <Text className="text-xs font-medium text-text-light dark:text-text-dark">
                                        {theme}
                                    </Text>
                                </View>
                            ))}
                        </View>
                    ) : null}
                </>
            )}
        </View>
    );
}
