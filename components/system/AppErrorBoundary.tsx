import React from 'react';
import { Pressable, Text, View } from 'react-native';

interface AppErrorBoundaryProps {
    children: React.ReactNode;
}

interface AppErrorBoundaryState {
    error: Error | null;
}

export class AppErrorBoundary extends React.Component<
    AppErrorBoundaryProps,
    AppErrorBoundaryState
> {
    state: AppErrorBoundaryState = {
        error: null,
    };

    static getDerivedStateFromError(error: Error): AppErrorBoundaryState {
        return { error };
    }

    componentDidCatch(error: Error) {
        console.error('AppErrorBoundary caught an error:', error);
    }

    handleReset = () => {
        this.setState({ error: null });
    };

    render() {
        const { error } = this.state;
        if (!error) {
            return this.props.children;
        }

        return (
            <View className="flex-1 items-center justify-center bg-background-light px-6 dark:bg-background-dark">
                <Text
                    className="text-[26px] leading-[34px] text-text-light dark:text-text-dark"
                    style={{ fontFamily: 'PlayfairDisplayRegular' }}
                >
                    Something went wrong
                </Text>
                <Text className="mt-3 text-center text-[15px] leading-[23px] text-text-secondary-light dark:text-text-secondary-dark">
                    {error.message}
                </Text>
                <Pressable
                    onPress={this.handleReset}
                    accessibilityLabel="Try again"
                    accessibilityRole="button"
                    className="mt-6 min-h-12 items-center justify-center rounded-control border border-bone-light px-6 dark:border-bone-dark"
                >
                    <Text className="text-[16px] text-text-light dark:text-text-dark">Try again</Text>
                </Pressable>
            </View>
        );
    }
}
