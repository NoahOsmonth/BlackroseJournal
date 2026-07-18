import type { OpenAiToolSpec, ToolDefinition } from './types';

export const HISTORY_TOOL_DEFINITIONS: ToolDefinition[] = [
    {
        name: 'get_clock',
        description: 'Return the device local date and time. Use to resolve relative day phrases.',
        parameters: {
            type: 'object',
            properties: {},
            additionalProperties: false,
        },
    },
    {
        name: 'list_recent_days',
        description:
            'List recent journaling day digests (summaries + topics + session titles). Prefer this before loading full conversations.',
        parameters: {
            type: 'object',
            properties: {
                days: {
                    type: 'number',
                    description: 'How many recent active days to return (1–14, default 7).',
                },
            },
            additionalProperties: false,
        },
    },
    {
        name: 'get_day',
        description:
            'Get the digest for one calendar day: summary, topics, and session ids/titles. Accepts YYYY-MM-DD, today, yesterday, or a weekday name.',
        parameters: {
            type: 'object',
            properties: {
                date: {
                    type: 'string',
                    description: 'Day reference: YYYY-MM-DD, today, yesterday, monday, last friday, etc.',
                },
            },
            required: ['date'],
            additionalProperties: false,
        },
    },
    {
        name: 'get_conversation',
        description:
            'Load the full transcript for one past session (journal entry or intention check-in). Prefer get_day first to discover ids.',
        parameters: {
            type: 'object',
            properties: {
                kind: {
                    type: 'string',
                    enum: ['journal_entry', 'intention_checkin'],
                    description: 'Source kind.',
                },
                id: {
                    type: 'string',
                    description: 'Entry or check-in id from a day digest.',
                },
                date: {
                    type: 'string',
                    description: 'Optional day key if resolving by title instead of id.',
                },
                titleQuery: {
                    type: 'string',
                    description: 'Optional title substring to find a session on that day.',
                },
            },
            additionalProperties: false,
        },
    },
    {
        name: 'search_history',
        description:
            'Search day digests and local memory for a topic or keyword, optionally within a date range.',
        parameters: {
            type: 'object',
            properties: {
                query: { type: 'string', description: 'Search terms.' },
                from: { type: 'string', description: 'Start date YYYY-MM-DD inclusive.' },
                to: { type: 'string', description: 'End date YYYY-MM-DD inclusive.' },
                limit: { type: 'number', description: 'Max hits (default 6).' },
            },
            required: ['query'],
            additionalProperties: false,
        },
    },
    {
        name: 'get_identity',
        description:
            'Read the on-device always-on identity profile (preferred name, pronouns, key people, durable facts). Prefer the injected Identity block when present; call this if you need to re-check after an update.',
        parameters: {
            type: 'object',
            properties: {},
            additionalProperties: false,
        },
    },
    {
        name: 'update_identity',
        description:
            'Persist durable identity facts the user clearly stated (preferred name, pronouns, about, key people, hard facts). Secondary to automatic extraction — use when you are sure and want an immediate pin. Do not invent.',
        parameters: {
            type: 'object',
            properties: {
                preferredName: {
                    type: 'string',
                    description: 'What the user wants to be called.',
                },
                name: {
                    type: 'string',
                    description: 'Alias for preferredName.',
                },
                pronouns: {
                    type: 'string',
                    description: 'e.g. she/her, he/him, they/them.',
                },
                about: {
                    type: 'string',
                    description: 'Short self-description (job, life stage).',
                },
                keyPeople: {
                    type: 'array',
                    description: 'People in their life.',
                    items: {
                        type: 'object',
                        properties: {
                            name: { type: 'string' },
                            relation: { type: 'string' },
                        },
                    },
                },
                facts: {
                    type: 'array',
                    description: 'Durable preferences or facts as short strings.',
                    items: { type: 'string' },
                },
                reason: {
                    type: 'string',
                    description: 'Why this update (for audit).',
                },
            },
            additionalProperties: false,
        },
    },
];

export function toOpenAiToolSpecs(definitions: readonly ToolDefinition[] = HISTORY_TOOL_DEFINITIONS): OpenAiToolSpec[] {
    return definitions.map((def) => ({
        type: 'function' as const,
        function: {
            name: def.name,
            description: def.description,
            parameters: def.parameters,
        },
    }));
}

/** PR8b-1: tight tools policy (was ~1.9k chars). Proactive stance kept. */
export const HISTORY_TOOLS_POLICY = [
    '## On-device tools — use freely (proactive)',
    'Tools run on the phone. Call when they improve care — do not wait for "search my history."',
    'get_clock: liberally; never invent local time. list_recent_days: orient. get_day: before full transcript. get_conversation: exact prior words. search_history: themes. get_identity / update_identity: re-check or pin; never invent.',
    'Chain when useful. Never invent results. If empty, say so and stay with the live message. Do not narrate tool names. Structured tool_calls only — never fake tool syntax in the reply. Use ## Identity name if present; never invent one.',
].join('\n');
