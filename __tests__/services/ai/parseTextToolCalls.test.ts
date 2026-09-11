import {
    formatToolResultsForModel,
    looksLikeToolDump,
    parseTextToolCalls,
    stripToolCallSyntax,
} from '../../../services/ai/tools/parseTextToolCalls';

describe('parseTextToolCalls', () => {
    it('parses function-call style dumps', () => {
        const raw = 'get_day(date="yesterday")\nget_clock()';
        const result = parseTextToolCalls(raw);
        expect(result.toolCalls.map((c) => c.name).sort()).toEqual(['get_clock', 'get_day']);
        expect(JSON.parse(result.toolCalls.find((c) => c.name === 'get_day')!.arguments)).toEqual({
            date: 'yesterday',
        });
        expect(result.cleanedContent).toBe('');
        expect(result.lookedLikeToolDump).toBe(true);
    });

    it('parses JSON tool objects', () => {
        const raw = 'Let me check.\n{"name":"search_history","arguments":{"query":"sleep"}}\n';
        const result = parseTextToolCalls(raw);
        expect(result.toolCalls).toHaveLength(1);
        expect(result.toolCalls[0].name).toBe('search_history');
        expect(JSON.parse(result.toolCalls[0].arguments)).toEqual({ query: 'sleep' });
        expect(result.cleanedContent).toContain('Let me check');
    });

    it('parses XML-style tool_call tags', () => {
        const raw = '<tool_call name="get_day">{"date":"2026-07-12"}</tool_call>';
        const result = parseTextToolCalls(raw);
        expect(result.toolCalls).toHaveLength(1);
        expect(result.toolCalls[0].name).toBe('get_day');
        expect(JSON.parse(result.toolCalls[0].arguments)).toEqual({ date: '2026-07-12' });
    });

    it('parses fenced tool_call blocks', () => {
        const raw = '```tool_call\nlist_recent_days\n{"days":5}\n```';
        const result = parseTextToolCalls(raw);
        expect(result.toolCalls).toHaveLength(1);
        expect(result.toolCalls[0].name).toBe('list_recent_days');
        expect(JSON.parse(result.toolCalls[0].arguments)).toEqual({ days: 5 });
    });

    it('parses dots_function_call tags with parameter blocks (dots-3 dump shape)', () => {
        const raw = [
            '<dots_function_call>',
            '<parameter name="query">boss</parameter>',
            '</dots_function_call>',
        ].join('\n');
        const result = parseTextToolCalls(raw);
        expect(result.toolCalls).toHaveLength(1);
        expect(result.toolCalls[0].name).toBe('search_history');
        expect(JSON.parse(result.toolCalls[0].arguments)).toEqual({ query: 'boss' });
        expect(result.cleanedContent).toBe('');
        expect(result.lookedLikeToolDump).toBe(true);
    });

    it('strips dots_function_call scaffolding from mixed prose (UI leak guard)', () => {
        const raw = [
            '<dots_function_call>',
            '<parameter name="query">boss</parameter>',
            '</dots_function_call>',
            '',
            'I looked on your device and could not find more.',
        ].join('\n');
        const stripped = stripToolCallSyntax(raw);
        expect(stripped).not.toMatch(/dots_function_call|parameter/);
        expect(stripped).toContain('could not find more');
    });

    it('parses tool-named XML tags (glm 5.3 leak shape)', () => {
        const raw = '<search_history>\n{\n  "query": "work",\n  "top_k": 10\n}\n</search_history>';
        const result = parseTextToolCalls(raw);
        expect(result.toolCalls).toHaveLength(1);
        expect(result.toolCalls[0].name).toBe('search_history');
        expect(JSON.parse(result.toolCalls[0].arguments)).toEqual({ query: 'work', top_k: 10 });
        expect(result.cleanedContent).toBe('');
        expect(result.lookedLikeToolDump).toBe(true);
    });

    it('parses multiple tool-named tags and keeps surrounding prose', () => {
        const raw = [
            'Let me look that up.',
            '<get_clock></get_clock>',
            '<search_history>{"query":"sleep"}</search_history>',
        ].join('\n');
        const result = parseTextToolCalls(raw);
        expect(result.toolCalls.map((c) => c.name).sort()).toEqual(['get_clock', 'search_history']);
        expect(result.cleanedContent).toContain('Let me look that up');
        expect(result.cleanedContent).not.toContain('search_history');
    });

    it('parses invoke phrasing', () => {
        const raw = 'call tool get_conversation with {"kind":"journal_entry","id":"abc"}';
        const result = parseTextToolCalls(raw);
        expect(result.toolCalls).toHaveLength(1);
        expect(result.toolCalls[0].name).toBe('get_conversation');
        expect(JSON.parse(result.toolCalls[0].arguments)).toMatchObject({
            kind: 'journal_entry',
            id: 'abc',
        });
    });

    it('does not invent tools from normal prose', () => {
        const raw = 'Yesterday was hard. How are you feeling tonight?';
        const result = parseTextToolCalls(raw);
        expect(result.toolCalls).toHaveLength(0);
        expect(result.cleanedContent).toBe(raw);
        expect(result.lookedLikeToolDump).toBe(false);
    });
});

