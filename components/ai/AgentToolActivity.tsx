/**
 * The companion's *work* for one turn — its reasoning and the tools it ran.
 *
 * Inline presentation (matches the reference transcript): one quiet summary
 * line in the flow, expandable into a hairline rail. Nothing here is a card:
 * the transcript stays prose, and the work reads as a margin note beside it.
 *
 * Visibility is the caller's decision. When the reader turns "Show thinking"
 * off, ChatMessage renders none of this — no summary line, no tool rows, no
 * reasoning — so the switch hides the whole layer, not just its detail.
 *
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
    /** The companion's reasoning for this turn, when the provider sent any. */
    reasoning?: string;
    /** Live turn: the rail opens itself so the work is watchable as it happens. */
    isStreaming?: boolean;
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

function formatDuration(ms: number): string {
    if (ms < 1000) return `${Math.round(ms)}ms`;
    return `${(ms / 1000).toFixed(1)}s`;
}

/** "Thought it through · Used 2 tools · 1.4s" — only facts we actually have. */
function summarizeWork(tools: AgentToolCallSnapshot[], hasReasoning: boolean): string {
    const parts: string[] = [];
    if (hasReasoning) parts.push('Thought it through');
    if (tools.length > 0) {
        parts.push(`Used ${tools.length} ${tools.length === 1 ? 'tool' : 'tools'}`);
    }
    const totalMs = tools.reduce((sum, call) => sum + (call.durationMs ?? 0), 0);
    if (totalMs > 0) parts.push(formatDuration(totalMs));
    return parts.join(' · ');
}

function ToolRow({ call }: { call: AgentToolCallSnapshot }) {
    const [expanded, setExpanded] = useState(false);
    const isDark = useColorScheme() === 'dark';
    const iconColor = statusIconColor(call.status, isDark);
    const isRunning = call.status === 'running';
    const showExpand = call.status !== 'running' && Boolean(call.argsPreview || call.resultPreview);

    return (
        <View accessibilityLabel={`Tool ${call.label}: ${call.status}`}>
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
                        size={13}
                        color={iconColor}
                        accessibilityElementsHidden
                    />
                )}
                <Text
                    className="min-w-0 flex-1 text-[12px] text-text-secondary-light dark:text-text-secondary-dark"
                    numberOfLines={1}
                >
                    {call.label}
                </Text>
                {typeof call.durationMs === 'number' && call.status !== 'running' && (
                    <Text className="text-[11px] text-text-secondary-light dark:text-text-secondary-dark">
                        {formatDuration(call.durationMs)}
                    </Text>
                )}
                {showExpand && (
                    <MaterialIcons
                        name={expanded ? 'expand-less' : 'expand-more'}
                        size={14}
                        color={isDark ? ToolStatusColors.idleDark : ToolStatusColors.idleLight}
                        accessibilityElementsHidden
                    />
                )}
            </Pressable>
            {/* The query the tool ran stays on its own quiet line so the label
                never truncates to an ellipsis in the narrow companion column. */}
            {!!call.argsPreview && call.argsPreview !== '—' && (
                <Text
                    className="pl-[21px] text-[11px] text-text-secondary-light dark:text-text-secondary-dark"
                    numberOfLines={1}
                >
                    {call.argsPreview}
                </Text>
            )}
            {expanded && (
                <View className="mt-1 gap-1 pl-[21px]">
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

export function AgentToolActivity({
    toolActivity,
    statusLines,
    reasoning,
    isStreaming = false,
}: AgentToolActivityProps) {
    // null = follow the turn's state; a boolean = the reader chose.
    const [expandedOverride, setExpandedOverride] = useState<boolean | null>(null);
    const isDark = useColorScheme() === 'dark';
    const secondaryColor = isDark ? ToolStatusColors.idleDark : ToolStatusColors.idleLight;

    const live = latestStatusLine(statusLines);
    const tools = toolActivity ?? [];
    const hasReasoning = Boolean(reasoning && reasoning.trim().length > 0);
    const anyRunning = tools.some((call) => call.status === 'running');
    const isWorking = isStreaming && (anyRunning || Boolean(live));
    const expanded = expandedOverride ?? (anyRunning || isStreaming);

    if (!isWorking && tools.length === 0 && !hasReasoning) return null;

    const summary = isWorking ? 'Working…' : summarizeWork(tools, hasReasoning);

    return (
        <View accessibilityLabel="Tool activity" className="gap-1">
            <Pressable
                onPress={() => setExpandedOverride(!expanded)}
                accessibilityRole="button"
                accessibilityLabel={expanded ? 'Hide thinking and tools' : 'Show thinking and tools'}
                accessibilityState={{ expanded }}
                hitSlop={6}
                className="flex-row items-center gap-1.5 self-start py-0.5"
            >
                {isWorking ? (
                    <ActivityIndicator size="small" color={secondaryColor} />
                ) : (
                    <MaterialIcons name="psychology" size={13} color={secondaryColor} accessibilityElementsHidden />
                )}
                <Text className="text-[12px] text-text-secondary-light dark:text-text-secondary-dark">
                    {summary}
                </Text>
                <MaterialIcons
                    name={expanded ? 'expand-less' : 'expand-more'}
                    size={14}
                    color={secondaryColor}
                    accessibilityElementsHidden
                />
            </Pressable>

            {expanded && (
                <View className="gap-2 pl-3">
                    {live && (
                        <Text
                            accessibilityLabel={`Working: ${live.text}`}
                            className="text-[12px] italic leading-5 text-text-secondary-light dark:text-text-secondary-dark"
                        >
                            {live.text}
                        </Text>
                    )}
                    {hasReasoning && (
                        <Text
                            accessibilityLabel="Companion reasoning"
                            className="text-[13px] italic leading-5 text-bone-light dark:text-bone-dark"
                        >
                            {reasoning}
                        </Text>
                    )}
                    {tools.map((call) => (
                        <ToolRow key={call.toolCallId} call={call} />
                    ))}
                    {anyRunning && <TypingIndicator label="Thinking" sizeClassName="text-xs" />}
                </View>
            )}
        </View>
    );
}
