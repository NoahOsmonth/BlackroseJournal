// Mock AsyncStorage before imports
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
}));

import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import React from 'react';
import ChatScreen from '../app/chat';

// Mock navigation/router
const mockUseLocalSearchParams = jest.fn();

jest.mock('expo-router', () => ({
  useRouter: () => ({
    push: jest.fn(),
    back: jest.fn(),
    replace: jest.fn(),
  }),
  useLocalSearchParams: () => mockUseLocalSearchParams(),
}));

jest.mock('@expo/vector-icons', () => ({
  MaterialIcons: 'MaterialIcons',
}));

// Mock the chat orchestration hook
const mockHandleSendMessage = jest.fn();
const mockHandleNewChat = jest.fn();
const mockScrollToBottom = jest.fn();
const mockInitializeMessages = jest.fn();
const mockRetryLastMessage = jest.fn();
const mockClearError = jest.fn();
let mockErrorMessage: string | null = null;
let mockCanRetry = false;

jest.mock('../features/chat', () => ({
  useChatOrchestration: () => ({
    messages: [],
    streamingMessage: null,
    isLoading: false,
    errorMessage: mockErrorMessage,
    canRetry: mockCanRetry,
    handleSendMessage: mockHandleSendMessage,
    retryLastMessage: mockRetryLastMessage,
    clearError: mockClearError,
    handleNewChat: mockHandleNewChat,
    initializeMessages: mockInitializeMessages,
    scrollToBottom: mockScrollToBottom,
    currentPrompt: null,
  }),
}));

const mockGetById = jest.fn();
const mockCreate = jest.fn();
const mockUpdate = jest.fn();

jest.mock('../hooks/useJournalEntries', () => ({
  useJournalEntries: () => ({
    getById: mockGetById,
    create: mockCreate,
    update: mockUpdate,
  }),
}));

// Mock color scheme hook
jest.mock('@/hooks/use-color-scheme', () => ({
  useColorScheme: () => 'light',
}));

// Mock Reanimated
jest.mock('react-native-reanimated', () => {
  const Reanimated = require('react-native-reanimated/mock');
  Reanimated.default.call = () => { };
  return {
    ...Reanimated,
    FadeIn: {
      duration: () => ({ springify: () => ({}) }),
    },
    FadeInDown: {
      duration: () => ({ springify: () => ({}) }),
    },
    useSharedValue: (val: number) => ({ value: val }),
    useAnimatedStyle: () => ({}),
    withRepeat: (val: any) => val,
    withSequence: (val: any) => val,
    withTiming: (val: any) => val,
  };
});

describe('ChatScreen', () => {
  beforeEach(() => {
    mockHandleSendMessage.mockClear();
    mockHandleNewChat.mockClear();
    mockScrollToBottom.mockClear();
    mockInitializeMessages.mockClear();
    mockRetryLastMessage.mockClear();
    mockClearError.mockClear();
    mockErrorMessage = null;
    mockCanRetry = false;
    mockGetById.mockClear();
    mockCreate.mockClear();
    mockUpdate.mockClear();
    mockUseLocalSearchParams.mockReturnValue({});
  });

  it('renders correctly with Blackrose header and inline typing input', () => {
    render(<ChatScreen />);

    // Check for "Blackrose" branding
    expect(screen.getByText('Blackrose')).toBeTruthy();

    // Check for "B" avatar
    expect(screen.getByText('B')).toBeTruthy();

    // Ensure "Internal Family Systems" is NOT present
    expect(screen.queryByText('Internal Family Systems')).toBeNull();

    // Check for inline typing input placeholder
    expect(screen.getByPlaceholderText('Type your thoughts...')).toBeTruthy();

    // Check for Footer buttons
    expect(screen.getByText('Go deeper')).toBeTruthy();
    expect(screen.getByText('Finish entry')).toBeTruthy();
  });

  it('allows typing in the inline input', () => {
    render(<ChatScreen />);

    const input = screen.getByPlaceholderText('Type your thoughts...');
    fireEvent.changeText(input, 'Hello AI');

    expect(input.props.value).toBe('Hello AI');
  });

  it('sends message from Go deeper button', async () => {
    render(<ChatScreen />);

    const input = screen.getByPlaceholderText('Type your thoughts...');
    fireEvent.changeText(input, 'Hello AI');

    const goDeeperButton = screen.getByText('Go deeper');
    fireEvent.press(goDeeperButton);

    await waitFor(() => {
      expect(mockHandleSendMessage).toHaveBeenCalledWith('Hello AI');
    });
  });

  it('loads existing entry messages when entryId is provided', async () => {
    mockUseLocalSearchParams.mockReturnValue({ entryId: 'entry-123', mode: 'continue' });
    mockGetById.mockResolvedValue({
      id: 'entry-123',
      title: 'Test Entry',
      emoji: '📝',
      messages: [
        { id: 'm1', role: 'user', content: 'Hello', timestamp: 1 },
        { id: 'm2', role: 'assistant', content: 'Hi', timestamp: 2 },
      ],
      status: 'completed',
      createdAt: 1,
      updatedAt: 2,
    });

    render(<ChatScreen />);

    await waitFor(() => {
      expect(mockInitializeMessages).toHaveBeenCalled();
    });

    expect(mockGetById).toHaveBeenCalledWith('entry-123');
    expect(mockInitializeMessages).toHaveBeenCalledWith([
      { id: 'm1', role: 'user', content: 'Hello', timestamp: 1 },
      { id: 'm2', role: 'assistant', content: 'Hi', timestamp: 2 },
    ]);
  });

  it('shows an error banner with retry when the hook reports an error', () => {
    mockErrorMessage = 'Missing AI configuration.';
    mockCanRetry = true;

    render(<ChatScreen />);

    expect(screen.getByText('Missing AI configuration.')).toBeTruthy();

    const retryButton = screen.getByLabelText('Retry AI request');
    fireEvent.press(retryButton);
    expect(mockRetryLastMessage).toHaveBeenCalled();

    const dismissButton = screen.getByLabelText('Dismiss error message');
    fireEvent.press(dismissButton);
    expect(mockClearError).toHaveBeenCalled();
  });
});
