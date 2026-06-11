import React, { useEffect, useState } from 'react';
import { View } from 'react-native';

interface TypingIndicatorProps {
    colorClassName?: string;
    sizeClassName?: string;
}

const DOTS = [0, 1, 2];

function toBackgroundClass(colorClassName: string): string {
    return colorClassName
        .split(/\s+/)
        .map((name) => name.replace(/^text-/, 'bg-').replace(/^dark:text-/, 'dark:bg-'))
        .join(' ');
}

export function TypingIndicator({
    colorClassName = 'text-text-secondary-light dark:text-text-secondary-dark',
    sizeClassName = 'text-base',
}: TypingIndicatorProps) {
    const [visibleDots, setVisibleDots] = useState(1);
    const dotColorClassName = toBackgroundClass(colorClassName);
    const dotSizeClassName = sizeClassName.includes('sm') ? 'h-1.5 w-1.5' : 'h-2 w-2';

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
                <View
                    key={dot}
                    className={`${dotColorClassName} ${dotSizeClassName} rounded-full`}
                    style={{ opacity: dot < visibleDots ? 1 : 0.25 }}
                />
            ))}
        </View>
    );
}
