import { View } from 'react-native';

import { Skeleton } from '@/components/ui/Skeleton';

/** Mirrors the loading fields of app/intentions/edit.tsx. */
export function IntentionFormSkeleton() {
    return (
        <View className="flex-1 gap-5 px-6 py-8" accessibilityLabel="Loading intention">
            <SkeletonField label="Loading intention title" inputClassName="h-12 w-full rounded-xl" />
            <SkeletonField label="Loading intention description" inputClassName="h-24 w-full rounded-xl" />
            <SkeletonField label="Loading intention area" inputClassName="h-10 w-32 rounded-full" />
        </View>
    );
}

function SkeletonField({ label, inputClassName }: { label: string; inputClassName: string }) {
    return (
        <View className="gap-2">
            <Skeleton className="h-3 w-20" accessibilityLabel={`${label} label`} />
            <Skeleton className={inputClassName} accessibilityLabel={label} />
        </View>
    );
}
