import { View } from 'react-native';

import { Skeleton } from './Skeleton';

interface SkeletonTextProps {
    lines: number;
    lineClassName?: string;
    lastLineClassName?: string;
    className?: string;
    accessibilityLabel?: string;
}

/** A compact paragraph-shaped skeleton with a shorter final line. */
export function SkeletonText({
    lines,
    lineClassName = 'h-4',
    lastLineClassName = 'w-2/3',
    className = 'gap-2',
    accessibilityLabel = 'Loading',
}: SkeletonTextProps) {
    return (
        <View accessibilityLabel={accessibilityLabel} className={className}>
            {Array.from({ length: lines }, (_, index) => (
                <Skeleton
                    key={index}
                    className={`${lineClassName} ${index === lines - 1 ? lastLineClassName : 'w-full'}`}
                    accessibilityLabel={`${accessibilityLabel} line ${index + 1}`}
                />
            ))}
        </View>
    );
}
