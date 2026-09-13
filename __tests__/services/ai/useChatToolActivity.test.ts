/**
 * Unit tests for toolActivity persistence in useChat (services/ai/useChat.ts).
 */

import { renderHook, act } from '@testing-library/react-native';
import { useChat } from '../../../services/ai/useChat';
import * as aiModule from '../../../services/ai/ai';
import type { AgentActivityEvent } from '../../../services/ai/agentEvents';

describe('useChat — toolActivity tracking', () => {
    let streamChatSpy: jest.SpyInstance;

    beforeEach(() => {
        streamChatSpy = jest.spyOn(aiModule, 'streamChat').mockImplementation(
            async (_messages, onChunk, onComplete, _onError, options) => {
                if (options && typeof options === 'object' && options.onAgentActivity) {
                    const event: AgentActivityEvent = {
                        type: 'tool_call_start',
                        call: {
                            toolCallId: 'call_live_1',
                            name: 'get_day',
                            label: 'Get Day',
                            argsPreview: '2026-01-01',
                            status: 'ok',
                            round: 1,
                        },
                    };
                    options.onAgentActivity(event);
                }
                onChunk('Here is what I found.', '');
                onComplete('Here is what I found.', '');
            }
        );
    });

    afterEach(() => {
        streamChatSpy.mockRestore();
    });

    it('captures toolActivity on the assistant message so subsequent turns retain tool context', async () => {
        const { result } = renderHook(() => useChat());

        const mockChunk = jest.fn();
        const mockComplete = jest.fn();
        const mockError = jest.fn();
        const mockActivity = jest.fn();

        await act(async () => {
            await result.current.sendMessage(
                'what did I write about work?',
                mockChunk,
                mockComplete,
                mockError,
                { onAgentActivity: mockActivity }
            );
        });

        expect(mockComplete).toHaveBeenCalledWith('Here is what I found.', '');
        expect(mockActivity).toHaveBeenCalled();

        // Send a follow-up turn
        await act(async () => {
            await result.current.sendMessage(
                'hmm sure',
                mockChunk,
                mockComplete,
                mockError
            );
        });

        // The second streamChat invocation should receive messages including the assistant message with toolActivity!
        expect(streamChatSpy).toHaveBeenCalledTimes(2);
        const secondCallMessages = streamChatSpy.mock.calls[1][0];
        const assistantMessage = secondCallMessages.find((m: { role: string }) => m.role === 'assistant');

        expect(assistantMessage).toBeDefined();
        expect(assistantMessage.toolActivity).toBeDefined();
        expect(assistantMessage.toolActivity).toHaveLength(1);
        expect(assistantMessage.toolActivity[0].toolCallId).toBe('call_live_1');
    });
});
