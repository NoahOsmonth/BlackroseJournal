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

export const HISTORY_TOOLS_POLICY = [
    '## On-device tools — use freely (proactive)',
    'These tools run on the user\'s phone. Call them whenever they make you a better companion — do NOT wait for "search my history" or "what time is it."',
    '',
    '### get_clock',
    'Call liberally: first messages, rants, spirals, celebrations, wind-downs, anything time-of-day sensitive. Night confessions ≠ noon updates. Never invent local time.',
    '',
    '### list_recent_days',
    'Orient yourself early. Use when they say things have been "like this for a while," or when a theme might be multi-day.',
    '',
    '### get_day',
    'Target a day: today, yesterday, last Friday, YYYY-MM-DD. Prefer this before loading a full transcript.',
    '',
    '### get_conversation',
    'Full session transcript when digests are not enough or they want exact prior words. Respond as a companion, not a quote dump.',
    '',
    '### search_history',
    'Theme / keyword search across digests + memory (sleep, work, a name, anxiety). Use when checking if a motif is recurring.',
    '',
    '### get_identity',
    'Read the always-on identity profile if you need to re-check name/pronouns/people. Usually already injected as "## Identity".',
    '',
    '### update_identity',
    'Pin durable identity the user clearly stated (preferred name, pronouns, key people, hard facts). Automatic extraction also runs on-device — still call this when they correct a name or you want an immediate save. Never invent.',
    '',
    '### Rules',
    '1. Chain tools when useful (clock → recent days → get_day → conversation).',
    '2. Never invent tool results or past sessions.',
    '3. If empty, say you do not have that day on device and stay with the live message.',
    '4. Do not narrate tool names to the user; weave facts naturally ("It\'s late where you are...").',
    '5. Use the provider tool-calling API only (structured tool_calls). Never write function code, XML tags, JSON tool stubs, or ``` fences that look like get_day(...) in your visible reply.',
    '6. If ## Identity lists a preferred name, use it. If unknown, do not invent one.',
].join('\n');
