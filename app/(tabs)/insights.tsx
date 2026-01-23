/**
 * Insights Screen
 * Weekly analysis of journal entries
 */

import { CastOfCharacters } from '@/components/insights/CastOfCharacters';
import { EmotionalLandscapeChart } from '@/components/insights/EmotionalLandscapeChart';
import { KeyThemes } from '@/components/insights/KeyThemes';
import { BottomNav } from '@/components/journal';
import { useThemeSettings } from '@/hooks/useThemeSettings';
import { useWeeklyInsights } from '@/hooks/useWeeklyInsights';
import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React from 'react';
import { ActivityIndicator, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const Header = ({ dateRange }: { dateRange: string }) => (
  <View className="mb-6">
    <View className="bg-surface-light dark:bg-surface-dark rounded-xl p-3 flex-row items-center justify-between shadow-sm border border-gray-100 dark:border-gray-800">
      <TouchableOpacity className="p-1 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800">
        <MaterialIcons name="chevron-left" size={24} className="text-text-secondary-light dark:text-text-secondary-dark" />
      </TouchableOpacity>
      <View className="items-center">
        <Text className="text-base font-semibold text-text-primary-light dark:text-text-primary-dark">This week</Text>
        <Text className="text-xs text-text-secondary-light dark:text-text-secondary-dark">{dateRange}</Text>
      </View>
      <View className="w-8" />
    </View>
  </View>
);

const WeeklyReportCard = ({ isLocked, entriesNeeded }: { isLocked: boolean; entriesNeeded: number }) => (
  <View className="mb-6">
    <View className="items-center justify-center mb-3">
      <Text className="text-sm font-medium text-text-secondary-light dark:text-text-secondary-dark uppercase tracking-wide">Weekly Report</Text>
    </View>
    <View className="bg-surface-light dark:bg-surface-dark rounded-2xl p-8 items-center justify-center shadow-sm border border-gray-100 dark:border-gray-800 min-h-[180px]">
      <View className="flex-row items-center gap-2 mb-3">
        <MaterialIcons name="lock" size={20} className="text-text-primary-light dark:text-text-primary-dark" />
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

const WritingStatsCard = ({ words, entries, dailyWords }: { words: number; entries: number; dailyWords: number[] }) => {
  const maxWords = Math.max(...dailyWords, 1);
  const days = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

  return (
    <View className="mb-6">
      <View className="items-center justify-center mb-3">
        <Text className="text-sm font-medium text-text-secondary-light dark:text-text-secondary-dark uppercase tracking-wide">Writing stats</Text>
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
        <View className="h-32 w-full flex-row items-end justify-between px-2 relative">
          <View className="absolute right-0 top-0 h-full flex justify-between">
            <Text className="text-[10px] text-text-secondary-light dark:text-text-secondary-dark">{maxWords}</Text>
            <Text className="text-[10px] text-text-secondary-light dark:text-text-secondary-dark">0</Text>
          </View>
          {dailyWords.map((count, i) => (
            <View key={i} className="items-center gap-2 w-full flex-1">
              <View 
                className={`w-3 rounded-t-full ${count > 0 ? 'bg-gray-400 dark:bg-gray-300' : 'bg-gray-200 dark:bg-gray-800'}`}
                style={{ height: `${(count / maxWords) * 100}%` }}
              />
              <Text className="text-xs text-text-secondary-light dark:text-text-secondary-dark">{days[i]}</Text>
            </View>
          ))}
          <View className="absolute bottom-6 left-0 right-0 h-[1px] bg-gray-200 dark:bg-gray-800 -z-10" />
        </View>
      </View>
    </View>
  );
};

export default function InsightsScreen() {
  const router = useRouter();
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
          <Header dateRange={weekDateRange} />
          
          <ScrollView 
            className="flex-1"
            contentContainerStyle={{ paddingBottom: 100 }}
            showsVerticalScrollIndicator={false}
          >
            <WeeklyReportCard isLocked={false} entriesNeeded={Math.max(0, 5 - weeklyStats.entriesCount)} />
            
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
                        <Text className="text-xs text-text-secondary-light mt-2">Analyzing journal...</Text>
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