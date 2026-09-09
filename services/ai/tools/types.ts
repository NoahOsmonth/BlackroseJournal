/**
 * Local tool-host types (MCP-like, device-executed).
 */

export interface ToolJsonSchema {
    type: 'object';
    properties?: Record<string, unknown>;
    required?: string[];
    additionalProperties?: boolean;
}

/**
 * Execution class for parallel-batch scheduling (2026 multigrid discipline):
 * - `pure`: side-effect-free reads (clock, digests, memory reads) — safe to
 *   run concurrently with anything, including each other.
 * - `reads-mutable`: reads state that other writers could mutate
 *   mid-flight; safe to run concurrently with pure calls only.
 * - `mutating`: writes device state (identity pins, goal creation) — at most
 *   ONE may run per tool step; extras are REFUSED with a re-request note.
 * Unknown/missing classes are treated as `mutating` (fail safe).
 */
export type ToolExecClass = 'pure' | 'reads-mutable' | 'mutating';

export interface ToolDefinition {
    name: string;
    description: string;
    parameters: ToolJsonSchema;
    execClass: ToolExecClass;
}

/** OpenAI-compatible tools array entry. */
export interface OpenAiToolSpec {
    type: 'function';
    function: {
        name: string;
        description: string;
        parameters: ToolJsonSchema;
    };
}

export interface ToolCall {
    id: string;
    name: string;
    arguments: string;
}

export interface ToolResult {
    toolCallId: string;
    name: string;
    content: string;
    isError?: boolean;
    /**
     * True when the call was REFUSED by the executor (e.g. a second mutating
     * tool in the same step) and never ran. The model may re-request it alone.
     */
    refused?: boolean;
}

export type ToolHandler = (args: Record<string, unknown>) => Promise<string>;

export interface RegisteredTool {
    definition: ToolDefinition;
    handler: ToolHandler;
}

/** Wire message shapes used by the agent loop (includes tool roles). */
export type AgentMessageRole = 'system' | 'user' | 'assistant' | 'tool';

export interface AgentMessage {
    role: AgentMessageRole;
    content: string | null;
    tool_calls?: {
        id: string;
        type: 'function';
        function: { name: string; arguments: string };
    }[];
    tool_call_id?: string;
    name?: string;
}
