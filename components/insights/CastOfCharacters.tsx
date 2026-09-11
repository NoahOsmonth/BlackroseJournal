import React from 'react';
import { Text, View } from 'react-native';

interface CastOfCharactersProps {
    characters: string[];
}

export function CastOfCharacters({ characters }: CastOfCharactersProps) {
    const list = characters ?? [];

    return (
        <View className="rounded-card border border-hairline-light dark:border-hairline-dark bg-surface-light dark:bg-surface-dark px-5 py-5">
            <Text
                className="text-[19px] text-text-light dark:text-text-dark"
                style={{ fontFamily: 'PlayfairDisplayRegular' }}
            >
                Cast of characters
            </Text>

            {list.length === 0 ? (
                <Text className="mt-3 text-[15px] leading-[23px] text-text-secondary-light dark:text-text-secondary-dark">
                    People will appear here after they show up across your entries.
                </Text>
            ) : (
                <View className="mt-3 flex-row flex-wrap gap-2">
                    {list.map((name) => (
                        <View
                            key={name}
                            className="rounded-full border border-hairline-light dark:border-hairline-dark px-3 py-1.5"
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
