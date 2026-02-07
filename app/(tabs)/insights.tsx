/**
 * Insights Screen
 * Weekly analysis of journal entries
 */

import { CastOfCharacters } from '@/components/insights/CastOfCharacters';
import { EmotionalLandscapeChart } from '@/components/insights/EmotionalLandscapeChart';
import { KeyThemes } from '@/components/insights/KeyThemes';
import { BottomNav } from '@/components/journal';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useThemeSettings } from '@/hooks/useThemeSettings';
import { useWeeklyInsights } from '@/hooks/useWeeklyInsights';
import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React from 'react';
import { ActivityIndicator, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const Header = ({ dateRange, iconColor }: { dateRange: string; iconColor: string }) => (
  <View className="mb-6">
    <View className="bg-surface-light dark:bg-surface-dark rounded-xl p-3 flex-row items-center justify-between shadow-sm border border-gray-100 dark:border-gray-800">
      <TouchableOpacity className="p-1 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800">
        <MaterialIcons name="chevron-left" size={24} color={iconColor} />
      </TouchableOpacity>
      <View className="items-center">
        <Text className="text-base font-semibold text-text-primary-light dark:text-text-primary-dark">This week</Text>
        <Text className="text-xs text-text-secondary-light dark:text-text-secondary-dark">{dateRange}</Text>
      </View>
      <View className="w-8" />
    </View>
  </View>
);

const WeeklyReportCard = ({
  isLocked,
  entriesNeeded,
  iconColor,
}: {
  isLocked: boolean;
  entriesNeeded: number;
  iconColor: string;
}) => (
  <View className="mb-6">
    <View className="items-center justify-center mb-3">
      <Text className="text-sm font-medium text-text-secondary-light dark:text-text-secondary-dark uppercase tracking-wide">Weekly Report</Text>
    </View>
    <View className="bg-surface-light dark:bg-surface-dark rounded-2xl p-8 items-center justify-center shadow-sm border border-gray-100 dark:border-gray-800 min-h-[180px]">
      <View className="flex-row items-center gap-2 mb-3">
        <MaterialIcons name="lock" size={20} color={iconColor} />
        <Text className="text-text-primary-light dark:text-text-primary-dark font-semibold">Unlocks Saturday</Text>
      </View>
      <Text className="text-sm text-text-secondary-light dark:text-text-secondary-dark mb-4 text-center max-w-[250px]">
        Get a weekly in-depth AI analysis of your themes, patterns, and more.
      </Text>
      <Text className="text-xs font-medium text-text-secondary-light dark:text-text-secondary-dark opacity-70">
        Requires {entriesNeeded} more entry
      </Text>
    </View>
  </View>
);

const DAY_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const DAILY_WORDS_HEIGHT = 112;
const DAILY_WORDS_CONTAINER_HEIGHT = DAILY_WORDS_HEIGHT + 16;
const DAILY_WORDS_MIN_BAR = 6;

const getDailyBarHeight = (count: number, maxWords: number) => {
  const ratio = maxWords > 0 ? count / maxWords : 0;
  const scaled = Math.round(ratio * DAILY_WORDS_HEIGHT);
  return Math.max(scaled, DAILY_WORDS_MIN_BAR);
};

const WritingStatsCard = ({
  words,
  entries,
  dailyWords,
}: {
  words: number;
  entries: number;
  dailyWords: number[];
}) => {
  const maxWords = Math.max(...dailyWords, 1);
  const todayIndex = new Date().getDay();

  return (
    <View className="mb-6">
      <View className="items-center justify-center mb-3">
        <Text className="text-sm font-medium text-text-secondary-light dark:text-text-secondary-dark uppercase tracking-wide">
          Writing stats
        </Text>
      </View>
      <View className="flex-row gap-4 mb-4">
        <View className="flex-1 bg-surface-light dark:bg-surface-dark rounded-2xl p-4 shadow-sm border border-gray-100 dark:border-gray-800">
          <Text className="text-xs text-text-secondary-light dark:text-text-secondary-dark mb-1 font-medium">Words</Text>
          <Text className="text-3xl font-bold text-text-primary-light dark:text-text-primary-dark">{words}</Text>
        </View>
        <View className="flex-1 bg-surface-light dark:bg-surface-dark rounded-2xl p-4 shadow-sm border border-gray-100 dark:border-gray-800">
          <Text className="text-xs text-text-secondary-light dark:text-text-secondary-dark mb-1 font-medium">Entries</Text>
          <Text className="text-3xl font-bold text-text-primary-light dark:text-text-primary-dark">{entries}</Text>
        </View>
      </View>
      <View className="bg-surface-light dark:bg-surface-dark rounded-2xl p-5 shadow-sm border border-gray-100 dark:border-gray-800">
        <Text className="font-semibold mb-6 text-text-primary-light dark:text-text-primary-dark">Daily words</Text>
        <View
          className="w-full flex-row items-end justify-between px-2 relative"
          style={{ height: DAILY_WORDS_CONTAINER_HEIGHT }}
        >
          <View className="absolute right-0 top-0 h-full flex justify-between">
            <Text className="text-[10px] text-text-secondary-light dark:text-text-secondary-dark">{maxWords}</Text>
            <Text className="text-[10px] text-text-secondary-light dark:text-text-secondary-dark">0</Text>
          </View>
          {dailyWords.map((count, i) => {
            const barHeight = getDailyBarHeight(count, maxWords);
            const isToday = i === todayIndex;
            const hasWords = count > 0;
            const barTone = hasWords ? 'bg-primary' : 'bg-gray-300 dark:bg-gray-700';
            const barShadow = isToday && hasWords ? 'shadow-soft' : '';
            return (
              <View key={i} className="items-center gap-2 flex-1">
                <View
                  className="w-3 rounded-full bg-divider-light dark:bg-divider-dark justify-end overflow-hidden"
                  style={{ height: DAILY_WORDS_HEIGHT }}
                >
                  <View
                    accessibilityLabel={`${DAY_NAMES[i]} ${count} words`}
                    accessibilityRole="image"
                    accessibilityValue={{ now: count, min: 0, max: maxWords }}
                    testID={`daily-words-bar-${i}`}
                    className={`w-3 rounded-full ${barTone} ${barShadow}`}
                    style={{ height: barHeight }}
                  />
                </View>
                <Text
                  className={`text-xs ${isToday
                    ? 'text-text-primary-light dark:text-text-primary-dark'
                    : 'text-text-secondary-light dark:text-text-secondary-dark'
                    }`}
                >
                  {DAY_LABELS[i]}
                </Text>
              </View>
            );
          })}
          <View className="absolute bottom-6 left-0 right-0 h-[1px] bg-divider-light dark:bg-divider-dark -z-10" />
        </View>
      </View>
    </View>
  );
};

export default function InsightsScreen() {
  const router = useRouter();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const iconSecondary = isDark ? '#9CA3AF' : '#6B7280';
  const iconPrimary = isDark ? '#F9FAFB' : '#111827';
  const { insights, weeklyStats, weekDateRange, isLoading } = useWeeklyInsights();
  const { emojiStyle } = useThemeSettings();

  const handleTabPress = (tab: 'today' | 'explore' | 'entries' | 'settings' | 'insights') => {
    if (tab !== 'insights') {
      router.push(`/(tabs)/${tab}`);
    }
  };

  const handleNewEntry = () => {
    router.push('/chat');
  };

  return (
    <SafeAreaView className="flex-1 bg-background-light dark:bg-background-dark" edges={['top']}>
      <View className="flex-1 max-w-md mx-auto w-full">
        <View className="px-4 pt-6 flex-1">
          <Header dateRange={weekDateRange} iconColor={iconSecondary} />
          
          <ScrollView 
            className="flex-1"
            contentContainerStyle={{ paddingBottom: 100 }}
            showsVerticalScrollIndicator={false}
          >
            <WeeklyReportCard
              isLocked={false}
              entriesNeeded={Math.max(0, 5 - weeklyStats.entriesCount)}
              iconColor={iconPrimary}
            />
            
            <WritingStatsCard 
              words={weeklyStats.totalWords} 
              entries={weeklyStats.entriesCount} 
              dailyWords={weeklyStats.dailyWords} 
            />

             <View className="mb-6">
                <View className="items-center justify-center mb-3">
                  <Text className="text-sm font-medium text-text-secondary-light dark:text-text-secondary-dark uppercase tracking-wide">Your week so far</Text>
                </View>
                {isLoading ? (
                    <View className="bg-surface-light dark:bg-surface-dark rounded-2xl p-5 shadow-sm border border-gray-100 dark:border-gray-800 mb-4 h-40 items-center justify-center">
                        <ActivityIndicator size="small" />
                        <Text className="text-xs text-text-secondary-light dark:text-text-secondary-dark mt-2">
                          Analyzing journal...
                        </Text>
                    </View>
                ) : (
                    <>
                      <View className="bg-surface-light dark:bg-surface-dark rounded-2xl p-5 shadow-sm border border-gray-100 dark:border-gray-800 mb-4">
                          <Text className="font-semibold mb-3 text-text-primary-light dark:text-text-primary-dark">Emotional Landscape</Text>
                          <EmotionalLandscapeChart data={insights?.emotionalLandscape || []} emojiStyle={emojiStyle} />
                      </View>
                      
                      <KeyThemes themes={insights?.keyThemes || []} />
                      <CastOfCharacters characters={insights?.castOfCharacters || []} />
                    </>
                )}
             </View>

          </ScrollView>
        </View>

        <BottomNav
          activeTab="insights"
          onTabPress={handleTabPress}
          onFabPress={handleNewEntry}
        />
      </View>
    </SafeAreaView>
  );
}
