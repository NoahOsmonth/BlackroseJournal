import { useMemo } from 'react';
import { flowForCheckInType, type ChatFlow, type ChatFlowContext } from '@/features/chat';
import { useGoalsContext } from '@/hooks/goals/useGoalsContext';
import { useIdentityContext } from '@/hooks/memory/useIdentityContext';
import { useLocalMemoryContext } from '@/hooks/memory/useLocalMemoryContext';
import { useRecentDaysContext } from '@/hooks/memory/useRecentDaysContext';
import type { Persona } from '@/services/personas/personasStorage.types';
import type { IntentionCheckInType } from '@/services/intentions/intentionsStorage.types';

interface UseIntentionChatFlowContextOptions {
    activePersona: Persona | null | undefined;
    areaLabel?: string;
    intentionTitle?: string;
    intentionId?: string;
    memorySummary?: string;
    feedbackGuidance?: string;
    checkInType: IntentionCheckInType;
    isRefineMode: boolean;
}

interface UseIntentionChatFlowContextReturn {
    flow: ChatFlow;
    flowContext: ChatFlowContext;
    goalsContext: string | undefined;
    localMemoryContext: string | undefined;
    recentDaysContext: string | undefined;
}

/**
 * Shared prompt inputs for intention / morning / evening chat:
 * goals, local memory capsule, recent day digests, and the flow registry entry.
 */
export function useIntentionChatFlowContext({
    activePersona,
    areaLabel,
    intentionTitle,
    intentionId,
    memorySummary,
    feedbackGuidance,
    checkInType,
    isRefineMode,
}: UseIntentionChatFlowContextOptions): UseIntentionChatFlowContextReturn {
    const { goalsContext } = useGoalsContext({ intentionId });
    const { context: localMemoryContext } = useLocalMemoryContext({
        query: intentionTitle ?? memorySummary,
    });
    const { context: recentDaysContext } = useRecentDaysContext({ days: 3 });
    const { context: identityContext } = useIdentityContext();

    const flow = useMemo(
        () => (isRefineMode ? flowForCheckInType('intentionRefine') : flowForCheckInType(checkInType)),
        [checkInType, isRefineMode]
    );

    const flowContext = useMemo(
        (): ChatFlowContext => ({
            activePersona,
            areaLabel,
            intentionTitle,
            memorySummary,
            identityContext,
            localMemoryContext,
            recentDaysContext,
            goalsContext,
            feedbackGuidance,
        }),
        [
            activePersona,
            areaLabel,
            intentionTitle,
            memorySummary,
            identityContext,
            localMemoryContext,
            recentDaysContext,
            goalsContext,
            feedbackGuidance,
        ]
    );

    return {
        flow,
        flowContext,
        goalsContext,
        localMemoryContext,
        recentDaysContext,
    };
}
