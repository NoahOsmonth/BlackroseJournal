import { useColorScheme } from '@/hooks/use-color-scheme';
import { useThemeSettings } from '@/hooks/useThemeSettings';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import React, { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import {
  NativeSyntheticEvent,
  Platform,
  Pressable,
  TextInput,
  TextInputKeyPressEventData,
  TextStyle,
  View,
} from 'react-native';
import Animated, {
  FadeIn,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming
} from 'react-native-reanimated';

export interface InlineTypingInputRef {
  focus: () => void;
  blur: () => void;
  clear: () => void;
  /** Seed the slip with a stem the writer completes, then focus it. */
  setText: (text: string) => void;
}

interface InlineTypingInputProps {
  onSubmit: (text: string) => void;
  disabled?: boolean;
  placeholder?: string;
  onTextChange?: (text: string) => void;
}

/**
 * The composer. A bordered slip with the writing prompt inside and one quiet
 * send control — no filled brand button, no fake caret block.
 */
export const InlineTypingInput = forwardRef<InlineTypingInputRef, InlineTypingInputProps>(
  ({ onSubmit, disabled = false, placeholder = "Write what's true…", onTextChange }, ref) => {
    const [text, setText] = useState('');
    const [isFocused, setIsFocused] = useState(false);
    const inputRef = useRef<TextInput>(null);
    const colorScheme = useColorScheme();
    const { colorTheme } = useThemeSettings();
    const isDark = colorScheme === 'dark';
    const colors = colorTheme.colors;
    const inputTextColor = isDark ? colors.chatUserTextDark : colors.chatUserTextLight;
    const placeholderColor = isDark ? colors.secondaryTextDark : colors.secondaryTextLight;
    const cursorColor = isDark ? colors.accentDark : colors.accentLight;

    const cursorOpacity = useSharedValue(1);

    const updateText = (nextText: string) => {
      setText(nextText);
      onTextChange?.(nextText);
    };

    useImperativeHandle(ref, () => ({
      focus: () => inputRef.current?.focus(),
      blur: () => inputRef.current?.blur(),
      clear: () => updateText(''),
      setText: (next: string) => {
        updateText(next);
        inputRef.current?.focus();
      },
    }));

    useEffect(() => {
      if (isFocused && !text) {
        cursorOpacity.value = withRepeat(
          withSequence(
            withTiming(0, { duration: 500 }),
            withTiming(1, { duration: 500 })
          ),
          -1,
          false
        );
      } else {
        cursorOpacity.value = 1;
      }
    }, [isFocused, text, cursorOpacity]);

    const cursorStyle = useAnimatedStyle(() => ({
      opacity: cursorOpacity.value,
    }));

    const handleKeyPress = (e: NativeSyntheticEvent<TextInputKeyPressEventData>) => {
      if (Platform.OS === 'web') {
        const nativeEvent = e.nativeEvent as TextInputKeyPressEventData & { shiftKey?: boolean };
        if (nativeEvent.key === 'Enter' && !nativeEvent.shiftKey) {
          e.preventDefault?.();
          handleSubmit();
        }
      }
    };

    const handleSubmit = () => {
      const trimmed = text.trim();
      if (trimmed && !disabled) {
        onSubmit(trimmed);
        updateText('');
      }
    };

    const handleSubmitEditing = () => {
      if (Platform.OS !== 'web') {
        handleSubmit();
      }
    };

    const canSend = text.trim().length > 0 && !disabled;
    const sendFill = isDark ? '#C9C2B6' : '#5C564C';
    const sendGlyph = isDark ? '#151518' : '#FFFDF9';

    return (
      <Animated.View
        entering={FadeIn.duration(300)}
        className={`w-full ${disabled ? 'opacity-60' : ''}`}
      >
        <View className="gap-2 rounded-control border border-hairline-light bg-surface-light px-3.5 py-2.5 dark:border-hairline-dark dark:bg-surface-dark">
          <View className="flex-row items-end">
            <TextInput
              ref={inputRef}
              className="flex-1 py-0.5 text-[13px] leading-[20px] text-user-text dark:text-user-text-dark min-h-[20px]"
              value={text}
              onChangeText={updateText}
              onFocus={() => setIsFocused(true)}
              onBlur={() => setIsFocused(false)}
              onKeyPress={handleKeyPress}
              onSubmitEditing={handleSubmitEditing}
              placeholder={placeholder}
              placeholderTextColor={placeholderColor}
              multiline
              blurOnSubmit={false}
              editable={!disabled}
              autoFocus
              style={{
                outlineStyle: 'none',
                borderWidth: 0,
                backgroundColor: 'transparent',
                color: inputTextColor,
              } as TextStyle & { outlineStyle: 'none' }}
            />
            {isFocused && !text ? (
              <Animated.View
                className="ml-0.5 h-4 w-0.5"
                style={[cursorStyle, { backgroundColor: cursorColor }]}
              />
            ) : null}
          </View>

          <View className="flex-row items-center justify-end">
            {/* Concept: a solid bone disc with the paper plane knocked out —
                always figured, so the send affordance never disappears. */}
            <Pressable
              onPress={handleSubmit}
              disabled={!canSend}
              className="h-6 w-6 items-center justify-center rounded-full"
              accessibilityRole="button"
              accessibilityState={{ disabled: !canSend }}
              accessibilityLabel="Send message"
              hitSlop={8}
              style={({ pressed }) => [
                { backgroundColor: sendFill, opacity: canSend ? (pressed ? 0.75 : 1) : 0.5 },
              ]}
            >
              <MaterialIcons name="send" size={13} color={sendGlyph} />
            </Pressable>
          </View>
        </View>
      </Animated.View>
    );
  }
);

InlineTypingInput.displayName = 'InlineTypingInput';
