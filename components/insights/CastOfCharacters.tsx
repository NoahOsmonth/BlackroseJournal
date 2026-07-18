import React from 'react';
import { Text, View } from 'react-native';

interface CastOfCharactersProps {
    characters: string[];
}

export function CastOfCharacters({ characters }: CastOfCharactersProps) {
    const list = characters ?? [];

    return (
        <View className="rounded-2xl border border-divider-light dark:border-divider-dark bg-surface-light dark:bg-surface-dark px-5 py-5">
            <Text className="text-xs font-semibold text-text-secondary-light dark:text-text-secondary-dark">
                People
            </Text>

            {list.length === 0 ? (
                <Text className="mt-3 text-sm leading-relaxed text-text-secondary-light dark:text-text-secondary-dark">
                    People will appear here after they show up across your entries.
                </Text>
            ) : (
                <View className="mt-3 flex-row flex-wrap gap-2">
                    {list.map((name) => (
                        <View
                            key={name}
                            className="rounded-full border border-divider-light dark:border-divider-dark px-3 py-1.5"
                        >
                            <Text className="text-sm text-text-light dark:text-text-dark">
                                {name}
                            </Text>
                        </View>
                    ))}
                </View>
            )}
        </View>
    );
}
