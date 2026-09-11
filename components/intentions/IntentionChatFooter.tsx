import React from 'react';
import { Pressable, Text, View } from 'react-native';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { BLACKROSE_PALETTE } from '@/constants/theme';
import { FooterActions } from '@/components/FooterActions';

interface IntentionChatFooterProps {
    isMuted: boolean;
    onToggleMuted: () => void;
    onGoDeeper: () => void;
    onFinishEntry: () => void;
    disabled?: boolean;
    canGoDeeper?: boolean;
    canFinish?: boolean;
    isSaving?: boolean;
    savingLabel?: string;
}

export function IntentionChatFooter({
    isMuted,
    onToggleMuted,
    onGoDeeper,
    onFinishEntry,
    disabled = false,
    canGoDeeper = false,
    canFinish = false,
    isSaving = false,
    savingLabel,
}: IntentionChatFooterProps) {
    const isDark = useColorScheme() === 'dark';
    const mutedIconColor = isDark ? BLACKROSE_PALETTE.dark.text2 : BLACKROSE_PALETTE.light.text2;
    const activeIconColor = isDark ? BLACKROSE_PALETTE.dark.accent : BLACKROSE_PALETTE.light.accent;

    return (
        <View className="bg-background-light dark:bg-background-dark">
            <View className="flex-row items-center justify-between px-5 pb-3">
                <Text className="text-xs text-text-secondary-light dark:text-text-secondary-dark">
                    Blackrose can make mistakes.
                </Text>
                <Pressable accessibilityLabel="Toggle volume" onPress={onToggleMuted} hitSlop={8}>
                    <MaterialIcons
                        name={isMuted ? 'volume-off' : 'volume-up'}
                        size={22}
                        color={isMuted ? mutedIconColor : activeIconColor}
                    />
                </Pressable>
            </View>
            <FooterActions
                onGoDeeper={onGoDeeper}
                onFinishEntry={onFinishEntry}
                disabled={disabled}
                canGoDeeper={canGoDeeper}
                canFinish={canFinish}
                isSaving={isSaving}
                savingLabel={savingLabel}
            />
        </View>
    );
}
