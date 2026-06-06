/**
 * PR3 — Public API barrel for the AI provider layer.
 *
 * Exposes the Provider interface, the ResolvedProfile shape, the factory
 * function, and the Capabilities descriptor. Adapter files are NOT
 * re-exported directly — callers go through `getProviderForProfile`.
 */
export type {
    ChatMessage,
    ChatRequest,
    ChatResponse,
    Provider,
    ProfileName,
    ResolvedProfile,
} from './provider';
export { getProviderForProfile, loadConfig } from './provider';
export type { Capabilities, ReasoningField } from './capabilities';
export { OPENAI_COMPAT_DEFAULT_CAPABILITIES } from './capabilities';
export { withRetry } from './retry';
export { redactSecrets } from './redactSecrets';
export { extractReasoning } from './extractors';
export {
    parseSseLine,
    parseSseStream,
    readAssistantContentFromSseStream,
    splitStreamBuffer,
} from './streaming';
export type { ParsedSseChunk, ParseSseStreamCallbacks } from './streaming';
