import { useThemeColor } from '@/hooks/use-theme-color';
import { MaterialIcons } from '@expo/vector-icons';
import React from 'react';
import { Pressable, Text, View } from 'react-native';

interface FooterActionsProps {
  onGoDeeper: () => void;
  onFinishEntry?: () => void;
  disabled?: boolean;
  canGoDeeper?: boolean;
  canFinish?: boolean;
}

export function FooterActions({
  onGoDeeper,
  onFinishEntry,
  disabled = false,
  canGoDeeper = false,
  canFinish = false,
}: FooterActionsProps) {
  const textColor = useThemeColor({}, 'text');
  const goDeeperDisabled = disabled || !canGoDeeper;
  const finishEntryDisabled = disabled || !canFinish || !onFinishEntry;

  return (
    <View className="bg-background-light dark:bg-background-dark border-t border-slate-100 dark:border-slate-800 pb-8 pt-4">
      {/* Action Buttons */}
      <View className="flex-row gap-3 px-4">
        <Pressable
          className={`flex-1 py-3 px-4 bg-primary rounded-xl shadow-sm active:opacity-80 ${goDeeperDisabled ? 'opacity-50' : ''}`}
          onPress={onGoDeeper}
          disabled={goDeeperDisabled}
          accessibilityRole="button"
          accessibilityLabel="Go deeper"
        >
          <View className="flex-row items-center justify-center gap-2">
            <MaterialIcons name="south" size={18} className="text-surface-light" />
            <Text className="font-bold text-[15px] text-surface-light">Go deeper</Text>
          </View>
        </Pressable>
        <Pressable
          className={`flex-1 py-3 px-4 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-sm active:opacity-80 ${finishEntryDisabled ? 'opacity-50' : ''}`}
          onPress={onFinishEntry}
          disabled={finishEntryDisabled}
          accessibilityRole="button"
          accessibilityLabel="Finish entry"
        >
          <View className="flex-row items-center justify-center gap-2">
            <MaterialIcons name="check" size={18} color={textColor} />
            <Text className="font-bold text-[15px] text-text-light dark:text-text-dark">Finish entry</Text>
          </View>
        </Pressable>
      </View>

      {/* Home Indicator (Visual) */}
      <View className="items-center mt-6">
        <View className="w-32 h-1.5 bg-gray-200 dark:bg-slate-700 rounded-full" />
      </View>
    </View>
  );
}
