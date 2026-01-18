/**
 * Chat feature module
 * 
 * Public API for the chat feature. Import from here rather than deep paths.
 */

// Hooks
export { useChatOrchestration } from './hooks';
export type {
    UseChatOrchestrationOptions,
    UseChatOrchestrationReturn
} from './hooks';

// Types
export type { ChatState, Message, StreamingMessage } from './types';

