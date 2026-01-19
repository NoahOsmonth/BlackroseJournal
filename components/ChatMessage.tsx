import { getMarkdownStyles } from '@/constants/markdownStyles';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { MaterialIcons } from '@expo/vector-icons';
import React, { useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import Markdown from 'react-native-markdown-display';
import Animated, {
  FadeIn,
  FadeInDown,
  FadeOut,
  Layout,
  useAnimatedStyle,
  useSharedValue,
  withTiming
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
  const [showCursor, setShowCursor] = useState(false);
  const [showReasoning, setShowReasoning] = useState(false);
  const cursorOpacity = useSharedValue(1);
  const colorScheme = useColorScheme();

  useEffect(() => {
    if (isStreaming) {
      setDisplayedText('');
      setShowCursor(true);
      cursorOpacity.value = 1;

      let index = 0;
      const charArray = text.split('');

      const interval = setInterval(() => {
        if (index < charArray.length) {
          setDisplayedText(charArray.slice(0, index + 1).join(''));
          index++;
        } else {
          clearInterval(interval);
          setShowCursor(false);
          cursorOpacity.value = withTiming(0, { duration: 200 });
        }
      }, 15);

      return () => clearInterval(interval);
    } else {
      setDisplayedText(text);
      setShowCursor(false);
    }
  }, [text, isStreaming, cursorOpacity]);

  useEffect(() => {
    if (showCursor) {
      const blinkInterval = setInterval(() => {
        cursorOpacity.value = cursorOpacity.value === 1 ? 0 : 1;
      }, 500);

      return () => clearInterval(blinkInterval);
    }
  }, [showCursor, cursorOpacity]);

  const cursorAnimatedStyle = useAnimatedStyle(() => ({
    opacity: cursorOpacity.value,
  }));

  const toggleReasoning = () => {
    if (reasoning && isAi) {
      setShowReasoning(!showReasoning);
    }
  };

  const hasReasoning = isAi && reasoning && reasoning.trim().length > 0;
  const markdownStyles = getMarkdownStyles(colorScheme === 'dark', { fontWeight: '600' });
  const messageTextClassName = isAi
    ? 'text-[15px] leading-[22px] font-semibold text-text-light dark:text-text-dark'
    : 'text-[15px] leading-[22px] font-bold text-user-text dark:text-text-main-dark';

  return (
    <Animated.View
      entering={FadeInDown.duration(500).springify()}
      layout={Layout.springify()}
      className={`w-full ${isReadOnly ? 'opacity-70' : ''}`}
    >
      <Pressable
        onPress={toggleReasoning}
        className="py-1"
        android_ripple={hasReasoning ? { color: 'rgba(0,0,0,0.1)' } : undefined}
      >
        {/* AI messages use markdown rendering when not streaming */}
        {isAi && !isStreaming ? (
          <Markdown style={markdownStyles}>
            {displayedText}
          </Markdown>
        ) : (
          <Text
            className={messageTextClassName}
          >
            {displayedText}
            {showCursor && (
              <Animated.Text
                style={cursorAnimatedStyle}
                className="text-text-light dark:text-text-dark"
              >
                |
              </Animated.Text>
            )}
          </Text>
        )}

        {/* Reasoning indicator */}
        {hasReasoning && !isStreaming && (
          <View className="flex-row items-center mt-3 pt-2 border-t border-blue-100 dark:border-slate-600">
            <MaterialIcons
              name={showReasoning ? "expand-less" : "psychology"}
              size={16}
              color={colorScheme === 'dark' ? '#93c5fd' : '#1e40af'}
            />
            <Text className="ml-1.5 text-xs text-blue-600 dark:text-blue-300 font-medium">
              {showReasoning ? 'Hide reasoning' : 'View AI reasoning'}
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
            <Text className="text-[14px] leading-[22px] text-slate-600 dark:text-slate-300 italic">
              {reasoning}
            </Text>
          </View>
        </Animated.View>
      )}
    </Animated.View>
  );
}
