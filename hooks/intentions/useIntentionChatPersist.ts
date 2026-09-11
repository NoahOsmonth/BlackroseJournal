import { useMemo } from 'react';

import type { ChatSessionMode } from '@/services/ai/sessionStorage';
import type { IntentionCheckInType } from '@/services/intentions/intentionsStorage.types';

interface UseIntentionChatPersistOptions {
    readonly conversationId: string;
    readonly checkInType: IntentionCheckInType;
    readonly personaId?: string;
    readonly intentionId?: string;
    readonly areaParam?: string;
    readonly typeParam?: string;
    readonly modeParam?: string;
}

const MODE_BY_CHECK_IN: Record<IntentionCheckInType, ChatSessionMode> = {
    morning: 'morning',
    evening: 'evening',
    intention: 'intention',
};

/**
 * Session autosave wiring for a check-in conversation: the storage mode, the
 * route params needed to reopen the sitting, and the persist descriptor the
 * orchestration hook writes through.
 */
export function useIntentionChatPersist({
    conversationId,
    checkInType,
    personaId,
    intentionId,
    areaParam,
    typeParam,
    modeParam,
}: UseIntentionChatPersistOptions) {
    const checkInMode: ChatSessionMode = MODE_BY_CHECK_IN[checkInType] ?? 'intention';

    const persistRouteParams = useMemo(() => {
        const routeParams: Record<string, string> = {};
        if (intentionId) routeParams.intentionId = intentionId;
        if (areaParam) routeParams.area = areaParam;
        if (typeParam) routeParams.type = typeParam;
        if (modeParam) routeParams.mode = modeParam;
        return Object.keys(routeParams).length > 0 ? routeParams : undefined;
    }, [areaParam, intentionId, modeParam, typeParam]);

    const persist = useMemo(
        () => ({
            conversationId,
            mode: checkInMode,
            personaId,
            routeParams: persistRouteParams,
        }),
        [conversationId, checkInMode, personaId, persistRouteParams]
    );

    return { checkInMode, persistRouteParams, persist };
}
