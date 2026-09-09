/**
 * Per-tool execution timeout (Task 9 of the hindsight integration plan).
 * Pins the production change: executeToolCall(call, opts?: { timeoutMs })
 * races the handler against a deadline and returns an isError ToolResult
 * instead of hanging the agent loop.
 *
 * The registry handler map is mocked at the module boundary (the dependency
 * under executeToolCall) — the unit under test is executeToolCall itself.
 */
import { executeToolCall, executeToolCalls, idempotencyKey, TOOL_EXEC_TIMEOUT_MS } from '../../../services/ai/tools/executeTool';
import { getToolDefinition, getToolHandler } from '../../../services/ai/tools/registry';

jest.mock('../../../services/ai/tools/registry', () => ({
    getToolHandler: jest.fn(),
    getToolDefinition: jest.fn(),
}));

const handlerMock = getToolHandler as jest.Mock;
const definitionMock = getToolDefinition as jest.Mock;

function defFor(name: string, execClass: 'pure' | 'mutating' = 'pure') {
    return { name, description: `${name} tool`, parameters: { type: 'object' }, execClass };
}

describe('executeToolCall timeouts', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        definitionMock.mockImplementation((name: string) => defFor(name, 'pure'));
    });

    it('returns an isError result when a tool exceeds the timeout', async () => {
        const slowHandler = () =>
            new Promise<string>((resolve) => setTimeout(() => resolve('late'), 250));
        handlerMock.mockReturnValue(slowHandler);

        const result = await executeToolCall(
            { id: 'c1', name: 'slow_tool', arguments: '{}' },
            { timeoutMs: 30 }
        );

        expect(result.isError).toBe(true);
        expect(result.content).toMatch(/timed out/);
        expect(result.content).toContain('slow_tool');
    });

    it('returns the handler content when it resolves before the timeout', async () => {
        handlerMock.mockReturnValue(async () => 'fast result');

        const result = await executeToolCall(
            { id: 'c1', name: 'fast_tool', arguments: '{}' },
            { timeoutMs: 30 }
        );

        expect(result.isError).toBeFalsy();
        expect(result.content).toBe('fast result');
    });

    it('marks a handler failure as an error result', async () => {
        handlerMock.mockReturnValue(async () => {
            throw new Error('boom');
        });

        const result = await executeToolCall(
            { id: 'c1', name: 'failing_tool', arguments: '{}' },
            { timeoutMs: 30 }
        );

        expect(result.isError).toBe(true);
        expect(result.content).toMatch(/failed/);
    });

    it('exposes a sane default timeout constant', () => {
        expect(TOOL_EXEC_TIMEOUT_MS).toBe(10_000);
    });
});

