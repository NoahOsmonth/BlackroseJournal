import { getToolHandler } from './registry';
import type { ToolCall, ToolResult } from './types';

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

export async function executeToolCall(call: ToolCall): Promise<ToolResult> {
    const handler = getToolHandler(call.name);
    if (!handler) {
        return {
            toolCallId: call.id,
            name: call.name,
            content: truncate(`Error: unknown tool "${call.name}".`),
            isError: true,
        };
    }

    try {
        const args = parseArgs(call.arguments);
        const content = await handler(args);
        return {
            toolCallId: call.id,
            name: call.name,
            content: truncate(content),
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

export async function executeToolCalls(calls: readonly ToolCall[]): Promise<ToolResult[]> {
    const results: ToolResult[] = [];
    for (const call of calls) {
        results.push(await executeToolCall(call));
    }
    return results;
}
