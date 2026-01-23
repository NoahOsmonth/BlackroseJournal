import React from 'react';
import { Text, View } from 'react-native';

interface EmotionData {
  emotion: string;
  score: number; // 0-10
  emoji: string;
}

interface EmotionalLandscapeChartProps {
  data: EmotionData[];
  emojiStyle?: 'native' | 'minimal' | 'flat' | '3d'; // For future expansion
}

export function EmotionalLandscapeChart({ data, emojiStyle = 'native' }: EmotionalLandscapeChartProps) {
  const maxScore = 10;

  if (!data || data.length === 0) {
    return (
      <View className="h-32 w-full items-center justify-center">
        <Text className="text-text-secondary-light dark:text-text-secondary-dark text-sm">No emotional data yet</Text>
      </View>
    );
  }

  // Extract top emotions (those with scores > 0) for the tags
  const topEmotions = data.filter(item => item.score > 0).slice(0, 3);

  const renderEmoji = (emoji: string, hasScore: boolean) => {
    const opacityClass = hasScore ? 'opacity-80' : 'opacity-40';

    switch (emojiStyle) {
      case 'flat':
        return (
          <View className={`bg-gray-200 dark:bg-gray-700 rounded-full w-8 h-8 items-center justify-center ${opacityClass}`}>
            <Text className="text-lg">{emoji}</Text>
          </View>
        );
      case '3d':
        return (
          <Text className={`text-2xl shadow-lg scale-125 ${opacityClass}`} style={{ textShadowColor: 'rgba(0,0,0,0.3)', textShadowOffset: { width: 1, height: 1 }, textShadowRadius: 2 }}>
            {emoji}
          </Text>
        );
      case 'native':
      default:
        return (
          <Text className={`text-xl ${opacityClass}`}>
            {emoji}
          </Text>
        );
    }
  };

  return (
    <View>
      {/* Emotion tags at top */}
      {topEmotions.length > 0 && (
        <View className="flex-row flex-wrap gap-2 mb-6">
          {topEmotions.map((item, index) => (
            <View key={index} className="px-3 py-1 bg-gray-200 dark:bg-gray-800 rounded-full">
              <Text className="text-xs font-medium text-text-primary-light dark:text-text-primary-dark">{item.emotion}</Text>
            </View>
          ))}
        </View>
      )}

      {/* Chart */}
      <View className="relative h-32 w-full px-2">
        <View className="flex-row items-end justify-between h-full pt-4 pb-1">
          {data.map((item, index) => (
            <View key={index} className="flex-col items-center justify-end h-full flex-1 gap-2">
              <View
                className={`w-3 rounded-t-full ${item.score > 0 ? 'bg-gray-400 dark:bg-gray-300' : 'bg-gray-200 dark:bg-gray-800'}`}
                style={{ height: `${(item.score / maxScore) * 80}%` }} // Max 80% height to leave room
              />
              <View className="h-8 items-center justify-center" accessibilityLabel={item.emotion}>
                {renderEmoji(item.emoji, item.score > 0)}
              </View>
            </View>
          ))}
        </View>
        <View className="absolute bottom-9 left-0 right-0 h-[1px] bg-gray-200 dark:bg-gray-800 -z-10" />
      </View>
    </View>
  );
}
