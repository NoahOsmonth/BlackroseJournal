import { getToolHandler } from './registry';
import type { ToolCall, ToolResult } from './types';

/** Default wall-clock deadline for a single tool execution (Task 9). */
export const TOOL_EXEC_TIMEOUT_MS = 10_000;

const MAX_RESULT_CHARS = 12_000;

function truncate(text: string): string {
    if (text.length <= MAX_RESULT_CHARS) return text;
    return `${text.slice(0, MAX_RESULT_CHARS)}\n…(truncated)`;
}

function parseArgs(raw: string): Record<string, unknown> {
    if (!raw || !raw.trim()) return {};
    try {
        const parsed: unknown = JSON.parse(raw);
        if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) {
            return parsed as Record<string, unknown>;
        }
        return {};
    } catch {
        return { _raw: raw };
    }
}

/**
 * Race a handler promise against a wall-clock deadline. Never rejects: the
 * resolved value is either the handler's content or a marker string for
 * timeout/failure, which the caller marks isError (Task 9).
 */
function withTimeout(
    promise: Promise<string>,
    name: string,
    timeoutMs: number
): Promise<string> {
    return new Promise((resolve) => {
        const timer = setTimeout(() => {
            resolve(`[tool:${name}] timed out after ${timeoutMs}ms`);
        }, timeoutMs);
        promise.then(
            (value) => {
                clearTimeout(timer);
                resolve(value);
            },
            (error) => {
                clearTimeout(timer);
                resolve(`[tool:${name}] failed: ${String(error)}`);
            }
        );
    });
}

export async function executeToolCall(
    call: ToolCall,
    opts: { timeoutMs?: number } = {}
): Promise<ToolResult> {
    const handler = getToolHandler(call.name);
    if (!handler) {
        return {
            toolCallId: call.id,
            name: call.name,
            content: truncate(`Error: unknown tool "${call.name}".`),
            isError: true,
        };
    }

    const timeoutMs = opts.timeoutMs ?? TOOL_EXEC_TIMEOUT_MS;
    try {
        const args = parseArgs(call.arguments);
        const content = await withTimeout(handler(args), call.name, timeoutMs);
        const isError = content.startsWith(`[tool:${call.name}]`);
        return {
            toolCallId: call.id,
            name: call.name,
            content: truncate(content),
            ...(isError ? { isError: true } : {}),
        };
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Tool execution failed';
        return {
            toolCallId: call.id,
            name: call.name,
            content: truncate(`Error: ${message}`),
            isError: true,
        };
    }
}

export async function executeToolCalls(
    calls: readonly ToolCall[],
    opts: { timeoutMs?: number } = {}
): Promise<ToolResult[]> {
    const results: ToolResult[] = [];
    for (const call of calls) {
        results.push(await executeToolCall(call, opts));
    }
    return results;
}
