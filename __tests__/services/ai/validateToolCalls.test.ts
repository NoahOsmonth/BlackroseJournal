import {
    prepareToolCalls,
    toolCallDedupeKey,
    validateAndRepairToolCall,
} from '../../../services/ai/tools/validateToolCalls';

describe('validateAndRepairToolCall', () => {
    it('accepts get_clock with empty args', () => {
        const out = validateAndRepairToolCall(
            { id: '1', name: 'get_clock', arguments: '{}' },
            'structured'
        );
        expect(out).not.toBeNull();
        expect(out!.name).toBe('get_clock');
        expect(out!.repaired).toBe(false);
    });

    it('repairs date alias day → date', () => {
        const out = validateAndRepairToolCall(
            { id: '1', name: 'get_day', arguments: '{"day":"yesterday"}' },
            'text'
        );
        expect(out).not.toBeNull();
        expect(JSON.parse(out!.arguments)).toEqual({ date: 'yesterday' });
        expect(out!.repaired).toBe(true);
        expect(out!.origin).toBe('text');
    });

    it('promotes _raw string onto required query', () => {
        const out = validateAndRepairToolCall(
            { id: '1', name: 'search_history', arguments: 'sleep anxiety' },
            'text'
        );
        expect(out).not.toBeNull();
        expect(JSON.parse(out!.arguments).query).toBe('sleep anxiety');
    });

    it('coerces string days to number', () => {
        const out = validateAndRepairToolCall(
            { id: '1', name: 'list_recent_days', arguments: '{"days":"5"}' },
            'structured'
        );
        expect(out).not.toBeNull();
        expect(JSON.parse(out!.arguments).days).toBe(5);
    });

    it('rejects get_day without date', () => {
        expect(
            validateAndRepairToolCall(
                { id: '1', name: 'get_day', arguments: '{}' },
                'structured'
            )
        ).toBeNull();
    });

    it('rejects unknown tools', () => {
        expect(
            validateAndRepairToolCall(
                { id: '1', name: 'delete_everything', arguments: '{}' },
                'structured'
            )
        ).toBeNull();
    });

    it('maps kind aliases for get_conversation', () => {
        const out = validateAndRepairToolCall(
            {
                id: '1',
                name: 'get_conversation',
                arguments: '{"kind":"journal","id":"entry-1"}',
            },
            'structured'
        );
        expect(out).not.toBeNull();
        expect(JSON.parse(out!.arguments)).toMatchObject({
            kind: 'journal_entry',
            id: 'entry-1',
        });
    });

    it('repairs recall alias → query for recall_memory', () => {
        const out = validateAndRepairToolCall(
            { id: '1', name: 'recall_memory', arguments: '{"recall":"wedding"}' },
            'text'
        );
        expect(out).not.toBeNull();
        expect(JSON.parse(out!.arguments)).toEqual({ query: 'wedding' });
        expect(out!.repaired).toBe(true);
    });

    it('rejects recall_memory without query', () => {
        expect(
            validateAndRepairToolCall(
                { id: '1', name: 'recall_memory', arguments: '{}' },
                'structured'
            )
        ).toBeNull();
    });
});

describe('prepareToolCalls', () => {
    it('dedupes identical calls', () => {
        const result = prepareToolCalls([
            {
                call: { id: 'a', name: 'get_day', arguments: '{"date":"yesterday"}' },
                origin: 'structured',
            },
            {
                call: { id: 'b', name: 'get_day', arguments: '{"date":"yesterday"}' },
                origin: 'text',
            },
        ]);
        expect(result.calls).toHaveLength(1);
        expect(result.skippedDuplicate).toBe(1);
    });

    it('skips already-executed keys', () => {
        const key = toolCallDedupeKey({
            id: 'x',
            name: 'get_clock',
            arguments: '{}',
        });
        const result = prepareToolCalls(
            [{ call: { id: '1', name: 'get_clock', arguments: '{}' }, origin: 'structured' }],
            new Set([key])
        );
        expect(result.calls).toHaveLength(0);
        expect(result.skippedDuplicate).toBe(1);
    });

    it('counts invalid skips', () => {
        const result = prepareToolCalls([
            { call: { id: '1', name: 'get_day', arguments: '{}' }, origin: 'structured' },
        ]);
        expect(result.calls).toHaveLength(0);
        expect(result.skippedInvalid).toBe(1);
    });
});
