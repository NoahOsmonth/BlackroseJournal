import { useSyncExternalStore } from 'react';
import {
    getActiveAccountId,
    subscribeActiveAccount,
} from '@/services/account/accountRuntime';

export function useActiveAccountId(): string | null {
    return useSyncExternalStore(
        subscribeActiveAccount,
        getActiveAccountId,
        getActiveAccountId,
    );
}
