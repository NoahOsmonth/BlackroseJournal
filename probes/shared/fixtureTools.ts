/**
 * E2 tool runtime — script executes against the fixture; model only decides.
 */

import {
    buildProbeFixture,
    getEntryById,
    listJournals,
    searchJournalsKeyword,
    type ProbeFixture,
} from './fixture';

export const PROBE_TOOL_SPECS = [
    {
        type: 'function' as const,
        function: {
            name: 'search_journals',
            description:
                'Search journal entries by keyword. Returns top-5 matches with id, date, title, snippet. Note: simple keyword scoring only.',
            parameters: {
                type: 'object',
                properties: {
                    query: { type: 'string', description: 'Search query terms.' },
                },
                required: ['query'],
                additionalProperties: false,
            },
        },
    },
    {
        type: 'function' as const,
        function: {
            name: 'list_journals',
            description:
                'List journal entries newest-first with pagination. Use cursor from previous nextCursor. Default limit 10.',
            parameters: {
                type: 'object',
                properties: {
                    cursor: {
                        type: 'string',
                        description: 'Pagination cursor from previous response (optional).',
                    },
                    limit: {
                        type: 'number',
                        description: 'Page size (default 10, max 20).',
                    },
                },
                additionalProperties: false,
            },
        },
    },
    {
        type: 'function' as const,
        function: {
            name: 'get_journal',
            description: 'Load the full body of one journal entry by id.',
            parameters: {
                type: 'object',
                properties: {
                    id: { type: 'string', description: 'Journal entry id.' },
                },
                required: ['id'],
                additionalProperties: false,
            },
        },
    },
];

export function executeProbeTool(
    fixture: ProbeFixture,
    name: string,
    rawArgs: string,
): { content: string; malformed: boolean; parsedArgs: unknown } {
    let parsedArgs: unknown = {};
    let malformed = false;
    try {
        parsedArgs = rawArgs.trim() ? JSON.parse(rawArgs) : {};
        if (parsedArgs === null || typeof parsedArgs !== 'object' || Array.isArray(parsedArgs)) {
            malformed = true;
            parsedArgs = {};
        }
    } catch {
        malformed = true;
        parsedArgs = {};
    }
    const args = parsedArgs as Record<string, unknown>;

    if (name === 'search_journals') {
        const query = typeof args.query === 'string' ? args.query : '';
        if (!query) {
            return {
                content: JSON.stringify({ error: 'query is required' }),
                malformed: malformed || true,
                parsedArgs,
            };
        }
        const hits = searchJournalsKeyword(fixture, query, 5);
        return {
            content: JSON.stringify({ query, hits }, null, 2),
            malformed,
            parsedArgs,
        };
    }

    if (name === 'list_journals') {
        const cursor = typeof args.cursor === 'string' ? args.cursor : null;
        const limitRaw = typeof args.limit === 'number' ? args.limit : 10;
        const limit = Math.min(20, Math.max(1, Math.floor(limitRaw)));
        const page = listJournals(fixture, cursor, limit);
        return {
            content: JSON.stringify({
                count: page.items.length,
                nextCursor: page.nextCursor,
                items: page.items.map((e) => ({
                    id: e.id,
                    dateISO: e.dateISO,
                    title: e.title,
                    topic: e.topic,
                    preview: e.body.slice(0, 120),
                })),
            }, null, 2),
            malformed,
            parsedArgs,
        };
    }

    if (name === 'get_journal') {
        const id = typeof args.id === 'string' ? args.id : '';
        if (!id) {
            return {
                content: JSON.stringify({ error: 'id is required' }),
                malformed: true,
                parsedArgs,
            };
        }
        const entry = getEntryById(fixture, id);
        if (!entry) {
            return {
                content: JSON.stringify({ error: `unknown id ${id}` }),
                malformed: false,
                parsedArgs,
            };
        }
        return {
            content: JSON.stringify({
                id: entry.id,
                dateISO: entry.dateISO,
                title: entry.title,
                topic: entry.topic,
                body: entry.body,
            }, null, 2),
            malformed,
            parsedArgs,
        };
    }

    return {
        content: JSON.stringify({ error: `unknown tool ${name}` }),
        malformed: true,
        parsedArgs,
    };
}

export function defaultFixture(): ProbeFixture {
    return buildProbeFixture();
}
