// Mock AsyncStorage before imports
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
}));

import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import ChatScreen from '../app/chat';

// Mock navigation/router
const mockUseLocalSearchParams = jest.fn();
const mockRouterPush = jest.fn();
const mockRouterReplace = jest.fn();
const mockRouterBack = jest.fn();

jest.mock('expo-router', () => ({
  useRouter: () => ({
    push: mockRouterPush,
    back: mockRouterBack,
    replace: mockRouterReplace,
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
let mockMessages: any[] = [];
let mockIsLoading = false;

jest.mock('../features/chat', () => ({
  useChatOrchestration: () => ({
    messages: mockMessages,
    streamingMessage: null,
    isLoading: mockIsLoading,
    handleSendMessage: mockHandleSendMessage,
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
    mockGetById.mockClear();
    mockCreate.mockClear();
    mockUpdate.mockClear();
    mockRouterPush.mockClear();
    mockRouterReplace.mockClear();
    mockRouterBack.mockClear();
    mockUseLocalSearchParams.mockReturnValue({});
    mockMessages = [];
    mockIsLoading = false;
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
    expect(screen.getByText('New Chat')).toBeTruthy();
    expect(screen.getByText('Finish entry')).toBeTruthy();
  });

  it('allows typing in the inline input', () => {
    render(<ChatScreen />);

    const input = screen.getByPlaceholderText('Type your thoughts...');
    fireEvent.changeText(input, 'Hello AI');

    expect(input.props.value).toBe('Hello AI');
  });

  it('shows New Chat button that calls handleNewChat', () => {
    render(<ChatScreen />);

    const newChatButton = screen.getByText('New Chat');
    expect(newChatButton).toBeTruthy();

    // Press should call the hook's handleNewChat
    fireEvent.press(newChatButton);
    expect(mockHandleNewChat).toHaveBeenCalled();
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

  it('finishing an entry navigates to Entry Reflection with entryId', async () => {
    mockMessages = [{ id: 'm1', role: 'user', content: 'Today was a lot.', timestamp: 1 }];
    mockCreate.mockResolvedValue({
      id: 'entry-999',
      title: 'Test',
      emoji: '📝',
      messages: mockMessages,
      status: 'completed',
      createdAt: 1,
      updatedAt: 1,
    });

    render(<ChatScreen />);

    fireEvent.press(screen.getByText('Finish entry'));

    await waitFor(() => {
      expect(mockRouterReplace).toHaveBeenCalledWith({
        pathname: '/entry-reflection',
        params: { entryId: 'entry-999' },
      });
    });

    expect(mockHandleNewChat).toHaveBeenCalled();
  });
});
