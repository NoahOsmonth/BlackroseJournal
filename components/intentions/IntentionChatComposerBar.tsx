import React from 'react';
import { Text, View } from 'react-native';

import { ChatComposerBar } from '@/components/chat/ChatComposerBar';
import type { ChatImageAttachment } from '@/services/ai/chatImage';

interface IntentionChatComposerBarProps {
    readonly isMuted: boolean;
    readonly onToggleMuted: () => void;
    readonly onGoDeeper: () => void;
    readonly onFinishEntry?: () => void;
    readonly disabled?: boolean;
    readonly canGoDeeper?: boolean;
    readonly canFinish?: boolean;
    readonly isSaving?: boolean;
    readonly savingLabel?: string;
    readonly isStreaming?: boolean;
    readonly onStop?: () => void;
    readonly pendingImage?: ChatImageAttachment | null;
    readonly onPickImage?: () => void;
    readonly onRemoveImage?: () => void;
    readonly isPickingImage?: boolean;
}

/**
 * The pinned block below a check-in transcript, same order as the journal chat
 * (AGENTS rule 5): photo + voice icons, a hairline, then the two verbs. The
 * writing slip itself lives inline in the transcript above, so this bar stays
 * short and rides above the keyboard.
 */
export function IntentionChatComposerBar({
    isMuted,
    onToggleMuted,
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
}: IntentionChatComposerBarProps) {
    return (
        <ChatComposerBar
            onGoDeeper={onGoDeeper}
            onFinishEntry={onFinishEntry}
            disabled={disabled}
            canGoDeeper={canGoDeeper}
            canFinish={canFinish}
            isSaving={isSaving}
            savingLabel={savingLabel}
            isStreaming={isStreaming}
            onStop={onStop}
            pendingImage={pendingImage}
            onPickImage={onPickImage}
            onRemoveImage={onRemoveImage}
            isPickingImage={isPickingImage}
            voice={{
                enabled: !isMuted,
                label: isMuted ? 'Read replies aloud' : 'Stop reading replies aloud',
                onPress: onToggleMuted,
            }}
        >
            {/* This surface has no concept of its own, so the honesty line
                stays where it has always sat: beside the voice control. */}
            <View className="flex-row items-center justify-between">
                <Text className="text-xs text-text-secondary-light dark:text-text-secondary-dark">
                    Blackrose can make mistakes.
                </Text>
            </View>
        </ChatComposerBar>
    );
}
