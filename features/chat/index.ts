/**
 * Chat feature module
 *
 * Public API for the chat feature. Import from here rather than deep paths.
 */

// Hooks
export { useChatOrchestration } from './hooks';
export type {
    ChatMode,
    ChatPersistOptions,
    UseChatOrchestrationOptions,
    UseChatOrchestrationReturn
} from './hooks';
export { useChatSessionFlush } from './hooks';
export type {
    ChatSessionFlushControls,
    ChatSessionFlushOptions
} from './hooks';
export { useResumeChatSession } from './hooks';
export type { ResumeChatSessionOptions } from './hooks';

// Types
export type { ChatState, Message, StreamingMessage } from './types';

// Flows
export { FLOWS, composeSystemPrompt, flowForCheckInType } from './flows';
export type {
    ChatFlow,
    ChatFlowContext,
    ChatFlowId,
    GuidedStage,
} from './flows/types';

