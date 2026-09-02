import { useThemeColor } from '@/hooks/use-theme-color';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { LoadingBar } from '@/components/ui/LoadingBar';
import { LoadingStatus } from '@/components/ui/LoadingStatus';

interface FooterActionsProps {
  onGoDeeper: () => void;
  onFinishEntry?: () => void;
  disabled?: boolean;
  canGoDeeper?: boolean;
  canFinish?: boolean;
  isSaving?: boolean;
  savingLabel?: string;
}

export function FooterActions({
  onGoDeeper,
  onFinishEntry,
  disabled = false,
  canGoDeeper = false,
  canFinish = false,
  isSaving = false,
  savingLabel = 'Saving your entry',
}: FooterActionsProps) {
  const textColor = useThemeColor({}, 'text');
  const goDeeperDisabled = disabled || !canGoDeeper;
  const finishEntryDisabled = disabled || !canFinish || !onFinishEntry || isSaving;

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
            <MaterialIcons name="south" size={18} color="#FFFFFF" />
            <Text className="font-bold text-[15px] text-white">Go deeper</Text>
          </View>
        </Pressable>
        <Pressable
          className={`flex-1 py-3 px-4 border rounded-xl shadow-sm active:opacity-80 ${isSaving ? 'bg-primary/10 dark:bg-primary/20 border-primary' : 'bg-surface-light dark:bg-surface-dark border-divider-light dark:border-divider-dark'} ${finishEntryDisabled && !isSaving ? 'opacity-50' : ''}`}
          onPress={onFinishEntry}
          disabled={finishEntryDisabled}
          accessibilityRole="button"
          accessibilityLabel={isSaving ? 'Finishing entry' : 'Finish entry'}
        >
          <View className="flex-row items-center justify-center gap-2">
            {isSaving ? (
              <>
                <LoadingBar size="sm" tone="primary" accessibilityLabel="Finishing entry animation" />
                <Text className="font-bold text-[15px] text-text-light dark:text-text-dark">Finishing</Text>
              </>
            ) : (
              <>
                <MaterialIcons name="check" size={18} color={textColor} />
                <Text className="font-bold text-[15px] text-text-light dark:text-text-dark">Finish entry</Text>
              </>
            )}
          </View>
        </Pressable>
      </View>

      {isSaving ? (
        <LoadingStatus
          label={savingLabel}
          detail="Keep this open for a moment — your words are safe."
          compact
          className="mt-3 px-4"
        />
      ) : null}

      {/* Home Indicator (Visual) */}
      <View className="items-center mt-6">
        <View className="w-32 h-1.5 bg-gray-200 dark:bg-slate-700 rounded-full" />
      </View>
    </View>
  );
}
