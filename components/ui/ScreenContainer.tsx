import React from 'react';
import { View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

interface ScreenContainerProps {
    children: React.ReactNode;
    /** 'all' for screens without a floating nav (chat, detail); 'top' when BottomNav handles bottom inset. */
    edges?: 'all' | 'top';
    /** Adds the standard horizontal gutter to the inner column. */
    padded?: boolean;
    className?: string;
}

export function ScreenContainer({
    children, edges = 'all', padded = false, className = '',
}: ScreenContainerProps) {
    const edgeProp = edges === 'all' ? (['top', 'bottom'] as const) : (['top'] as const);
    return (
        <SafeAreaView
            className="flex-1 bg-background-light dark:bg-background-dark"
            edges={edgeProp}
        >
            <View className={`flex-1 max-w-md mx-auto w-full ${padded ? 'px-5' : ''} ${className}`}>
                {children}
            </View>
        </SafeAreaView>
    );
}
