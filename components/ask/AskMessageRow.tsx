/**
 * One Ask turn.
 *
 * You: a right-aligned surface slip, sans, no bubble tail.
 * The companion: a bordered reply set in serif beside a hairline rail carrying
 * the Blackrose diamond ornament — the concept's correspondence mark.
 *
 * Presentation only: answers still come from `services/ask-rosebud`.
 */

import React from 'react';
import { Text, View } from 'react-native';

import { TypingIndicator } from '@/components/ui/TypingIndicator';
import type { AskRosebudMessage } from '@/hooks/useAskRosebud';

const SERIF = { fontFamily: 'PlayfairDisplayRegular' };

/** Hairline column with the concept's diamond bead at its midpoint. */
function CompanionRail() {
    return (
        <View className="w-3 items-center self-stretch">
            <View className="h-1.5 w-1.5 rounded-full bg-bone-light dark:bg-bone-dark" />
            <View className="w-px flex-1 bg-hairline-light dark:bg-hairline-dark" />
            <View className="h-[7px] w-[7px] rotate-45 border border-bone-light dark:border-bone-dark" />
            <View className="w-px flex-1 bg-hairline-light dark:bg-hairline-dark" />
            <View className="h-1.5 w-1.5 rounded-full bg-bone-light dark:bg-bone-dark" />
        </View>
    );
}

interface AskMessageRowProps {
    readonly message: AskRosebudMessage;
}

export function AskMessageRow({ message }: AskMessageRowProps) {
    if (message.role === 'user') {
        return (
            <View className="items-end">
                <View className="max-w-[88%] rounded-card bg-surface-2-light px-4 py-3 dark:bg-surface-2-dark">
                    <Text className="text-[15px] leading-[22px] text-text-light dark:text-text-dark">
                        {message.content}
                    </Text>
                </View>
            </View>
        );
    }

    return (
        <View className="flex-row items-stretch gap-3">
            <CompanionRail />
            <View className="min-w-0 flex-1 rounded-card border border-hairline-light px-4 py-3.5 dark:border-hairline-dark">
                <Text
                    className="text-[17px] leading-[28px] text-text-light dark:text-text-dark"
                    style={SERIF}
                >
                    {message.content}
                </Text>
            </View>
        </View>
    );
}

/** Three bone dots on the companion column while an answer is being assembled. */
export function AskTypingRow() {
    return (
        <View className="flex-row items-center gap-3">
            <View className="w-3" />
            <TypingIndicator />
        </View>
    );
}
