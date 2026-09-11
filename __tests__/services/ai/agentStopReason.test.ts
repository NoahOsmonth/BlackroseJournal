/**
 * Provider stop-reason mapping (Pi: stop ≠ tool_use ≠ length).
 * Pure function table — this is what stops truncated tool calls from running.
 */
import {
    isStop,
    normalizeStopReason,
    resolveFinishReason,
    resolveStopMapping,
} from '../../../services/ai/agentStopReason';

describe('normalizeStopReason', () => {
    it('maps the OpenAI tool-call family to tool_use', () => {
        expect(normalizeStopReason('tool_calls')).toBe('tool_use');
        expect(normalizeStopReason('tool_use')).toBe('tool_use');
        expect(normalizeStopReason('TOOL_CALLS')).toBe('tool_use');
        expect(normalizeStopReason('function_call')).toBe('tool_use');
    });

    it('maps truncation aliases to length', () => {
        expect(normalizeStopReason('length')).toBe('length');
        expect(normalizeStopReason('max_tokens')).toBe('length');
        expect(normalizeStopReason('MAX_OUTPUT_TOKENS')).toBe('length');
    });

    it('treats unknown shapes as unknown rather than guessing a stop', () => {
        expect(normalizeStopReason(undefined)).toBe('unknown');
        expect(normalizeStopReason(null)).toBe('unknown');
        expect(normalizeStopReason('')).toBe('unknown');
        expect(normalizeStopReason('weird_gateway_value')).toBe('unknown');
    });

    it('only stop is a clean stop', () => {
        expect(isStop('stop')).toBe(true);
        expect(isStop('length')).toBe(false);
        expect(isStop('tool_use')).toBe(false);
        expect(isStop('unknown')).toBe(false);
    });
});

describe('resolveStopMapping', () => {
    it('executes tool calls only when the stop reason agrees', () => {
        expect(resolveStopMapping('tool_use', 2)).toBe('execute_tools');
    });

    it('never executes truncated tool calls (arguments are cut mid-JSON)', () => {
        expect(resolveStopMapping('length', 1)).toBe('truncated_tools');
        expect(resolveStopMapping('length', 3)).toBe('truncated_tools');
    });

    it('treats a tool-use claim with zero parsed calls as a nudge, not a finish', () => {
        expect(resolveStopMapping('tool_use', 0)).toBe('tooluse_no_calls');
    });

    it('finalizes on a plain stop with no calls', () => {
        expect(resolveStopMapping('stop', 0)).toBe('finalize');
    });

    it('finalizes truncated prose (no tool calls) as an answer', () => {
        expect(resolveStopMapping('length', 0)).toBe('finalize');
    });

    it('aborts on content filter', () => {
        expect(resolveStopMapping('content_filter', 0)).toBe('abort');
    });
});

describe('resolveFinishReason', () => {
    it('reads OpenAI finish_reason', () => {
        expect(resolveFinishReason({ choices: [{ finish_reason: 'tool_calls' }] })).toBe('tool_use');
    });

    it('reads Anthropic-style stop_reason at the top level', () => {
        expect(resolveFinishReason({ stop_reason: 'max_tokens' })).toBe('length');
    });

    it('falls back to unknown for a malformed payload', () => {
        expect(resolveFinishReason(null)).toBe('unknown');
        expect(resolveFinishReason({ choices: [] })).toBe('unknown');
        expect(resolveFinishReason({ choices: [{ message: {} }] })).toBe('unknown');
    });
});
