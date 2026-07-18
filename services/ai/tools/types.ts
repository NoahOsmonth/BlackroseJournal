/**
 * Local tool-host types (MCP-like, device-executed).
 */

export interface ToolJsonSchema {
    type: 'object';
    properties?: Record<string, unknown>;
    required?: string[];
    additionalProperties?: boolean;
}

export interface ToolDefinition {
    name: string;
    description: string;
    parameters: ToolJsonSchema;
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
