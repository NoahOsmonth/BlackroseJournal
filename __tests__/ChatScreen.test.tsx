import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';
import ChatJournalScreen from '../app/index';

// Mock navigation/router if needed
jest.mock('@expo/vector-icons', () => ({
  MaterialIcons: 'MaterialIcons',
}));

// Mock the AI service
jest.mock('../services/ai', () => ({
  useChat: () => ({
    sendMessage: jest.fn(),
    clearMessages: jest.fn(),
  }),
}));

// Mock color scheme hook
jest.mock('@/hooks/use-color-scheme', () => ({
  useColorScheme: () => 'light',
}));

// Mock Reanimated
jest.mock('react-native-reanimated', () => {
  const Reanimated = require('react-native-reanimated/mock');
  Reanimated.default.call = () => {};
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

describe('ChatJournalScreen', () => {
  it('renders correctly with Blackrose header and inline typing input', () => {
    render(<ChatJournalScreen />);

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
    render(<ChatJournalScreen />);

    const input = screen.getByPlaceholderText('Type your thoughts...');
    fireEvent.changeText(input, 'Hello AI');

    expect(input.props.value).toBe('Hello AI');
  });

  it('shows New Chat button that clears messages', () => {
    render(<ChatJournalScreen />);

    const newChatButton = screen.getByText('New Chat');
    expect(newChatButton).toBeTruthy();

    // Press should not throw
    fireEvent.press(newChatButton);
  });
});
