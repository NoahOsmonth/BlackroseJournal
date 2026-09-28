import React from 'react';
import { Pressable, Text, View } from 'react-native';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { ModelHeaderControl } from '@/components/ai/ModelHeaderControl';
import { RoseMark } from '@/components/ui/RoseMark';
import { BLACKROSE_PALETTE } from '@/constants/theme';

interface IntentionChatHeaderProps {
    personaName: string;
    onOpenPersona: () => void;
    onOpenDrafts: () => void;
    onClose: () => void;
    onOpenModelPicker?: () => void;
    modelPickerDisabled?: boolean;
    /** Whether the transcript shows the companion's reasoning + tool calls. */
    showThinking?: boolean;
    /** Flips the transcript's thinking/tool layer. Omit to hide the control. */
    onToggleThinking?: () => void;
}

/**
 * Check-in header, same skeleton as the journal chat header: back chevron,
 * small rose mark, serif sitting name, one trailing verb.
 */
export function IntentionChatHeader({
    personaName,
    onOpenPersona,
    onOpenDrafts,
    onClose,
    onOpenModelPicker,
    modelPickerDisabled = false,
    showThinking = true,
    onToggleThinking,
}: IntentionChatHeaderProps) {
    const isDark = useColorScheme() === 'dark';
    const markColor = isDark ? BLACKROSE_PALETTE.dark.accent : BLACKROSE_PALETTE.light.accent;
    const closeIconColor = isDark ? BLACKROSE_PALETTE.dark.text : BLACKROSE_PALETTE.light.text;
    const thinkingOnColor = isDark ? BLACKROSE_PALETTE.dark.accent : BLACKROSE_PALETTE.light.accent;
    const thinkingOffColor = isDark ? BLACKROSE_PALETTE.dark.text2 : BLACKROSE_PALETTE.light.text2;

    return (
        <View className="border-b border-hairline-light px-4 pb-3 pt-4 dark:border-hairline-dark">
            <View className="flex-row items-center justify-between gap-3">
                <Pressable
                    onPress={onClose}
                    accessibilityRole="button"
                    accessibilityLabel="Close"
                    hitSlop={10}
                    className="h-9 w-9 items-center justify-center"
                >
                    <MaterialIcons name="chevron-left" size={26} color={closeIconColor} />
                </Pressable>

                <Pressable
                    onPress={onOpenPersona}
                    accessibilityRole="button"
                    accessibilityLabel="Choose persona"
                    className="min-w-0 flex-1 flex-row items-center justify-center gap-2"
                >
                    <View testID="intention-chat-persona-badge">
                        <RoseMark size={16} color={markColor} variant="bloom" />
                    </View>
                    <Text
                        className="text-center text-[15px] text-text-light dark:text-text-dark"
                        style={{ fontFamily: 'PlayfairDisplayRegular' }}
                        numberOfLines={1}
                    >
                        {personaName}
                    </Text>
                </Pressable>

                <Pressable
                    onPress={onOpenDrafts}
                    accessibilityRole="button"
                    accessibilityLabel="Open drafts"
                    hitSlop={8}
                >
                    <Text
                        className="text-[15px] text-text-light dark:text-text-dark"
                        style={{ fontFamily: 'PlayfairDisplayRegular' }}
                    >
                        Drafts
                    </Text>
                </Pressable>
            </View>

            {/* Model picker stays reachable without a second chrome band: it is
                the only model entry point on this surface. The thinking switch
                rides beside it — one row, two view controls. */}
            <View className="flex-row items-center justify-center gap-3">
                <ModelHeaderControl
                    onPress={onOpenModelPicker}
                    disabled={modelPickerDisabled}
                />
                {onToggleThinking ? (
                    <Pressable
                        onPress={onToggleThinking}
                        accessibilityRole="switch"
                        accessibilityState={{ checked: showThinking }}
                        accessibilityLabel={showThinking
                            ? 'Hide thinking and tool calls'
                            : 'Show thinking and tool calls'}
                        hitSlop={8}
                        className="flex-row items-center gap-1 rounded-control border border-hairline-light px-2 py-1 dark:border-hairline-dark"
                    >
                        <MaterialIcons
                            name="psychology"
                            size={14}
                            color={showThinking ? thinkingOnColor : thinkingOffColor}
                            accessibilityElementsHidden
                        />
                        <Text
                            className="text-[11px] text-text-secondary-light dark:text-text-secondary-dark"
                            style={showThinking ? { color: thinkingOnColor } : undefined}
                            numberOfLines={1}
                        >
                            {showThinking ? 'Thinking' : 'Thinking off'}
                        </Text>
                    </Pressable>
                ) : null}
            </View>
        </View>
    );
}
