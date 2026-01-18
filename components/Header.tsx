import { MaterialIcons } from '@expo/vector-icons';
import React from 'react';
import { Pressable, Text, View } from 'react-native';

interface HeaderProps {
  onClose?: () => void;
  onDraftsPress?: () => void;
}

export function Header({ onClose, onDraftsPress }: HeaderProps) {
  return (
    <View className="pt-4 px-4 pb-2 bg-background-light dark:bg-background-dark z-10 border-b border-transparent">
      <View className="flex-row items-center justify-between">
        {/* Pill */}
        <View className="flex-row items-center space-x-1.5 bg-white dark:bg-slate-800 px-3 py-1.5 rounded-full border border-slate-200 dark:border-slate-700 shadow-sm gap-1.5">
          <View className="w-5 h-5 bg-primary rounded-full items-center justify-center">
            <Text className="text-[10px] text-white font-bold leading-none mt-[1px]">B</Text>
          </View>
          <Text className="text-sm font-serif text-user-text dark:text-slate-200">Blackrose</Text>
          <MaterialIcons name="expand-more" size={18} className="text-slate-400" color="#94a3b8" />
        </View>

        {/* Right Actions */}
        <View className="flex-row items-center space-x-4 gap-4">
          <Pressable onPress={onDraftsPress}>
            <Text className="text-[15px] font-serif text-user-text dark:text-slate-300">Drafts</Text>
          </Pressable>
          <Pressable
            onPress={onClose}
            className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full"
          >
            <MaterialIcons name="close" size={22} className="text-slate-500 dark:text-slate-400" color="#64748b" />
          </Pressable>
        </View>
      </View>

      {/* "Internal Family Systems" label removed as per requirements */}
    </View>
  );
}

