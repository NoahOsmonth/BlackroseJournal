import { useColorScheme } from '@/hooks/use-color-scheme';
import { useThemeSettings } from '@/hooks/useThemeSettings';
import React, { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import {
  NativeSyntheticEvent,
  Platform,
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
  /**
   * Fires when the slip takes or loses focus. The screen uses it to push the
   * transcript to its end, so the verbs stay above the keyboard when the writer
   * taps back into a slip that has scrolled away (no keyboard event fires then).
   */
  onFocusChange?: (isFocused: boolean) => void;
}

/**
 * The writing slip, inline in the transcript.
 *
 * The reference composer has no input box: the writer's line sits in the flow
 * like every other turn, and the verbs that act on it (Go deeper / Finish
 * entry) live in the pinned bar below. So this is a bare TextInput on the page
 * background — no border, no surface, no send disc — with a blinking caret as
 * the only affordance that says "you can write here".
 */
export const InlineTypingInput = forwardRef<InlineTypingInputRef, InlineTypingInputProps>(
  ({ onSubmit, disabled = false, placeholder = "Write what's true…", onTextChange, onFocusChange }, ref) => {
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

    const handleSubmit = () => {
      const trimmed = text.trim();
      if (trimmed && !disabled) {
        onSubmit(trimmed);
        updateText('');
      }
    };

    const handleKeyPress = (e: NativeSyntheticEvent<TextInputKeyPressEventData>) => {
      if (Platform.OS === 'web') {
        const nativeEvent = e.nativeEvent as TextInputKeyPressEventData & { shiftKey?: boolean };
        if (nativeEvent.key === 'Enter' && !nativeEvent.shiftKey) {
          e.preventDefault?.();
          handleSubmit();
        }
      }
    };

    const handleSubmitEditing = () => {
      if (Platform.OS !== 'web') {
        handleSubmit();
      }
    };

    return (
      <Animated.View
        entering={FadeIn.duration(300)}
        className={`w-full ${disabled ? 'opacity-60' : ''}`}
      >
        <View className="flex-row items-start">
          <TextInput
            ref={inputRef}
            className="min-h-[24px] flex-1 py-0 text-[15px] leading-[24px] text-user-text dark:text-user-text-dark"
            value={text}
            onChangeText={updateText}
            onFocus={() => {
              setIsFocused(true);
              onFocusChange?.(true);
            }}
            onBlur={() => {
              setIsFocused(false);
              onFocusChange?.(false);
            }}
            onKeyPress={handleKeyPress}
            onSubmitEditing={handleSubmitEditing}
            placeholder={placeholder}
            placeholderTextColor={placeholderColor}
            multiline
            blurOnSubmit={false}
            editable={!disabled}
            autoFocus
            accessibilityLabel="Write what's true"
            style={{
              outlineStyle: 'none',
              borderWidth: 0,
              backgroundColor: 'transparent',
              color: inputTextColor,
              fontFamily: 'PlayfairDisplayRegular',
            } as TextStyle & { outlineStyle: 'none' }}
          />
          {isFocused && !text ? (
            <Animated.View
              className="ml-0.5 mt-1 h-4 w-0.5"
              style={[cursorStyle, { backgroundColor: cursorColor }]}
            />
          ) : null}
        </View>
      </Animated.View>
    );
  }
);

InlineTypingInput.displayName = 'InlineTypingInput';
