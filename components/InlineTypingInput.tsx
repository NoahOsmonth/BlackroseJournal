import React, { useState, useRef, useEffect, useImperativeHandle, forwardRef } from 'react';
import { TextInput, View, Platform, NativeSyntheticEvent, TextInputKeyPressEventData } from 'react-native';
import Animated, { 
  useSharedValue, 
  useAnimatedStyle, 
  withRepeat, 
  withSequence, 
  withTiming,
  FadeIn 
} from 'react-native-reanimated';
import { useColorScheme } from '@/hooks/use-color-scheme';

export interface InlineTypingInputRef {
  focus: () => void;
  blur: () => void;
  clear: () => void;
}

interface InlineTypingInputProps {
  onSubmit: (text: string) => void;
  disabled?: boolean;
  placeholder?: string;
}

export const InlineTypingInput = forwardRef<InlineTypingInputRef, InlineTypingInputProps>(
  ({ onSubmit, disabled = false, placeholder = "Type your thoughts..." }, ref) => {
    const [text, setText] = useState('');
    const [isFocused, setIsFocused] = useState(false);
    const inputRef = useRef<TextInput>(null);
    const colorScheme = useColorScheme();
    
    const cursorOpacity = useSharedValue(1);

    useImperativeHandle(ref, () => ({
      focus: () => inputRef.current?.focus(),
      blur: () => inputRef.current?.blur(),
      clear: () => setText(''),
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
    }, [isFocused, text]);

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
        setText('');
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
        className={`mb-4 max-w-[85%] self-end p-4 shadow-sm rounded-2xl rounded-tr-none border ${
          isFocused 
            ? 'bg-white dark:bg-slate-700 border-blue-300 dark:border-blue-500' 
            : 'bg-white/80 dark:bg-slate-700/80 border-slate-100 dark:border-slate-600'
        } ${disabled ? 'opacity-50' : ''}`}
      >
        <View className="flex-row items-center">
          <TextInput
            ref={inputRef}
            className="flex-1 text-[16px] leading-[26px] font-sans text-user-text dark:text-slate-200 min-h-[26px]"
            value={text}
            onChangeText={setText}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
            onKeyPress={handleKeyPress}
            onSubmitEditing={handleSubmitEditing}
            placeholder={placeholder}
            placeholderTextColor={colorScheme === 'dark' ? '#64748b' : '#94a3b8'}
            multiline
            blurOnSubmit={false}
            editable={!disabled}
            autoFocus
            style={{ 
              outlineStyle: 'none',
              borderWidth: 0,
              backgroundColor: 'transparent',
            } as any}
          />
          {isFocused && !text && (
            <Animated.View 
              style={cursorStyle}
              className="w-0.5 h-5 bg-blue-500 dark:bg-blue-400 ml-0.5"
            />
          )}
        </View>
      </Animated.View>
    );
  }
);

InlineTypingInput.displayName = 'InlineTypingInput';
