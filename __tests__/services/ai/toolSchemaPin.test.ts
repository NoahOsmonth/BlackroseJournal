/**
 * PR8c: six tool schemas OTHER than list_recent_days stay byte-identical.
 * list_recent_days may gain optional order/from/to — nothing else may drift.
 */

import {
    HISTORY_TOOL_DEFINITIONS,
    toOpenAiToolSpecs,
} from '../../../services/ai/tools';

/** Frozen OpenAI tool specs for every history tool except list_recent_days. */
const PINNED_OTHER_TOOLS_JSON = JSON.stringify([
    {
        type: 'function',
        function: {
            name: 'get_clock',
            description: 'Return the device local date and time. Use to resolve relative day phrases.',
            parameters: {
                type: 'object',
                properties: {},
                additionalProperties: false,
            },
        },
    },
    {
        type: 'function',
        function: {
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
    },
    {
        type: 'function',
        function: {
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
    },
    {
        type: 'function',
        function: {
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
    },
    {
        type: 'function',
        function: {
            name: 'get_identity',
            description:
                'Read the on-device always-on identity profile (preferred name, pronouns, key people, durable facts). Prefer the injected Identity block when present; call this if you need to re-check after an update.',
            parameters: {
                type: 'object',
                properties: {},
                additionalProperties: false,
            },
        },
    },
    {
        type: 'function',
        function: {
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
    },
]);

describe('PR8c tool schema pin (other than list_recent_days)', () => {
    it('six non-list_recent_days tools are byte-identical to the pin', () => {
        const others = toOpenAiToolSpecs(
            HISTORY_TOOL_DEFINITIONS.filter((d) => d.name !== 'list_recent_days')
        );
        expect(JSON.stringify(others)).toBe(PINNED_OTHER_TOOLS_JSON);
    });

    it('list_recent_days exposes optional order, from, to (backward compatible)', () => {
        const def = HISTORY_TOOL_DEFINITIONS.find((d) => d.name === 'list_recent_days');
        expect(def).toBeDefined();
        const props = def!.parameters.properties as Record<string, unknown>;
        expect(props.days).toBeDefined();
        expect(props.order).toEqual(
            expect.objectContaining({
                type: 'string',
                enum: ['newest', 'oldest'],
            })
        );
        expect(props.from).toEqual(expect.objectContaining({ type: 'string' }));
        expect(props.to).toEqual(expect.objectContaining({ type: 'string' }));
        // Still no required fields (all optional → old clients keep working).
        expect(def!.parameters.required).toBeUndefined();
    });

    it('registry still exposes exactly 7 history tools', () => {
        expect(HISTORY_TOOL_DEFINITIONS.map((d) => d.name)).toEqual([
            'get_clock',
            'list_recent_days',
            'get_day',
            'get_conversation',
            'search_history',
            'get_identity',
            'update_identity',
        ]);
    });
});
