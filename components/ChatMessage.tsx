import { TypingIndicator } from '@/components/ui/TypingIndicator';
import { getMarkdownStyles } from '@/constants/markdownStyles';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { MaterialIcons } from '@expo/vector-icons';
import React, { useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import Markdown from 'react-native-marked';
import Animated, {
  FadeIn,
  FadeInDown,
  FadeOut,
  Layout
} from 'react-native-reanimated';

interface ChatMessageProps {
  text: string;
  isAi?: boolean;
  isStreaming?: boolean;
  reasoning?: string;
  isReadOnly?: boolean;
}

export function ChatMessage({
  text,
  isAi = false,
  isStreaming = false,
  reasoning,
  isReadOnly = false,
}: ChatMessageProps) {
  const [displayedText, setDisplayedText] = useState('');
  const [showReasoning, setShowReasoning] = useState(false);
  const colorScheme = useColorScheme();

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
  const hasReasoning = isAi && reasoning && reasoning.trim().length > 0 && !inlineStreamingReasoning;
  const canToggleReasoning = hasReasoning;
  const markdownStyles = getMarkdownStyles(colorScheme === 'dark', { fontWeight: '600' });
  const reasoningMarkdownStyles = getMarkdownStyles(colorScheme === 'dark', {
    color: colorScheme === 'dark' ? '#cbd5e1' : '#475569',
    fontSize: 14,
    fontStyle: 'italic'
  });
  const markdownListProps = {
    scrollEnabled: false,
    style: { backgroundColor: 'transparent' },
  };

  const messageTextClassName = isAi
    ? 'text-[15px] leading-[22px] font-semibold text-text-light dark:text-text-dark'
    : 'text-[15px] leading-[22px] font-bold text-user-text dark:text-user-text-dark';

  return (
    <Animated.View
      entering={FadeInDown.duration(500).springify()}
      layout={Layout.springify()}
      className={`w-full ${isReadOnly ? 'opacity-70' : ''}`}
    >
      <Pressable
        onPress={toggleReasoning}
        disabled={!canToggleReasoning}
        className="py-1"
        android_ripple={canToggleReasoning ? { color: 'rgba(0,0,0,0.1)' } : undefined}
      >
        {/* AI messages use markdown rendering when not streaming */}
        {isAi && isStreaming && displayedText.length === 0 ? (
          <View className="py-1">
            {inlineStreamingReasoning ? (
              <View>
                <Text className="text-[11px] font-semibold text-text-secondary-light dark:text-text-secondary-dark uppercase tracking-wide mb-1">
                  AI reasoning (live)
                </Text>
                <Markdown
                  value={reasoning || ''}
                  styles={reasoningMarkdownStyles}
                  flatListProps={markdownListProps}
                />
              </View>
            ) : (
              <TypingIndicator colorClassName="text-text-secondary-light dark:text-text-secondary-dark" />
            )}
          </View>
        ) : isAi ? (
          <Markdown
            value={displayedText}
            styles={markdownStyles}
            flatListProps={markdownListProps}
          />
        ) : (
          <Text
            className={messageTextClassName}
          >
            {displayedText}
          </Text>
        )}

        {/* Reasoning indicator */}
        {hasReasoning && (
          <View className="flex-row items-center mt-3 pt-2 border-t border-blue-100 dark:border-slate-600">
            <MaterialIcons
              name={showReasoning ? "expand-less" : "psychology"}
              size={16}
              color={colorScheme === 'dark' ? '#93c5fd' : '#1e40af'}
            />
            <Text className="ml-1.5 text-xs text-blue-600 dark:text-blue-300 font-medium">
              {showReasoning ? 'Hide reasoning' : 'View AI reasoning'}
              {isStreaming && ' (thinking...)'}
            </Text>
          </View>
        )}
      </Pressable>

      {/* Reasoning content */}
      {showReasoning && hasReasoning && (
        <Animated.View
          entering={FadeIn.duration(300)}
          exiting={FadeOut.duration(200)}
          className="px-4 pb-4"
        >
          <View className="bg-blue-100/50 dark:bg-slate-700/50 rounded-xl p-3 border border-blue-200/50 dark:border-slate-600/50">
            <View className="flex-row items-center mb-2">
              <MaterialIcons
                name="psychology"
                size={14}
                color={colorScheme === 'dark' ? '#94a3b8' : '#64748b'}
              />
              <Text className="ml-1.5 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">
                AI Reasoning
              </Text>
            </View>
            <Markdown
              value={reasoning}
              styles={reasoningMarkdownStyles}
              flatListProps={markdownListProps}
            />
          </View>
        </Animated.View>
      )}
    </Animated.View>
  );
}
