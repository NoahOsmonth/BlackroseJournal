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
}

export function ChatMessage({ text, isAi = false, isStreaming = false, reasoning }: ChatMessageProps) {
  const [displayedText, setDisplayedText] = useState('');
  const [showCursor, setShowCursor] = useState(false);
  const [showReasoning, setShowReasoning] = useState(false);
  const cursorOpacity = useSharedValue(1);
  const reasoningHeight = useSharedValue(0);
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
  }, [text, isStreaming]);

  useEffect(() => {
    if (showCursor) {
      const blinkInterval = setInterval(() => {
        cursorOpacity.value = cursorOpacity.value === 1 ? 0 : 1;
      }, 500);

      return () => clearInterval(blinkInterval);
    }
  }, [showCursor]);

  const cursorAnimatedStyle = useAnimatedStyle(() => ({
    opacity: cursorOpacity.value,
  }));

  const toggleReasoning = () => {
    if (reasoning && isAi) {
      setShowReasoning(!showReasoning);
    }
  };

  const hasReasoning = isAi && reasoning && reasoning.trim().length > 0;

  return (
    <Animated.View
      entering={FadeInDown.duration(500).springify()}
      layout={Layout.springify()}
      className={`mb-4 max-w-[85%] shadow-sm ${isAi
          ? 'self-start bg-blue-50 dark:bg-slate-800 rounded-2xl rounded-tl-none border border-blue-100 dark:border-slate-700'
          : 'self-end bg-white dark:bg-slate-700 rounded-2xl rounded-tr-none border border-slate-100 dark:border-slate-600'
        }`}
    >
      <Pressable
        onPress={toggleReasoning}
        className="p-4"
        android_ripple={hasReasoning ? { color: 'rgba(0,0,0,0.1)' } : undefined}
      >
        {/* AI messages use markdown rendering when not streaming */}
        {isAi && !isStreaming ? (
          <Markdown style={getMarkdownStyles(colorScheme === 'dark')}>
            {displayedText}
          </Markdown>
        ) : (
          <Text
            className={`text-[16px] leading-[26px] font-sans ${isAi
                ? 'text-blue-800 dark:text-blue-200'
                : 'text-user-text dark:text-slate-200'
              }`}
          >
            {displayedText}
            {showCursor && (
              <Animated.Text style={cursorAnimatedStyle} className="text-blue-800 dark:text-blue-200">
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
