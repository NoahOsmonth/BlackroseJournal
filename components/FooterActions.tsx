import React from 'react';
import { View, Text, Pressable } from 'react-native';

interface FooterActionsProps {
  onNewChat: () => void;
  disabled?: boolean;
}

export function FooterActions({ onNewChat, disabled = false }: FooterActionsProps) {
  return (
    <View className="bg-background-light dark:bg-background-dark border-t border-slate-100 dark:border-slate-800 pb-8 pt-4">
      {/* Action Buttons */}
      <View className="flex-row gap-3 px-4">
        <Pressable 
          className={`flex-1 py-3 px-4 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-sm active:opacity-80 ${disabled ? 'opacity-50' : ''}`}
          onPress={onNewChat}
          disabled={disabled}
        >
           <Text className="text-center font-bold text-user-text dark:text-slate-200 text-[15px]">New Chat</Text>
        </Pressable>
        <Pressable 
          className="flex-1 py-3 px-4 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-sm active:opacity-80"
          disabled={disabled}
        >
           <Text className="text-center font-bold text-user-text dark:text-slate-200 text-[15px]">Finish entry</Text>
        </Pressable>
      </View>
      
      {/* Home Indicator (Visual) */}
      <View className="items-center mt-6">
        <View className="w-32 h-1.5 bg-gray-200 dark:bg-slate-700 rounded-full" />
      </View>
    </View>
  );
}
