import { createContext, useContext, useEffect, useMemo, type PropsWithChildren } from 'react';
import {
    Easing,
    useReducedMotion,
    useSharedValue,
    withRepeat,
    withTiming,
    type SharedValue,
} from 'react-native-reanimated';

export const SkeletonAnimationContext = createContext<SharedValue<number> | null>(null);

/** Shares one shimmer driver across skeletons mounted beneath it. */
export function SkeletonProvider({ children }: PropsWithChildren) {
    const progress = useSharedValue(0);
    const reduceMotion = useReducedMotion();

    useEffect(() => {
        if (reduceMotion) {
            progress.value = 0;
            return;
        }

        progress.value = withRepeat(
            withTiming(1, {
                duration: 1200,
                easing: Easing.inOut(Easing.ease),
            }),
            -1,
            false
        );

        return () => {
            progress.value = 0;
        };
    }, [progress, reduceMotion]);

    const value = useMemo(() => progress, [progress]);

    return (
        <SkeletonAnimationContext.Provider value={value}>
            {children}
        </SkeletonAnimationContext.Provider>
    );
}

export function useSkeletonProgress() {
    return useContext(SkeletonAnimationContext);
}
