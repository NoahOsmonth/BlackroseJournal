import {
    getClockTool,
    getConversationTool,
    getDayTool,
    listRecentDaysTool,
    searchHistoryTool,
} from './historyTools';
import { recallMemoryToolHandler } from './hindsightTools';
import { getIdentityTool, updateIdentityTool } from './identityTools';
import { HISTORY_TOOL_DEFINITIONS } from './definitions';
import type { RegisteredTool, ToolDefinition, ToolHandler } from './types';

const handlers: Record<string, ToolHandler> = {
    get_clock: getClockTool,
    list_recent_days: listRecentDaysTool,
    get_day: getDayTool,
    get_conversation: getConversationTool,
    search_history: searchHistoryTool,
    recall_memory: recallMemoryToolHandler,
    get_identity: getIdentityTool,
    update_identity: updateIdentityTool,
};

export function getRegisteredTools(): RegisteredTool[] {
    return HISTORY_TOOL_DEFINITIONS.map((definition) => ({
        definition,
        handler: handlers[definition.name] ?? (async () => `Unknown tool: ${definition.name}`),
    }));
}

export function getToolDefinition(name: string): ToolDefinition | undefined {
    return HISTORY_TOOL_DEFINITIONS.find((d) => d.name === name);
}

export function getToolHandler(name: string): ToolHandler | undefined {
    return handlers[name];
}
