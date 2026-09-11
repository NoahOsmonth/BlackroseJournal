/**
 * Cursor/Pi-style live tool activity timeline for chat.
 * Shared by journal freeform chat and intention chat (one surface, rule 5).
 */

import React, { useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';

import { useColorScheme } from '@/hooks/use-color-scheme';
import { ToolStatusColors } from '@/constants/theme';
import type { AgentToolCallSnapshot } from '@/services/ai/agentEvents';
import type { AgentStatusLine } from '@/features/chat/types';
import { TypingIndicator } from '@/components/ui/TypingIndicator';

interface AgentToolActivityProps {
    toolActivity: AgentToolCallSnapshot[];
    /**
     * The model's working status lines between tool batches ("Let me go dig
     * rather than guess. One sec."). Live-only: dropped once the reply commits.
     */
    statusLines?: AgentStatusLine[];
    /**
     * When true (finished transcript / prose well underway), collapse to a
     * compact expandable chip so the reply stays primary. Live tool work
     * should pass false so cards stay visible while the agent runs.
     */
    compact?: boolean;
}

/** Newest status line only — a turn's earlier line is superseded, not stacked. */
function latestStatusLine(statusLines?: AgentStatusLine[]): AgentStatusLine | null {
    if (!statusLines?.length) return null;
    return statusLines.reduce((latest, line) => (line.round >= latest.round ? line : latest));
}

function statusIconColor(
    status: AgentToolCallSnapshot['status'],
    isDark: boolean
): string {
    switch (status) {
        case 'ok':
            return isDark ? ToolStatusColors.okDark : ToolStatusColors.okLight;
        case 'error':
            return isDark ? ToolStatusColors.errorDark : ToolStatusColors.errorLight;
        case 'refused':
            return isDark ? ToolStatusColors.warnDark : ToolStatusColors.warnLight;
        default:
            return isDark ? ToolStatusColors.idleDark : ToolStatusColors.idleLight;
    }
}

function statusIconName(
    status: AgentToolCallSnapshot['status']
): keyof typeof MaterialIcons.glyphMap {
    switch (status) {
        case 'ok':
            return 'check-circle';
        case 'error':
            return 'error-outline';
        case 'refused':
            return 'block';
        default:
            return 'radio-button-unchecked';
    }
}

function ToolRow({ call }: { call: AgentToolCallSnapshot }) {
    const [expanded, setExpanded] = useState(false);
    const isDark = useColorScheme() === 'dark';
    const iconColor = statusIconColor(call.status, isDark);
    const isRunning = call.status === 'running';
    const showExpand = call.status !== 'running' && (call.argsPreview || call.resultPreview);

    return (
        <View
            accessibilityLabel={`Tool ${call.label}: ${call.status}`}
            className="gap-1 rounded-control border border-hairline-light px-3 py-2 dark:border-hairline-dark"
        >
            <Pressable
                disabled={!showExpand}
                onPress={() => setExpanded((prev) => !prev)}
                accessibilityRole={showExpand ? 'button' : undefined}
                accessibilityLabel={showExpand ? `Expand ${call.label}` : call.label}
                className="flex-row items-center gap-2"
            >
                {isRunning ? (
                    <ActivityIndicator size="small" color={iconColor} />
                ) : (
                    <MaterialIcons
                        name={statusIconName(call.status)}
                        size={14}
                        color={iconColor}
                        accessibilityElementsHidden
                    />
                )}
                <Text className="min-w-0 flex-1 text-[13px] text-text-light dark:text-text-dark" numberOfLines={1}>
                    {call.label}
                </Text>
                {typeof call.durationMs === 'number' && call.status !== 'running' && (
                    <Text className="text-[11px] text-text-secondary-light dark:text-text-secondary-dark">
                        {call.durationMs}ms
                    </Text>
                )}
                {showExpand && (
                    <MaterialIcons
                        name={expanded ? 'expand-less' : 'expand-more'}
                        size={16}
                        color={isDark ? ToolStatusColors.idleDark : ToolStatusColors.idleLight}
                        accessibilityElementsHidden
                    />
                )}
            </Pressable>
            {/* The query the tool ran stays on its own quiet line so the label
                never truncates to an ellipsis in the narrow companion column. */}
            {!!call.argsPreview && call.argsPreview !== '—' && (
                <Text
                    className="text-[11px] text-text-secondary-light dark:text-text-secondary-dark"
                    numberOfLines={1}
                >
                    {call.argsPreview}
                </Text>
            )}
            {expanded && (
                <View className="mt-1 gap-1 border-t border-hairline-light pt-2 dark:border-hairline-dark">
                    {!!call.argsPreview && call.argsPreview !== '—' && (
                        <Text className="text-[12px] text-text-secondary-light dark:text-text-secondary-dark">
                            Args: {call.argsPreview}
                        </Text>
                    )}
                    {!!call.resultPreview && (
                        <Text className="text-[12px] text-text-light dark:text-text-dark" numberOfLines={4}>
                            {call.resultPreview}
                        </Text>
                    )}
                </View>
            )}
        </View>
    );
}

function CompactChip({
    toolActivity,
    onPress,
}: {
    toolActivity: AgentToolCallSnapshot[];
    onPress: () => void;
}) {
    const count = toolActivity.length;
    const noun = count === 1 ? 'tool' : 'tools';
    return (
        <Pressable
            onPress={onPress}
            accessibilityRole="button"
            accessibilityLabel={`Used ${count} ${noun}. Show details.`}
            className="self-start rounded-control border border-hairline-light px-3 py-1 dark:border-hairline-dark"
        >
            <Text className="text-[11px] text-text-secondary-light dark:text-text-secondary-dark">
                Used {count} {noun} · details
            </Text>
        </Pressable>
    );
}

function StatusLine({ line }: { line: AgentStatusLine }) {
    return (
        <Text
            accessibilityLabel={`Working: ${line.text}`}
            className="text-[13px] italic leading-5 text-text-secondary-light dark:text-text-secondary-dark"
        >
            {line.text}
        </Text>
    );
}

export function AgentToolActivity({
    toolActivity,
    statusLines,
    compact = false,
}: AgentToolActivityProps) {
    const [showDetails, setShowDetails] = useState(false);

    const live = latestStatusLine(statusLines);
    // Status lines are working UI: never on the committed compact chip.
    if (compact && !live && (!toolActivity || toolActivity.length === 0)) return null;
    if (!compact && (!toolActivity || toolActivity.length === 0) && !live) return null;

    const anyRunning = toolActivity.some((call) => call.status === 'running');

    if (compact && !showDetails) {
        // Only status lines and no tools: nothing to collapse into a chip.
        if (toolActivity.length === 0) return null;
        return <CompactChip toolActivity={toolActivity} onPress={() => setShowDetails(true)} />;
    }

    return (
        <View accessibilityLabel="Tool activity" className="gap-2">
            {compact && (
                <Pressable
                    onPress={() => setShowDetails(false)}
                    accessibilityRole="button"
                    accessibilityLabel="Hide tool details"
                    className="self-start"
                >
                    <Text className="text-[11px] text-text-secondary-light dark:text-text-secondary-dark">
                        Hide tool details
                    </Text>
                </Pressable>
            )}
            {/* Pi order: the assistant's words for the turn, then its tools. */}
            {live && <StatusLine line={live} />}
            {toolActivity.map((call) => (
                <ToolRow key={call.toolCallId} call={call} />
            ))}
            {anyRunning && (
                <View className="flex-row items-center gap-2 pl-1">
                    <TypingIndicator label="Thinking" sizeClassName="text-xs" />
                </View>
            )}
        </View>
    );
}
