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
            <View className="flex-1 items-center justify-center bg-background-light dark:bg-background-dark px-6">
                <Text className="text-lg font-semibold text-text-primary-light dark:text-text-primary-dark">
                    Something went wrong
                </Text>
                <Text className="text-xs text-text-secondary-light dark:text-text-secondary-dark mt-2 text-center">
                    {error.message}
                </Text>
                <Pressable
                    onPress={this.handleReset}
                    accessibilityLabel="Try again"
                    className="mt-4 px-4 py-2 rounded-full bg-primary"
                >
                    <Text className="text-sm font-semibold text-white">Try again</Text>
                </Pressable>
            </View>
        );
    }
}
