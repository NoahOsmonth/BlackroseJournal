import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import React from 'react';
import { ActivityIndicator, Pressable, View } from 'react-native';
import { Image } from 'expo-image';

import { useColorScheme } from '@/hooks/use-color-scheme';
import { BLACKROSE_PALETTE } from '@/constants/theme';
import { FooterActions } from '@/components/FooterActions';
import type { ChatImageAttachment } from '@/services/ai/chatImage';

interface ChatComposerBarProps {
    onGoDeeper: () => void;
    onFinishEntry?: () => void;
    disabled?: boolean;
    canGoDeeper?: boolean;
    canFinish?: boolean;
    isSaving?: boolean;
    savingLabel?: string;
    isStreaming?: boolean;
    onStop?: () => void;
    /** Photo attached to the next turn. */
    pendingImage?: ChatImageAttachment | null;
    onPickImage?: () => void;
    onRemoveImage?: () => void;
    isPickingImage?: boolean;
    /**
     * The speaker in the icon row. `enabled` paints the icon live; `label`
     * describes what a press does (read aloud / mute). Omit for no control.
     */
    voice?: { enabled: boolean; label: string; onPress: () => void; speaking?: boolean };
    /** Extra content above the verbs (the intention footer's disclaimer). */
    children?: React.ReactNode;
}

/**
 * The pinned composer, matching the reference: a row of quiet icons, a hairline,
 * then the two verbs. No microphone; a photo button and a speaker. The writing
 * itself happens inline in the transcript above, so this bar stays short and
 * always rides above the keyboard.
 */
export function ChatComposerBar({
    onGoDeeper,
    onFinishEntry,
    disabled = false,
    canGoDeeper = false,
    canFinish = false,
    isSaving = false,
    savingLabel,
    isStreaming = false,
    onStop,
    pendingImage,
    onPickImage,
    onRemoveImage,
    isPickingImage = false,
    voice,
    children,
}: ChatComposerBarProps) {
    const isDark = useColorScheme() === 'dark';
    const iconColor = isDark ? BLACKROSE_PALETTE.dark.text2 : BLACKROSE_PALETTE.light.text2;
    const activeIconColor = isDark ? BLACKROSE_PALETTE.dark.accent : BLACKROSE_PALETTE.light.accent;

    return (
        <View className="gap-3 border-t border-hairline-light bg-background-light px-5 pb-3 pt-3 dark:border-hairline-dark dark:bg-background-dark">
            <View className="flex-row items-center justify-between">
                <View className="flex-row items-center gap-3">
                    {onPickImage ? (
                        <Pressable
                            onPress={onPickImage}
                            disabled={disabled || isPickingImage}
                            accessibilityRole="button"
                            accessibilityLabel="Attach a photo"
                            hitSlop={8}
                            className={disabled || isPickingImage ? 'opacity-40' : ''}
                        >
                            {isPickingImage ? (
                                <ActivityIndicator size="small" color={iconColor} />
                            ) : (
                                <MaterialIcons name="image" size={22} color={iconColor} />
                            )}
                        </Pressable>
                    ) : null}

                    {pendingImage?.uri ? (
                        <Pressable
                            onPress={onRemoveImage}
                            accessibilityRole="button"
                            accessibilityLabel="Remove attached photo"
                            hitSlop={6}
                            className="flex-row items-center gap-1.5 rounded-control border border-hairline-light px-1.5 py-1 dark:border-hairline-dark"
                        >
                            <Image
                                source={{ uri: pendingImage.uri }}
                                className="h-6 w-6 rounded-[4px]"
                                contentFit="cover"
                                accessibilityLabel="Attached photo preview"
                            />
                            <MaterialIcons name="close" size={14} color={iconColor} accessibilityElementsHidden />
                        </Pressable>
                    ) : null}
                </View>

                {voice ? (
                    <Pressable
                        onPress={voice.onPress}
                        accessibilityRole="button"
                        accessibilityLabel={voice.label}
                        hitSlop={8}
                    >
                        {/* Always a speaker, never a slashed one: a slashed glyph
                            at rest reads as "microphone, muted". Colour carries
                            the state instead — accent while it is actually
                            reading, quiet otherwise. */}
                        <MaterialIcons
                            name="volume-up"
                            size={22}
                            color={voice.speaking ?? voice.enabled ? activeIconColor : iconColor}
                        />
                    </Pressable>
                ) : null}
            </View>

            {children}

            <FooterActions
                onGoDeeper={onGoDeeper}
                onFinishEntry={onFinishEntry}
                disabled={disabled}
                canGoDeeper={canGoDeeper}
                canFinish={canFinish}
                isSaving={isSaving}
                savingLabel={savingLabel}
                isStreaming={isStreaming}
                onStop={onStop}
            />
        </View>
    );
}
