import React from 'react';
import { Text, View } from 'react-native';
import { EmptyState } from '@/components/ui/EmptyState';

interface KeyThemesProps {
  themes: string[];
}

export function KeyThemes({ themes }: KeyThemesProps) {
  // The first theme is the main/primary theme, rest are secondary
  const mainTheme = themes && themes.length > 0 ? themes[0] : null;
  const secondaryThemes = themes && themes.length > 1 ? themes.slice(1) : [];

  return (
    <View className="bg-surface-light dark:bg-surface-dark rounded-2xl p-5 shadow-sm border border-gray-100 dark:border-gray-800 mb-4">
      <Text className="text-sm font-medium text-text-secondary-light dark:text-text-secondary-dark mb-4">Key Themes</Text>

      {!mainTheme ? (
        <EmptyState
          icon="local-florist"
          title="Themes need a few entries"
          message="Keep journaling and Rosebud will surface the patterns that repeat."
        />
      ) : (
        <>
          <Text className="text-2xl font-bold text-text-primary-light dark:text-text-primary-dark mb-4">{mainTheme}</Text>
          {secondaryThemes.length > 0 && (
            <View className="flex-row flex-wrap gap-2">
              {secondaryThemes.map((theme, index) => (
                <View key={index} className="px-3 py-1 bg-gray-200 dark:bg-gray-800 rounded-full">
                  <Text className="text-xs font-medium text-text-primary-light dark:text-text-primary-dark">{theme}</Text>
                </View>
              ))}
            </View>
          )}
        </>
      )}
    </View>
  );
}
