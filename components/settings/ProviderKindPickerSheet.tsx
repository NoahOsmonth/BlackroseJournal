import Ionicons from '@expo/vector-icons/Ionicons';
import React from 'react';
import { Modal, Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BLACKROSE_PALETTE } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import {
    PROVIDER_KIND_OPTIONS,
    type ProviderKind,
    type ProviderKindOption,
} from '@/services/ai/customModels';

type IoniconName = React.ComponentProps<typeof Ionicons>['name'];

const SERIF = { fontFamily: 'PlayfairDisplayRegular' };

const KIND_ICONS: Record<ProviderKind, IoniconName> = {
    openai: 'git-network-outline',
    google: 'sparkles-outline',
    anthropic: 'book-outline',
};

function OptionRow({
    option,
    onPress,
}: {
    readonly option: ProviderKindOption;
    readonly onPress: () => void;
}) {
    const isDark = useColorScheme() === 'dark';
    const ink = isDark ? BLACKROSE_PALETTE.dark.text : BLACKROSE_PALETTE.light.text;

    return (
        <Pressable
            onPress={onPress}
            accessibilityRole="button"
            accessibilityLabel={`Add ${option.label} as the AI service`}
            testID={`provider-kind-${option.kind}`}
            className="min-h-16 flex-row items-center gap-3 rounded-control border border-hairline-light bg-surface-light px-4 py-3.5 active:opacity-80 dark:border-hairline-dark dark:bg-surface-dark"
        >
            <Ionicons name={KIND_ICONS[option.kind]} size={20} color={ink} />
            <View className="min-w-0 flex-1 gap-0.5">
                <Text
                    numberOfLines={1}
                    className="text-[19px] leading-[26px] text-text-light dark:text-text-dark"
                    style={SERIF}
                >
                    {option.label}
                </Text>
                <Text
                    numberOfLines={2}
                    className="text-[13px] leading-[18px] text-text-secondary-light dark:text-text-secondary-dark"
                >
                    {option.description}
                </Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={ink} style={{ opacity: 0.5 }} />
        </Pressable>
    );
}

export type ProviderKindPickerSheetProps = {
    readonly visible: boolean;
    readonly onSelect: (kind: ProviderKind) => void;
    readonly onClose: () => void;
};

/**
 * "Add service" asks which service first.
 *
 * The alternative — appending a blank entry and letting the user discover the
 * address from a vendor console — is what this sheet replaces. Picking one
 * creates the entry with that service's address and name prefilled, all still
 * editable in the form behind it.
 */
export function ProviderKindPickerSheet({
    visible,
    onSelect,
    onClose,
}: ProviderKindPickerSheetProps) {
    const insets = useSafeAreaInsets();

    return (
        <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
            <View className="flex-1 items-center justify-end bg-black/60 dark:bg-black/80">
                <Pressable
                    className="flex-1 self-stretch"
                    onPress={onClose}
                    accessibilityLabel="Dismiss the AI service picker"
                />
                {/* Capped and centred like the rest of the sheet chrome: on a
                    desktop viewport a full-bleed sheet turns three rows into a
                    1440px-wide band and the descriptions read as empty space. */}
                <View className="w-full max-w-xl rounded-t-sheet border-t border-hairline-light bg-surface-light dark:border-hairline-dark dark:bg-surface-dark">
                    <View className="px-4 pt-4">
                        <View className="items-center">
                            <View className="h-1 w-10 rounded-full bg-hairline-light dark:bg-hairline-dark" />
                        </View>
                        <Text
                            className="mt-3 text-center text-[24px] leading-[32px] text-text-light dark:text-text-dark"
                            style={SERIF}
                        >
                            Add service
                        </Text>
                        <Text className="mt-1 text-center text-[13px] text-text-secondary-light dark:text-text-secondary-dark">
                            Pick where your AI comes from. You can edit every field next.
                        </Text>
                    </View>

                    <View className="gap-3 px-4 pt-4 pb-4">
                        {PROVIDER_KIND_OPTIONS.map((option) => (
                            <OptionRow
                                key={option.kind}
                                option={option}
                                onPress={() => onSelect(option.kind)}
                            />
                        ))}
                    </View>

                    <Pressable
                        onPress={onClose}
                        className="min-h-12 items-center justify-center border-t border-hairline-light dark:border-hairline-dark"
                        style={{ paddingBottom: Math.max(insets.bottom, 12) }}
                        accessibilityLabel="Cancel adding a service"
                    >
                        <Text className="text-[16px] text-text-light dark:text-text-dark">
                            Cancel
                        </Text>
                    </Pressable>
                </View>
            </View>
        </Modal>
    );
}
