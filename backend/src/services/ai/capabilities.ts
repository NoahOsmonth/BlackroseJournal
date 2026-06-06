/**
 * PR3 — Capabilities descriptor for an AI provider.
 *
 * Describes the *shape* of an adapter's wire protocol: whether it streams,
 * where it puts reasoning tokens, what auth header style it uses, and what
 * SSE envelope it speaks. The Provider picks a default; adapters can
 * override.
 */
export type ReasoningField = 'reasoning' | 'reasoning_content';

export interface Capabilities {
    streaming: true;
    reasoning: boolean;
    reasoningField: ReasoningField | null;
    sseFormat: 'openai';
    authHeaderStyle: 'bearer';
}

export const OPENAI_COMPAT_DEFAULT_CAPABILITIES: Capabilities = {
    streaming: true,
    reasoning: true,
    reasoningField: 'reasoning_content',
    sseFormat: 'openai',
    authHeaderStyle: 'bearer',
};
