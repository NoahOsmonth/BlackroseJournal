import { TypingIndicator } from '@/components/ui/TypingIndicator';
import { getMarkdownStyles } from '@/constants/markdownStyles';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useThemeSettings } from '@/hooks/useThemeSettings';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import React, { useEffect, useState } from 'react';
import { Pressable, Text, TextStyle, View } from 'react-native';
import Markdown from 'react-native-marked';
import Animated, {
  FadeIn,
  FadeInDown,
  FadeOut,
  Layout
} from 'react-native-reanimated';
import { AgentToolActivity } from '@/components/ai/AgentToolActivity';
import type { AgentToolCallSnapshot } from '@/services/ai/agentEvents';
import type { AgentStatusLine } from '@/features/chat/types';

interface ChatMessageProps {
  text: string;
  isAi?: boolean;
  isStreaming?: boolean;
  reasoning?: string;
  isReadOnly?: boolean;
  /** Live or finished tool timeline for this assistant turn. */
  toolActivity?: AgentToolCallSnapshot[];
  /** Working status lines between tool batches (live turns only). */
  statusLines?: AgentStatusLine[];
}

function hasMarkdownSyntax(value: string): boolean {
  const markdownPattern =
    /(^|\n)\s{0,3}(#{1,6}\s|[-*+]\s|\d+\.\s|>\s)|(\*\*|__|`|\[[^\]]+\]\([^)]+\))/m;

  return markdownPattern.test(value);
}

/**
 * One chat turn, Blackrose presentation:
 * - you: right-aligned surface-2 slip, no bubble tail;
 * - companion: a bone left rule with the complete paragraph beside it —
 *   never a letter-by-letter typewriter.
 * The engine, prompts and message payloads are untouched; this is paint only.
 */
export function ChatMessage({
  text,
  isAi = false,
  isStreaming = false,
  reasoning,
  isReadOnly = false,
  toolActivity,
  statusLines,
}: ChatMessageProps) {
  const [displayedText, setDisplayedText] = useState('');
  const [showReasoning, setShowReasoning] = useState(false);
  const colorScheme = useColorScheme();
  const { colorTheme } = useThemeSettings();
  const isDark = colorScheme === 'dark';
  const colors = colorTheme.colors;
  const aiTextColor = isDark ? colors.chatAiTextDark : colors.chatAiTextLight;
  const userTextColor = isDark ? colors.chatUserTextDark : colors.chatUserTextLight;
  const accentColor = isDark ? colors.accentDark : colors.accentLight;
  const secondaryTextColor = isDark ? colors.secondaryTextDark : colors.secondaryTextLight;

  useEffect(() => {
    setDisplayedText(text);
  }, [text]);

  const toggleReasoning = () => {
    if (reasoning && isAi) {
      setShowReasoning(!showReasoning);
    }
  };

  const inlineStreamingReasoning = Boolean(
    isAi && isStreaming && displayedText.length === 0 && reasoning && reasoning.trim().length > 0
  );
  const hasReasoning = Boolean(
    isAi && reasoning && reasoning.trim().length > 0 && !inlineStreamingReasoning
  );
  const canToggleReasoning = hasReasoning;
  const markdownStyles = getMarkdownStyles(isDark, {
    fontWeight: '400',
    color: aiTextColor,
    headingColor: aiTextColor,
    linkColor: accentColor,
  });
  const markdownListProps = {
    scrollEnabled: false,
    style: { backgroundColor: 'transparent' },
  };

  const messageTextClassName = isAi
    ? 'text-[15px] leading-[24px] text-text-light dark:text-text-dark'
    : 'text-[15px] leading-[22px] text-user-text dark:text-user-text-dark';
  const messageTextStyle: TextStyle = {
    color: isAi ? aiTextColor : userTextColor,
  };

  const renderFormattedText = (
    value: string,
    className: string,
    styles: ReturnType<typeof getMarkdownStyles>
  ) => (
    hasMarkdownSyntax(value) ? (
      <Markdown
        value={value}
        styles={styles}
        flatListProps={markdownListProps}
      />
    ) : (
      <Text className={className} style={messageTextStyle}>
        {value}
      </Text>
    )
  );

  const body = (
    <>
      {isAi && (!!toolActivity?.length || !!statusLines?.length) && (
        <View className="mb-3">
          <AgentToolActivity
            toolActivity={toolActivity ?? []}
            statusLines={statusLines}
            compact={!isStreaming}
          />
        </View>
      )}

      {/* AI messages use markdown rendering once complete; streaming text stays plain for web safety. */}
      {isAi && isStreaming && displayedText.length === 0 ? (
        <View>
          {/* Tool/status stack already shows a Thinking footer — don't stack a second TypingIndicator. */}
          {toolActivity?.length || statusLines?.length ? null : inlineStreamingReasoning ? (
            <View>
              <Text className="mb-1 text-[11px] uppercase tracking-[1.5px] text-text-secondary-light dark:text-text-secondary-dark">
                Companion reasoning (live)
              </Text>
              <Text
                className="text-[14px] leading-[22px] italic text-text-secondary-light dark:text-text-secondary-dark"
                style={{ color: secondaryTextColor }}
              >
                {reasoning}
              </Text>
            </View>
          ) : (
            <TypingIndicator label="Thinking" />
          )}
        </View>
      ) : isAi && isStreaming ? (
        <Text className={messageTextClassName} style={messageTextStyle}>
          {displayedText}
        </Text>
      ) : isAi ? (
        renderFormattedText(displayedText, messageTextClassName, markdownStyles)
      ) : (
        <Text
          className={messageTextClassName}
          style={messageTextStyle}
        >
          {displayedText}
        </Text>
      )}

      {/* Reasoning indicator */}
      {hasReasoning && (
        <View className="mt-3 flex-row items-center gap-1.5 border-t border-hairline-light pt-3 dark:border-hairline-dark">
          <MaterialIcons
            name={showReasoning ? 'expand-less' : 'psychology'}
            size={16}
            color={secondaryTextColor}
          />
          <Text
            className="text-xs text-text-secondary-light dark:text-text-secondary-dark"
            style={{ color: secondaryTextColor }}
          >
            {showReasoning ? 'Hide reasoning' : 'View reasoning'}
            {isStreaming && ' (thinking…)'}
          </Text>
        </View>
      )}
    </>
  );

  return (
    <Animated.View
      entering={FadeInDown.duration(250).springify()}
      layout={Layout.springify()}
      className={`w-full ${isReadOnly ? 'opacity-80' : ''}`}
    >
      <Pressable
        onPress={toggleReasoning}
        disabled={!canToggleReasoning}
        className={[
          isAi ? 'w-full' : 'w-full items-end',
          canToggleReasoning ? 'py-1' : '',
        ].join(' ')}
      >
        {isAi ? (
          <View className="flex-row">
            <View className="mr-4 w-px self-stretch bg-bone-light dark:bg-bone-dark" />
            <View className="min-w-0 flex-1">{body}</View>
          </View>
        ) : (
          <View className="max-w-[88%] rounded-card bg-surface-2-light px-4 py-3 dark:bg-surface-2-dark">
            {body}
          </View>
        )}
      </Pressable>

      {/* Reasoning content */}
      {showReasoning && hasReasoning && (
        <Animated.View
          entering={FadeIn.duration(300)}
          exiting={FadeOut.duration(200)}
          className="mt-2"
        >
          <View className="gap-2 rounded-card border border-hairline-light bg-surface-light p-4 dark:border-hairline-dark dark:bg-surface-dark">
            <Text className="text-[11px] uppercase tracking-[1.5px] text-text-secondary-light dark:text-text-secondary-dark">
              Companion reasoning
            </Text>
            <Text
              className="text-[14px] leading-[22px] italic text-text-secondary-light dark:text-text-secondary-dark"
              style={{ color: secondaryTextColor }}
            >
              {reasoning}
            </Text>
          </View>
        </Animated.View>
      )}
    </Animated.View>
  );
}
