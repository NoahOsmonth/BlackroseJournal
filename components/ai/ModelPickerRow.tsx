import React from 'react';
import { Pressable, Text, View } from 'react-native';

import { useColorScheme } from '@/hooks/use-color-scheme';
import { formatContextWindow } from '@/services/ai/modelContext';
import type { ChatModelOption } from '@/features/chat/modelPicker.types';
import { formatPickerModelName, isFreeModelId } from '@/utils/ai/modelDisplay';
import { BLACKROSE_PALETTE } from '@/constants/theme';
import { FreeModelBadge } from './FreeModelBadge';

type ModelPickerRowProps = {
    readonly model: ChatModelOption;
    readonly selected: boolean;
    readonly onPress: () => void;
};

/** Hairline row: serif name, quiet metadata, a word marker when active. */
export function ModelPickerRow({ model, selected, onPress }: ModelPickerRowProps) {
    const isDark = useColorScheme() === 'dark';
    const ink = isDark ? BLACKROSE_PALETTE.dark.text : BLACKROSE_PALETTE.light.text;
    const quietInk = isDark ? BLACKROSE_PALETTE.dark.text2 : BLACKROSE_PALETTE.light.text2;
    const free = isFreeModelId(model.id);
    const displayName = model.name ?? formatPickerModelName(model.id);
    const unavailable = model.availability === 'unavailable';

    return (
        <Pressable
            onPress={onPress}
            disabled={unavailable}
            accessibilityRole="radio"
            accessibilityState={{ selected, disabled: unavailable }}
            accessibilityLabel={`Select ${displayName}`}
            className={`min-h-14 flex-row items-center gap-3 border-b border-hairline-light px-1 py-3.5 active:opacity-80 dark:border-hairline-dark ${
                unavailable ? 'opacity-50' : ''
            }`}
        >
            <View className="min-w-0 flex-1 gap-1">
                <View className="flex-row items-center gap-2">
                    <Text
                        numberOfLines={1}
                        className="flex-1 text-[19px] text-text-light dark:text-text-dark"
                        style={{ fontFamily: 'PlayfairDisplayRegular' }}
                    >
                        {displayName}
                    </Text>
                    {free ? <FreeModelBadge compact /> : null}
                    <Text className="shrink-0 text-[13px] text-text-secondary-light dark:text-text-secondary-dark">
                        {formatContextWindow(model.contextWindow)}
                    </Text>
                </View>
                <Text
                    numberOfLines={1}
                    ellipsizeMode="middle"
                    className="text-[13px] text-text-secondary-light dark:text-text-secondary-dark"
                >
                    {model.publicId ?? model.id}
                </Text>
            </View>

            {selected ? (
                <Text className="text-[15px]" style={{ color: ink }}>
                    Active
                </Text>
            ) : (
                <View className="h-2 w-2 rounded-full" style={{ backgroundColor: quietInk, opacity: 0.35 }} />
            )}
        </Pressable>
    );
}
