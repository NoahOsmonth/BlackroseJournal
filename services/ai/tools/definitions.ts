import type { OpenAiToolSpec, ToolDefinition } from './types';

export const HISTORY_TOOL_DEFINITIONS: ToolDefinition[] = [
    {
        name: 'get_clock',
        description:
            'Get the device local date and time. Use FIRST to resolve relative day phrases ("yesterday", "last Friday", "tonight") — never invent the date. Do not call it for timeless questions ("what is grief?"). No arguments.',
        parameters: {
            type: 'object',
            properties: {},
            additionalProperties: false,
        },
        execClass: 'pure',
    },
    {
        name: 'list_recent_days',
        description:
            'List recent journaling day digests (summaries, topics, session titles). Use to orient before loading a transcript; use order=oldest or from/to to reach older history without paging forever. Do NOT use for full text — fetch get_day next. Example args: {"days":7}.',
        parameters: {
            type: 'object',
            properties: {
                days: {
                    type: 'number',
                    description: 'How many active days to return (1–14, default 7).',
                },
                order: {
                    type: 'string',
                    enum: ['newest', 'oldest'],
                    description:
                        "Sort order. 'newest' (default) = most recent first; 'oldest' = earliest matching days first (use for 'first entry' / early history).",
                },
                from: {
                    type: 'string',
                    description: 'Optional start date YYYY-MM-DD inclusive.',
                },
                to: {
                    type: 'string',
                    description: 'Optional end date YYYY-MM-DD inclusive.',
                },
            },
            additionalProperties: false,
        },
        execClass: 'pure',
    },
    {
        name: 'get_day',
        description:
            'Get the digest for one calendar day: summary, topics, and session ids/titles. Use after list_recent_days when one day matters. Accepts YYYY-MM-DD, today, yesterday, or a weekday name. Do NOT use for full transcripts — pass an id from this digest to get_conversation. Example args: {"date":"yesterday"}.',
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
        execClass: 'pure',
    },
    {
        name: 'get_conversation',
        description:
            'Load the full transcript for one past session (journal entry or intention check-in). Use ONLY when you need exact prior words — prefer get_day first to discover ids. Do NOT use to browse; it returns the whole session. Example args: {"kind":"journal_entry","id":"<id from a day digest>"}.',
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
        execClass: 'pure',
    },
    {
        name: 'search_history',
        description:
            'Search day digests and local memory for a topic or keyword across days. Use for recurring themes ("what do I keep writing about work?"). Do NOT use for one known day (use get_day) or exact transcripts (use get_conversation). Example args: {"query":"work stress"}.',
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
        execClass: 'pure',
    },
    {
        name: 'recall_memory',
        description:
            'Query the long-term memory bank (Hindsight) for recollections relevant to a topic. Use for "remember when\u2026", feelings echoing an older pattern, or grounding across past months. Do NOT use for recent days — use get_day or list_recent_days. Example args: {"query":"argument that kept looping"}.',
        parameters: {
            type: 'object',
            properties: {
                query: { type: 'string', description: 'Topic or question to recall from long-term memory.' },
                limit: { type: 'number', description: 'Max recollections (1\u201310, default 6).' },
            },
            required: ['query'],
            additionalProperties: false,
        },
        execClass: 'pure',
    },
    {
        name: 'get_identity',
        description:
            'Read the on-device always-on identity profile (preferred name, pronouns, key people, durable facts). Use the injected Identity block when present; call this to re-check after an update. Do NOT call it to discover new facts about the user — ask them. No arguments.',
        parameters: {
            type: 'object',
            properties: {},
            additionalProperties: false,
        },
        execClass: 'pure',
    },
    {
        name: 'update_identity',
        description:
            'Persist durable identity facts the user clearly stated (preferred name, pronouns, about, key people, hard facts). Use ONLY when the user explicitly stated a fact — never infer or invent. Secondary to automatic extraction. Example args: {"preferredName":"Sam","pronouns":"they/them"}.',
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
        execClass: 'mutating',
    },
    {
        name: 'list_goals',
        description:
            'List the user\u2019s current goals and habits with status. Use before create_goal to avoid duplicates. Do NOT call it for journal-history questions. No arguments.',
        parameters: {
            type: 'object',
            properties: {},
            additionalProperties: false,
        },
        execClass: 'pure',
    },
    {
        name: 'create_goal',
        description:
            'Create a goal or habit ONLY when the user clearly asked to set/track one — never invent a goal the user did not state. Returns the created goal id. Example args: {"title":"Run 3x a week","type":"habit"}.',
        parameters: {
            type: 'object',
            properties: {
                title: {
                    type: 'string',
                    description: 'Goal or habit title.',
                },
                type: {
                    type: 'string',
                    enum: ['goal', 'habit'],
                    description: 'goal (default) or habit.',
                },
                dateKey: {
                    type: 'string',
                    description: 'Optional start date YYYY-MM-DD (default today).',
                },
            },
            required: ['title'],
            additionalProperties: false,
        },
        execClass: 'mutating',
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

/** PR8c-then-toolfix: decision-rule policy with a good/bad chain + STOP rules. Kept under 900 chars (prompt budget). */
export const HISTORY_TOOLS_POLICY = [
    '## On-device tools — use freely (proactive)',
    'Tools run on the phone — call freely when they improve care.',
    'Decision rule: get_clock (never invent time) → list_recent_days → get_day for one day → get_conversation for exact words only. search_history: themes; recall_memory: older-than-digest memory — be curious about it, a "remember when…" echo or thin digests — one call costs nothing.',
    'Good: "what did I write about work last week?" → get_clock, list_recent_days, get_day, get_conversation. Bad: answering from memory, narrating tool names.',
    'get_identity / update_identity: re-check or pin stated facts; never invent. list_goals/create_goal: explicit requests only; never invent goals.',
    'STOP: never invent results; empty → say so and answer from the live message. Never narrate tool names or fake tool syntax — structured tool_calls only. Use ## Identity name if present.',
].join('\n');
