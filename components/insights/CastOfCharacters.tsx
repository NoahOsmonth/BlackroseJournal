import React from 'react';
import { View, Text } from 'react-native';

interface CastOfCharactersProps {
  characters: string[];
}

export function CastOfCharacters({ characters }: CastOfCharactersProps) {
  return (
    <View className="bg-surface-light dark:bg-surface-dark rounded-2xl p-5 shadow-sm border border-gray-100 dark:border-gray-800 min-h-[100px] mb-6">
      <Text className="font-semibold mb-2 text-text-primary-light dark:text-text-primary-dark">Cast of Characters</Text>
      
      {(!characters || characters.length === 0) ? (
        <View className="flex-grow flex items-center justify-center py-4">
          <Text className="text-text-secondary-light dark:text-text-secondary-dark text-sm">Not enough data</Text>
        </View>
      ) : (
        <View className="flex-row flex-wrap gap-2">
           {characters.map((char, index) => (
            <View key={index} className="px-3 py-1 bg-gray-100 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-lg">
              <Text className="text-xs text-text-primary-light dark:text-text-primary-dark">{char}</Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}
