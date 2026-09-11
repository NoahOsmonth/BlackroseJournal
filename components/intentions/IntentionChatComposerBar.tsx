import React from 'react';
import { View } from 'react-native';

import { InlineTypingInput, InlineTypingInputRef } from '@/components/InlineTypingInput';
import { IntentionChatFooter } from './IntentionChatFooter';

interface IntentionChatComposerBarProps {
    readonly inputRef: React.Ref<InlineTypingInputRef>;
    readonly isMuted: boolean;
    readonly onToggleMuted: () => void;
    readonly onSubmitInput: (text: string) => void;
    readonly onInputTextChange: (text: string) => void;
    readonly onGoDeeper: () => void;
    readonly onFinishEntry: () => void;
    readonly disabled?: boolean;
    readonly canGoDeeper?: boolean;
    readonly canFinish?: boolean;
    readonly isSaving?: boolean;
    readonly savingLabel?: string;
}

/**
 * The pinned block below a check-in transcript: outline verbs, then the shared
 * writing slip — same order as the journal chat so both surfaces read as one
 * product (AGENTS rule 5).
 */
export function IntentionChatComposerBar({
    inputRef,
    isMuted,
    onToggleMuted,
    onSubmitInput,
    onInputTextChange,
    onGoDeeper,
    onFinishEntry,
    disabled = false,
    canGoDeeper = false,
    canFinish = false,
    isSaving = false,
    savingLabel,
}: IntentionChatComposerBarProps) {
    return (
        <View className="gap-3 border-t border-hairline-light px-5 pt-3 dark:border-hairline-dark">
            <IntentionChatFooter
                isMuted={isMuted}
                onToggleMuted={onToggleMuted}
                onGoDeeper={onGoDeeper}
                onFinishEntry={onFinishEntry}
                disabled={disabled}
                canGoDeeper={canGoDeeper}
                canFinish={canFinish}
                isSaving={isSaving}
                savingLabel={savingLabel}
            />
            <InlineTypingInput
                ref={inputRef}
                onSubmit={onSubmitInput}
                onTextChange={onInputTextChange}
                disabled={disabled}
                placeholder="Write what's true…"
            />
        </View>
    );
}
