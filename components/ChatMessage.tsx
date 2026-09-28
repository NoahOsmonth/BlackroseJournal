import { TypingIndicator } from '@/components/ui/TypingIndicator';
import { getMarkdownStyles } from '@/constants/markdownStyles';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useThemeSettings } from '@/hooks/useThemeSettings';
import React, { useEffect, useState } from 'react';
import { Text, TextStyle, View } from 'react-native';
import Markdown from 'react-native-marked';
import { Image } from 'expo-image';
import Animated, {
  FadeInDown,
  Layout
} from 'react-native-reanimated';
import { AgentToolActivity } from '@/components/ai/AgentToolActivity';
import type { AgentToolCallSnapshot } from '@/services/ai/agentEvents';
import type { ChatImageAttachment } from '@/services/ai/chatImage';
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
  /** Photo the writer attached to this turn. */
  image?: ChatImageAttachment;
  /**
   * The "Show thinking" switch. False hides the whole work layer — reasoning,
   * tool calls, status lines and the summary line — leaving only the words.
   */
  showThinking?: boolean;
}

function hasMarkdownSyntax(value: string): boolean {
  const markdownPattern =
    /(^|\n)\s{0,3}(#{1,6}\s|[-*+]\s|\d+\.\s|>\s)|(\*\*|__|`|\[[^\]]+\]\([^)]+\))/m;

  return markdownPattern.test(value);
}

/**
 * One chat turn, inline (the reference transcript, not a messenger):
 * - you: your own line in the flow — no bubble, no right-aligned slip;
 * - companion: a bone left rule with the complete paragraph beside it —
 *   never a letter-by-letter typewriter.
 * The companion's work (reasoning + tools) folds into one quiet line above its
 * words and disappears entirely when the reader turns thinking off.
 */
export function ChatMessage({
  text,
  isAi = false,
  isStreaming = false,
  reasoning,
  isReadOnly = false,
  toolActivity,
  statusLines,
  image,
  showThinking = true,
}: ChatMessageProps) {
  const [displayedText, setDisplayedText] = useState('');
  const colorScheme = useColorScheme();
  const { colorTheme } = useThemeSettings();
  const isDark = colorScheme === 'dark';
  const colors = colorTheme.colors;
  const aiTextColor = isDark ? colors.chatAiTextDark : colors.chatAiTextLight;
  const userTextColor = isDark ? colors.chatUserTextDark : colors.chatUserTextLight;
  const accentColor = isDark ? colors.accentDark : colors.accentLight;

  useEffect(() => {
    setDisplayedText(text);
  }, [text]);

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
    : 'text-[15px] leading-[24px] text-user-text dark:text-user-text-dark';
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

  // Work layer: only ever painted for the companion, and only when the reader
  // has thinking switched on.
  const workLayer = isAi && showThinking && (
    !!toolActivity?.length || !!statusLines?.length || !!reasoning?.trim()
  ) ? (
    <View className="mb-2">
      <AgentToolActivity
        toolActivity={toolActivity ?? []}
        statusLines={statusLines}
        reasoning={reasoning}
        isStreaming={isStreaming}
      />
    </View>
  ) : null;

  const photo = image?.uri ? (
    <Image
      source={{ uri: image.uri }}
      className="mb-2 h-40 w-40 rounded-control"
      contentFit="cover"
      accessibilityLabel="Attached photo"
    />
  ) : null;

  const body = (
    <>
      {photo}
      {workLayer}

      {/* AI messages use markdown rendering once complete; streaming text stays plain for web safety. */}
      {isAi && isStreaming && displayedText.length === 0 ? (
        <View>
          {/* Tool/status stack already shows a Thinking footer — don't stack a second TypingIndicator. */}
          {showThinking && (toolActivity?.length || statusLines?.length) ? null : (
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
    </>
  );

  return (
    <Animated.View
      entering={FadeInDown.duration(250).springify()}
      layout={Layout.springify()}
      className={`w-full ${isReadOnly ? 'opacity-80' : ''}`}
    >
      {isAi ? (
        <View className="flex-row">
          <View className="mr-4 w-px self-stretch bg-bone-light dark:bg-bone-dark" />
          <View className="min-w-0 flex-1">{body}</View>
        </View>
      ) : (
        <View className="w-full">{body}</View>
      )}
    </Animated.View>
  );
}
