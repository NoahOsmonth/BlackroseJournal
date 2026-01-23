import { useRouter } from 'expo-router';
import { useCallback } from 'react';

export type TabRoute = 'today' | 'explore' | 'entries' | 'insights' | 'settings';

export function useTabNavigation() {
    const router = useRouter();

    const goToTab = useCallback((tab: TabRoute) => {
        router.navigate(`/(tabs)/${tab}`);
    }, [router]);

    return {
        goToTab,
    };
}
