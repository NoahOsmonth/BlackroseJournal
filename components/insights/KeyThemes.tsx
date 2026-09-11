import React from 'react';
import { Text, View } from 'react-native';

interface KeyThemesProps {
    themes: string[];
}

export function KeyThemes({ themes }: KeyThemesProps) {
    const list = (themes ?? []).filter((theme) => theme.trim().length > 0);

    return (
        <View className="rounded-card border border-hairline-light dark:border-hairline-dark bg-surface-light dark:bg-surface-dark px-5 py-5">
            <Text
                className="text-[19px] text-text-light dark:text-text-dark"
                style={{ fontFamily: 'PlayfairDisplayRegular' }}
            >
                Key themes
            </Text>

            {list.length === 0 ? (
                <Text className="mt-3 text-[15px] leading-[23px] text-text-secondary-light dark:text-text-secondary-dark">
                    Themes need a few entries. Keep journaling and patterns will surface.
                </Text>
            ) : (
                <View className="mt-4 flex-row flex-wrap gap-2">
                    {list.map((theme) => (
                        <View
                            key={theme}
                            className="rounded-full border border-hairline-light px-4 py-2 dark:border-hairline-dark"
                        >
                            <Text className="text-[14px] text-text-light dark:text-text-dark">
                                {theme}
                            </Text>
                        </View>
                    ))}
                </View>
            )}
        </View>
    );
}
