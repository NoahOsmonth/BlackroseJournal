import { useColorScheme } from '@/hooks/use-color-scheme';
import { useThemeSettings } from '@/hooks/useThemeSettings';
import React, { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { NativeSyntheticEvent, Platform, TextInput, TextInputKeyPressEventData, TextStyle, View } from 'react-native';
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
}

interface InlineTypingInputProps {
  onSubmit: (text: string) => void;
  disabled?: boolean;
  placeholder?: string;
  onTextChange?: (text: string) => void;
}

export const InlineTypingInput = forwardRef<InlineTypingInputRef, InlineTypingInputProps>(
  ({ onSubmit, disabled = false, placeholder = "Type your thoughts...", onTextChange }, ref) => {
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

    return (
      <Animated.View
        entering={FadeIn.duration(300)}
        className={`w-full ${disabled ? 'opacity-50' : ''}`}
      >
        <View className="flex-row items-center py-1">
          <TextInput
            ref={inputRef}
            className="flex-1 text-[15px] leading-[22px] font-bold text-user-text dark:text-user-text-dark min-h-[22px]"
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
          {isFocused && !text && (
            <Animated.View
              className="w-0.5 h-5 bg-primary dark:bg-primary-dark ml-0.5"
              style={[cursorStyle, { backgroundColor: cursorColor }]}
            />
          )}
        </View>
      </Animated.View>
    );
  }
);

InlineTypingInput.displayName = 'InlineTypingInput';
