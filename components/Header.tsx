import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useColorScheme } from '@/hooks/use-color-scheme';
import React from 'react';
import { Pressable, Text, View } from 'react-native';

import { BLACKROSE_PALETTE } from '@/constants/theme';
import { RoseMark } from '@/components/ui/RoseMark';

interface HeaderProps {
  onClose?: () => void;
  onDraftsPress?: () => void;
  /** Active persona name; when provided the pill becomes a persona switcher. */
  personaName?: string;
  /** Opens the persona sheet. Required for the pill to be interactive. */
  onPersonaPress?: () => void;
  /** Opens the chat model picker sheet. */
  onModelPress?: () => void;
  /** Disable model picker (e.g. while streaming). */
  modelPickerDisabled?: boolean;
  /** Serif title for this sitting (e.g. “Evening close”). */
  title?: string;
}

/**
 * Chat header: one calm row — back chevron, a line rose beside the sitting's
 * name, and a quiet trailing verb. The model picker is reached by tapping the
 * sitting name (which carries the chevron); there is no second chrome band.
 */
export function Header({
  onClose,
  onDraftsPress,
  personaName,
  onPersonaPress,
  title,
}: HeaderProps) {
  const isDark = useColorScheme() === 'dark';
  const pillLabel = personaName ?? 'Blackrose';
  const isPersonaPill = Boolean(onPersonaPress);
  const closeIconColor = isDark ? BLACKROSE_PALETTE.dark.text : BLACKROSE_PALETTE.light.text;
  const markColor = isDark ? BLACKROSE_PALETTE.dark.accent : BLACKROSE_PALETTE.light.accent;
  const heading = title ?? pillLabel;

  return (
    <View className="z-10 border-b border-hairline-light bg-background-light px-4 pb-2 pt-3 dark:border-hairline-dark dark:bg-background-dark">
      <View className="flex-row items-center justify-between gap-3">
        <Pressable
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel="Close chat"
          hitSlop={10}
          className="h-8 w-8 items-center justify-center"
        >
          <MaterialIcons name="chevron-left" size={24} color={closeIconColor} />
        </Pressable>

        <Pressable
          onPress={onPersonaPress}
          disabled={!isPersonaPill}
          accessibilityRole={isPersonaPill ? 'button' : undefined}
          accessibilityLabel={isPersonaPill ? `Persona: ${pillLabel}. Tap to switch.` : undefined}
          className="min-w-0 flex-1 flex-row items-center justify-center gap-2"
        >
          <RoseMark size={16} color={markColor} variant="bloom" />
          <Text
            className="text-center text-[15px] text-text-light dark:text-text-dark"
            style={{ fontFamily: 'PlayfairDisplayRegular' }}
            numberOfLines={1}
          >
            {heading}
          </Text>
        </Pressable>

        {onDraftsPress ? (
          <Pressable
            onPress={onDraftsPress}
            accessibilityRole="button"
            accessibilityLabel="Open drafts"
            hitSlop={8}
          >
            <Text
              className="text-[15px] text-text-light dark:text-text-dark"
              style={{ fontFamily: 'PlayfairDisplayRegular' }}
            >
              Drafts
            </Text>
          </Pressable>
        ) : (
          <View className="w-8" />
        )}
      </View>
    </View>
  );
}
