import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { LoadingBar } from '@/components/ui/LoadingBar';
import { LoadingStatus } from '@/components/ui/LoadingStatus';

interface FooterActionsProps {
  onGoDeeper: () => void;
  onFinishEntry?: () => void;
  onNameFeeling?: () => void;
  disabled?: boolean;
  canGoDeeper?: boolean;
  canFinish?: boolean;
  isSaving?: boolean;
  savingLabel?: string;
  /** Label for the middle verb; the sitting decides the wording. */
  nameFeelingLabel?: string;
}

/**
 * The chat footer: bare outline verbs sitting above the composer. No fill, no
 * glyphs, no rule — the concept gives the conversation the emphasis and lets
 * the verbs read as a quiet row of choices.
 */
export function FooterActions({
  onGoDeeper,
  onFinishEntry,
  onNameFeeling,
  disabled = false,
  canGoDeeper = false,
  canFinish = false,
  isSaving = false,
  savingLabel = 'Saving your entry',
  nameFeelingLabel = 'Name the feeling',
}: FooterActionsProps) {
  const goDeeperDisabled = disabled || !canGoDeeper;
  const nameFeelingDisabled = disabled || !onNameFeeling;
  const finishEntryDisabled = disabled || !canFinish || !onFinishEntry || isSaving;

  const verbClass = 'flex-1 rounded-control border border-hairline-light dark:border-hairline-dark px-2 py-2';

  return (
    <View className="gap-3">
      <View className="flex-row gap-2">
        <Pressable
          className={[verbClass, goDeeperDisabled ? 'opacity-40' : ''].join(' ')}
          onPress={onGoDeeper}
          disabled={goDeeperDisabled}
          accessibilityRole="button"
          accessibilityLabel="Go deeper"
          style={({ pressed }) => [{ opacity: goDeeperDisabled ? 0.4 : pressed ? 0.7 : 1 }]}
        >
          <Text
            className="text-center text-[13px] text-text-light dark:text-text-dark"
            style={{ fontFamily: 'PlayfairDisplayRegular' }}
            numberOfLines={1}
          >
            Go deeper
          </Text>
        </Pressable>

        {onNameFeeling ? (
          <Pressable
            className={[verbClass, nameFeelingDisabled ? 'opacity-40' : ''].join(' ')}
            onPress={onNameFeeling}
            disabled={nameFeelingDisabled}
            accessibilityRole="button"
            accessibilityLabel={nameFeelingLabel}
            style={({ pressed }) => [{ opacity: nameFeelingDisabled ? 0.4 : pressed ? 0.7 : 1 }]}
          >
            <Text
              className="text-center text-[13px] text-text-light dark:text-text-dark"
              style={{ fontFamily: 'PlayfairDisplayRegular' }}
              numberOfLines={1}
            >
              {nameFeelingLabel}
            </Text>
          </Pressable>
        ) : null}

        <Pressable
          className={[verbClass, finishEntryDisabled && !isSaving ? 'opacity-40' : ''].join(' ')}
          onPress={onFinishEntry}
          disabled={finishEntryDisabled}
          accessibilityRole="button"
          accessibilityLabel={isSaving ? 'Finishing entry' : 'Finish entry'}
          style={({ pressed }) => [{
            opacity: finishEntryDisabled && !isSaving ? 0.4 : pressed ? 0.7 : 1,
          }]}
        >
          {isSaving ? (
            <View className="flex-row items-center justify-center gap-2">
              <LoadingBar size="sm" tone="primary" accessibilityLabel="Finishing entry animation" />
              <Text
                className="text-[13px] text-text-light dark:text-text-dark"
                style={{ fontFamily: 'PlayfairDisplayRegular' }}
                numberOfLines={1}
              >
                Finishing
              </Text>
            </View>
          ) : (
            <Text
              className="text-center text-[13px] text-text-light dark:text-text-dark"
              style={{ fontFamily: 'PlayfairDisplayRegular' }}
              numberOfLines={1}
            >
              Finish entry
            </Text>
          )}
        </Pressable>
      </View>

      {isSaving ? (
        <LoadingStatus
          label={savingLabel}
          detail="Keep this open for a moment — your words are safe."
          compact
        />
      ) : null}
    </View>
  );
}