describe('executeToolCalls phase scheduling', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        definitionMock.mockImplementation((name: string) =>
            name === 'update_identity' || name === 'create_goal'
                ? defFor(name, 'mutating')
                : defFor(name, 'pure')
        );
    });

    it('runs 3 pure + caps to 1 mutating with REFUSED, keeps input order, covers all ids', async () => {
        const inFlight = { current: 0, max: 0 };
        handlerMock.mockImplementation(() => async () => {
            inFlight.current += 1;
            inFlight.max = Math.max(inFlight.max, inFlight.current);
            await new Promise((resolve) => setTimeout(resolve, 10));
            inFlight.current -= 1;
            return 'ok';
        });

        const calls = [
            { id: 'r1', name: 'get_clock', arguments: '{}' },
            { id: 'm1', name: 'update_identity', arguments: '{"preferredName":"Sam"}' },
            { id: 'r2', name: 'get_day', arguments: '{"date":"yesterday"}' },
            { id: 'm2', name: 'create_goal', arguments: '{"title":"Run"}' },
            { id: 'r3', name: 'list_goals', arguments: '{}' },
        ];
        
        const results = await executeToolCalls(calls, { runId: 'test-run-1' });

        expect(results).toHaveLength(5);
        expect(results.map((r) => r.toolCallId)).toEqual(['r1', 'm1', 'r2', 'm2', 'r3']);
        expect(results[0].isError).toBeFalsy();
        expect(results[1].isError).toBeFalsy();
        expect(results[2].isError).toBeFalsy();
        expect(results[4].isError).toBeFalsy();
        expect(results[3].refused).toBe(true);
        expect(results[3].content).toMatch(/^REFUSED:/);
        expect(results[3].content).toMatch(/alone/);
        // create_goal handler never ran — only update_identity mutated.
        expect(handlerMock).toHaveBeenCalledTimes(4);
    });

    it('caps read concurrency at 4', async () => {
        const inFlight = { current: 0, max: 0 };
        handlerMock.mockImplementation(() => async () => {
            inFlight.current += 1;
            inFlight.max = Math.max(inFlight.max, inFlight.current);
            await new Promise((resolve) => setTimeout(resolve, 15));
            inFlight.current -= 1;
            return 'ok';
        });
        definitionMock.mockReturnValue(defFor('get_day'));

        const calls = Array.from({ length: 8 }, (_, i) => ({
            id: `c${i}`, name: 'get_day', arguments: `{"date":"2026-08-0${i + 1}"}`
        }));
        
        const results = await executeToolCalls(calls, { runId: 'test-run-2' });

        expect(results).toHaveLength(8);
        expect(inFlight.max).toBeLessThanOrEqual(4);
        expect(inFlight.max).toBeGreaterThan(1);
        expect(results.every((r) => !r.isError)).toBe(true);
    });

    it('dedupes identical in-batch calls by idempotency key without re-executing', async () => {
        handlerMock.mockReturnValue(async () => 'day digest');
        

        expect(idempotencyKey('r', 'get_day', '{"b":1,"a":2}'))
            .toBe(idempotencyKey('r', 'get_day', '{"a":2,"b":1}'));
        expect(idempotencyKey('r', 'get_day', '{}'))
            .not.toBe(idempotencyKey('r', 'get_day', '{"date":"today"}'));
        expect(idempotencyKey('r1', 'get_day', '{}'))
            .not.toBe(idempotencyKey('r2', 'get_day', '{}'));
        expect(idempotencyKey('r', 'get_day', '{}')).toMatch(/^[0-9a-f]{64}$/);

        const results = await executeToolCalls([
            { id: 'a', name: 'get_day', arguments: '{"date":"today"}' },
            { id: 'b', name: 'get_day', arguments: '{"date":"today"}' },
        ], { runId: 'test-run-3' });

        expect(handlerMock).toHaveBeenCalledTimes(1);
        expect(results.map((r) => r.toolCallId)).toEqual(['a', 'b']);
        expect(results[0].content).toBe('day digest');
        expect(results[1].content).toBe('day digest');
    });

    it('unknown tools are fatal with a shape hint, never retried', async () => {
        const inner = jest.fn(async () => 'should-not-run');
        handlerMock.mockImplementation((name: string) =>
            name === 'nope_tool' ? undefined : inner
        );
        const results = await executeToolCalls(
            [{ id: 'u1', name: 'nope_tool', arguments: '{}' }],
            { runId: 'test-run-4' }
        );

        expect(results[0].isError).toBe(true);
        expect(results[0].content).toMatch(/unknown tool "nope_tool"/);
        expect(results[0].content).toMatch(/get_clock/);
        expect(inner).not.toHaveBeenCalled();
    });

    it('retryable failure on a pure tool retries once (N=1), mutating never blind-retries', async () => {
        let pureAttempts = 0;
        let mutAttempts = 0;
        handlerMock.mockImplementation((name: string) => async () => {
            if (name === 'get_day') {
                pureAttempts += 1;
                if (pureAttempts === 1) throw new Error('upstream 503 temporarily unavailable');
                return 'recovered';
            }
            mutAttempts += 1;
            throw new Error('upstream 503 temporarily unavailable');
        });
        

        const results = await executeToolCalls([
            { id: 'p1', name: 'get_day', arguments: '{}' },
            { id: 'm1', name: 'create_goal', arguments: '{"title":"X"}' },
        ], { runId: 'test-run-5' });

        expect(pureAttempts).toBe(2);
        expect(results[0].isError).toBeFalsy();
        expect(results[0].content).toBe('recovered');
        expect(mutAttempts).toBe(1);
        expect(results[1].isError).toBe(true);
    });

    it('mutating timeout tells the model to verify via a read tool, not repeat blindly', async () => {
        handlerMock.mockReturnValue(
            () => new Promise<string>((resolve) => setTimeout(() => resolve('late'), 250))
        );
        
        const result = await executeToolCall(
            { id: 'm1', name: 'create_goal', arguments: '{"title":"X"}' },
            { timeoutMs: 30 }
        );

        expect(result.isError).toBe(true);
        expect(result.content).toMatch(/timed out/);
        expect(result.content).toMatch(/verify/i);
        expect(result.content).toMatch(/do not repeat blindly/i);
    });

    it('truncated results carry a refetch hint for a narrower call', async () => {
        handlerMock.mockReturnValue(async () => 'x'.repeat(12_500));
        
        const result = await executeToolCall(
            { id: 't1', name: 'get_day', arguments: '{}' }
        );

        expect(result.content.length).toBeLessThan(12_500);
        expect(result.content).toMatch(/truncated to 12000 chars/);
        expect(result.content).toMatch(/narrower/);
    });
});