describe('stripToolCallSyntax', () => {
    it('removes pseudo-code so it never reaches the UI', () => {
        const stripped = stripToolCallSyntax(
            'get_day({"date":"yesterday"})\n\nYou mentioned sleep.'
        );
        expect(stripped).toContain('You mentioned sleep');
        expect(stripped).not.toContain('get_day');
    });

    it('strips tool-named tags so raw syntax never reaches the UI', () => {
        const stripped = stripToolCallSyntax(
            '<search_history>\n{\n  "query": "work",\n  "top_k": 10\n}\n</search_history>'
        );
        expect(stripped).toBe('');
    });

    it('strips orphan tool-named tags without a matching close', () => {
        const stripped = stripToolCallSyntax(
            'I had a look.\n<search_history>\n{"query": "work"}\n\nNothing much came back.'
        );
        expect(stripped).not.toContain('<search_history>');
        expect(stripped).toContain('Nothing much came back');
    });
});

describe('looksLikeToolDump', () => {
    it('detects pure tool dumps', () => {
        expect(looksLikeToolDump('tool_call\nget_clock()')).toBe(true);
        expect(looksLikeToolDump('How was your day?')).toBe(false);
    });

    it('detects {"tool": "X"} JSON format (Fix 4)', () => {
        expect(looksLikeToolDump('{"tool": "search_history", "query": "app project"}')).toBe(true);
        expect(looksLikeToolDump('{"tool": "get_day", "date": "yesterday"}')).toBe(true);
        expect(looksLikeToolDump('{"function": "get_clock"}')).toBe(true);
    });

    it('detects {"name": "X"} JSON format with newer tool names', () => {
        expect(looksLikeToolDump('{"name": "get_identity"}')).toBe(true);
        expect(looksLikeToolDump('{"name": "update_identity", "arguments": {}}')).toBe(true);
        expect(looksLikeToolDump('{"name": "recall_memory", "query": "wedding"}')).toBe(true);
    });

    it('detects tool-named XML tag dumps (glm 5.3 shape)', () => {
        expect(looksLikeToolDump('<search_history>{"query":"work"}</search_history>')).toBe(true);
        expect(looksLikeToolDump('<list_recent_days>{"days":7}</list_recent_days>')).toBe(true);
    });

    it('does not flag prose that merely names a tool', () => {
        expect(looksLikeToolDump('I used search_history to find that, and it came back thin.')).toBe(false);
        expect(looksLikeToolDump('Your get_day entries show a quiet week overall, honestly.')).toBe(false);
        expect(looksLikeToolDump('<3 — that sounds rough. Work has been heavy lately, hasn\'t it?')).toBe(false);
    });
});

describe('formatToolResultsForModel', () => {
    it('formats results for free-model continuation', () => {
        const text = formatToolResultsForModel([
            { name: 'get_clock', content: 'local: 2026-07-14 22:00' },
        ]);
        expect(text).toContain('get_clock');
        expect(text).toContain('2026-07-14');
        expect(text).toMatch(/natural language/i);
    });
});
