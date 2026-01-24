import { useRouter } from 'expo-router';
import { useCallback } from 'react';

export function useHeaderActions() {
    const router = useRouter();

    const openSettings = useCallback(() => {
        router.navigate('/(tabs)/settings');
    }, [router]);

    const openStreakView = useCallback(() => {
        router.push('/streak-view');
    }, [router]);

    const openRewards = useCallback(() => {
        router.push('/rewards');
    }, [router]);

    return {
        openStreakView,
        openSettings,
        openRewards,
    };
}
