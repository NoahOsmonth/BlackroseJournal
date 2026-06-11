import { MaterialIcons } from '@expo/vector-icons';
import { Colors } from '@/constants/theme';
import { useActiveModelContext } from '@/hooks/settings/useActiveModelContext';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { formatModelContextLabel } from '@/services/ai/modelContext';
import React from 'react';
import { Pressable, Text, View } from 'react-native';

interface HeaderProps {
  onClose?: () => void;
  onDraftsPress?: () => void;
  /** Active persona name; when provided the pill becomes a persona switcher. */
  personaName?: string;
  /** Opens the persona sheet. Required for the pill to be interactive. */
  onPersonaPress?: () => void;
}

export function Header({ onClose, onDraftsPress, personaName, onPersonaPress }: HeaderProps) {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const { context } = useActiveModelContext();
  const pillLabel = personaName ?? 'Blackrose';
  const pillInitial = pillLabel.trim().charAt(0).toUpperCase() || 'B';
  const isPersonaPill = Boolean(onPersonaPress);
  const mutedIconColor = isDark ? Colors.dark.tabIconDefault : Colors.light.tabIconDefault;
  const closeIconColor = isDark ? Colors.dark.text : Colors.light.text;
  const modelLabel = context ? formatModelContextLabel(context) : undefined;

  return (
    <View className="pt-4 px-4 pb-2 bg-background-light dark:bg-background-dark z-10 border-b border-transparent">
      <View className="flex-row items-center justify-between">
        {/* Pill — doubles as the persona switcher when onPersonaPress is provided */}
        <Pressable
          onPress={onPersonaPress}
          disabled={!isPersonaPill}
          accessibilityRole={isPersonaPill ? 'button' : undefined}
          accessibilityLabel={isPersonaPill ? `Persona: ${pillLabel}. Tap to switch.` : undefined}
          className="flex-row items-center bg-white dark:bg-slate-800 px-3 py-1.5 rounded-full border border-slate-200 dark:border-slate-700 shadow-sm gap-1.5"
        >
          <View className="w-5 h-5 bg-primary rounded-full items-center justify-center">
            <Text className="text-[10px] text-surface-light dark:text-surface-light font-bold leading-none mt-[1px]">{pillInitial}</Text>
          </View>
          <Text className="text-sm font-serif text-user-text dark:text-user-text-dark">{pillLabel}</Text>
          <MaterialIcons name="expand-more" size={18} color={mutedIconColor} />
        </Pressable>

        {/* Right Actions */}
        <View className="flex-row items-center gap-4">
          <Pressable onPress={onDraftsPress}>
            <Text className="text-[15px] font-serif text-user-text dark:text-user-text-dark">Drafts</Text>
          </Pressable>
          <Pressable
            onPress={onClose}
            className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full"
          >
            <MaterialIcons name="close" size={22} color={closeIconColor} />
          </Pressable>
        </View>
      </View>
      {modelLabel ? (
        <Text className="mt-2 text-[11px] text-text-secondary-light dark:text-text-secondary-dark">
          {modelLabel}
        </Text>
      ) : null}
    </View>
  );
}
