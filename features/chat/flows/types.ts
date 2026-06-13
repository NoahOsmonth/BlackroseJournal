/**
 * ChatFlow descriptor types (WS2 keystone abstraction)
 *
 * A `ChatFlow` is a declarative description of one conversational surface
 * (freeform journal, daily check-in, morning/evening/intention guided chats).
 * The single engine `useChatOrchestration` consumes a flow to derive the
 * system prompt + opener, so persona/memory/feedback/tuning are woven in ONE
 * place instead of duplicated per screen.
 */

import type { DailyPrompt } from '@/constants/dailyPrompts';
import type { GenerationSettings } from '@/services/ai/generationSettings';
import type { Message } from '@/services/ai/chatTypes';
import type {
    IntentionArea,
    IntentionCheckInType,
} from '@/services/intentions/intentionsStorage.types';
import type { Persona } from '@/services/personas/personasStorage.types';

export type ChatFlowId =
    | 'freeform'
    | 'dailyCheckIn'
    | 'continue'
    | 'morning'
    | 'evening'
    | 'intention'
    | 'intentionRefine';

/**
 * Inputs available to a flow when it assembles its system prompt / opener.
 * Every field is optional so the same context shape works for all flows.
 */
export interface ChatFlowContext {
    /** Active persona — injected uniformly by `composeSystemPrompt` when present. */
    activePersona?: Persona | null;
    /** The bounded "Local Memory Capsule" string. */
    localMemoryContext?: string;
    /** The formatted active goals + habits block for AI context. */
    goalsContext?: string;
    /** AI feedback guidance derived from prior thumbs. */
    feedbackGuidance?: string;
    /** Intention life area (e.g. 'wellbeing'). */
    area?: IntentionArea;
    /** Human-readable life-area label (e.g. 'Wellbeing'). */
    areaLabel?: string;
    /** Title of the intention being worked on. */
    intentionTitle?: string;
    /** Check-in type for intention flows ('morning' | 'evening' | 'intention'). */
    checkInType?: IntentionCheckInType;
    /** Summary of the most recent related check-in. */
    memorySummary?: string;
    /** Daily-prompt payload for the `dailyCheckIn` flow. */
    dailyPrompt?: DailyPrompt;
    /**
    /** Per-flow generation settings available to tuning-aware flows. */
    generation?: GenerationSettings;
}

export interface GuidedStage {
    id: string;
    /** Injected into the system prompt to steer the AI through one step. */
    instruction: string;
    /** Heuristic: when is this stage satisfied (e.g., user gave a concrete answer). */
    isComplete?: (messages: Message[]) => boolean;
}

export interface ChatFlow {
    id: ChatFlowId;
    buildSystemPrompt(ctx: ChatFlowContext): string;
    /** Warm, contextual opener that replaces bare trigger text. */
    openingMessage?(ctx: ChatFlowContext): string;
    /** Optional multi-turn scaffold (used by new-intention setting in WS5). */
    stages?: GuidedStage[];
    /**
     * Per-flow generation tweak (e.g., evening reflection slightly warmer).
     */
    generationOverride?(ctx: ChatFlowContext): Partial<GenerationSettings>;
}
