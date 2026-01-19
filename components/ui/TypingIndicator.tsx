import React, { useEffect, useState } from 'react';
import { Text, View } from 'react-native';

interface TypingIndicatorProps {
    colorClassName?: string;
    sizeClassName?: string;
}

const DOTS = [0, 1, 2];

export function TypingIndicator({
    colorClassName = 'text-text-secondary-light dark:text-text-secondary-dark',
    sizeClassName = 'text-base',
}: TypingIndicatorProps) {
    const [visibleDots, setVisibleDots] = useState(1);

    useEffect(() => {
        const interval = setInterval(() => {
            setVisibleDots((prev) => (prev >= 3 ? 1 : prev + 1));
        }, 450);

        return () => clearInterval(interval);
    }, []);

    return (
        <View
            accessibilityLabel="AI typing indicator"
            accessibilityRole="text"
            className="flex-row items-center gap-1"
        >
            {DOTS.map((dot) => (
                <Text
                    key={dot}
                    className={`${colorClassName} ${sizeClassName}`}
                    style={{ opacity: dot < visibleDots ? 1 : 0.25 }}
                >
                    •
                </Text>
            ))}
        </View>
    );
}
