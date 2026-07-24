import { View } from 'react-native';

import { Skeleton } from '@/components/ui/Skeleton';

/** Mirrors the form fields produced by app/persona/generate.tsx. */
export function PersonaGenerateSkeleton() {
    return (
        <View className="flex-1 gap-5 px-6 py-8" accessibilityLabel="Crafting persona">
            <View className="items-center">
                <Skeleton className="h-20 w-20 rounded-full" accessibilityLabel="Loading persona avatar" />
            </View>
            <SkeletonField label="Loading persona name" inputClassName="h-12 w-full rounded-xl" />
            <SkeletonField label="Loading persona tagline" inputClassName="h-12 w-full rounded-xl" />
            <SkeletonField label="Loading persona voice" inputClassName="h-12 w-full rounded-xl" />
            <SkeletonField label="Loading persona prompt" inputClassName="h-24 w-full rounded-xl" />
        </View>
    );
}

function SkeletonField({ label, inputClassName }: { label: string; inputClassName: string }) {
    return (
        <View className="gap-2">
            <Skeleton className="h-3 w-16" accessibilityLabel={`${label} label`} />
            <Skeleton className={inputClassName} accessibilityLabel={label} />
        </View>
    );
}
