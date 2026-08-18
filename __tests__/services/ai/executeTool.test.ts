/**
 * Per-tool execution timeout (Task 9 of the hindsight integration plan).
 * Pins the production change: executeToolCall(call, opts?: { timeoutMs })
 * races the handler against a deadline and returns an isError ToolResult
 * instead of hanging the agent loop.
 *
 * The registry handler map is mocked at the module boundary (the dependency
 * under executeToolCall) — the unit under test is executeToolCall itself.
 */
import { executeToolCall, TOOL_EXEC_TIMEOUT_MS } from '../../../services/ai/tools/executeTool';
import { getToolHandler } from '../../../services/ai/tools/registry';

jest.mock('../../../services/ai/tools/registry', () => ({
    getToolHandler: jest.fn(),
}));

const handlerMock = getToolHandler as jest.Mock;

describe('executeToolCall timeouts', () => {
    beforeEach(() => {
        jest.clearAllMocks();
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
