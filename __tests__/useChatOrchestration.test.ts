import { act, renderHook } from '@testing-library/react-native';
import { Keyboard } from 'react-native';
import { useChatOrchestration } from '../features/chat/hooks/useChatOrchestration';

// Mock the AI service
const mockSendMessage = jest.fn();
const mockClearMessages = jest.fn();

jest.mock('../services/ai', () => ({
    useChat: () => ({
        sendMessage: mockSendMessage,
        clearMessages: mockClearMessages,
    }),
}));

// Spy on Keyboard.dismiss
jest.spyOn(Keyboard, 'dismiss').mockImplementation(() => { });

describe('useChatOrchestration', () => {
    const mockScrollViewRef = { current: { scrollToEnd: jest.fn() } };
    const mockInputRef = { current: { focus: jest.fn(), clear: jest.fn() } };

    beforeEach(() => {
        jest.clearAllMocks();
        jest.useFakeTimers();
    });

    afterEach(() => {
        jest.useRealTimers();
    });

    it('initializes with empty state', () => {
        const { result } = renderHook(() =>
            useChatOrchestration({
                scrollViewRef: mockScrollViewRef as any,
                inputRef: mockInputRef as any,
            })
        );

        expect(result.current.messages).toEqual([]);
        expect(result.current.streamingMessage).toBeNull();
        expect(result.current.isLoading).toBe(false);
    });

    it('handles sending a message successfully', async () => {
        // Mock successful response
        mockSendMessage.mockImplementation(
            async (_text: string, onChunk: Function, onComplete: Function, _onError: Function) => {
                onChunk('Hello', '');
                onComplete('Hello from AI', 'Some reasoning');
            }
        );

        const { result } = renderHook(() =>
            useChatOrchestration({
                scrollViewRef: mockScrollViewRef as any,
                inputRef: mockInputRef as any,
            })
        );

        await act(async () => {
            await result.current.handleSendMessage('Test message');
        });

        // Should have user message and AI message
        expect(result.current.messages).toHaveLength(2);
        expect(result.current.messages[0].role).toBe('user');
        expect(result.current.messages[0].content).toBe('Test message');
        expect(result.current.messages[1].role).toBe('assistant');
        expect(result.current.messages[1].content).toBe('Hello from AI');
        expect(result.current.isLoading).toBe(false);
        expect(result.current.streamingMessage).toBeNull();
    });

    it('handles API errors gracefully', async () => {
        // Mock error response
        mockSendMessage.mockImplementation(
            async (_text: string, _onChunk: Function, _onComplete: Function, onError: Function) => {
                onError(new Error('API Error'));
            }
        );

        const { result } = renderHook(() =>
            useChatOrchestration({
                scrollViewRef: mockScrollViewRef as any,
                inputRef: mockInputRef as any,
            })
        );

        await act(async () => {
            await result.current.handleSendMessage('Test message');
        });

        // Should have user message only (AI message failed)
        expect(result.current.messages).toHaveLength(1);
        expect(result.current.messages[0].role).toBe('user');
        expect(result.current.isLoading).toBe(false);
        expect(result.current.streamingMessage).toBeNull();
    });

    it('clears messages on new chat', async () => {
        // Setup initial message
        mockSendMessage.mockImplementation(
            async (_text: string, _onChunk: Function, onComplete: Function, _onError: Function) => {
                onComplete('Response', '');
            }
        );

        const { result } = renderHook(() =>
            useChatOrchestration({
                scrollViewRef: mockScrollViewRef as any,
                inputRef: mockInputRef as any,
            })
        );

        await act(async () => {
            await result.current.handleSendMessage('Message 1');
        });

        expect(result.current.messages).toHaveLength(2);

        // Clear messages
        act(() => {
            result.current.handleNewChat();
        });

        expect(result.current.messages).toEqual([]);
        expect(mockClearMessages).toHaveBeenCalled();
        expect(mockInputRef.current.clear).toHaveBeenCalled();
    });

    it('scrolls to bottom after sending message', async () => {
        mockSendMessage.mockImplementation(
            async (_text: string, _onChunk: Function, onComplete: Function, _onError: Function) => {
                onComplete('Response', '');
            }
        );

        const { result } = renderHook(() =>
            useChatOrchestration({
                scrollViewRef: mockScrollViewRef as any,
                inputRef: mockInputRef as any,
            })
        );

        await act(async () => {
            await result.current.handleSendMessage('Test');
            // Run timers to trigger scroll
            jest.runAllTimers();
        });

        expect(mockScrollViewRef.current.scrollToEnd).toHaveBeenCalled();
    });
});
