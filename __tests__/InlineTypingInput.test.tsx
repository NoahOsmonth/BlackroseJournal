import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { InlineTypingInput } from '../components/InlineTypingInput';

// Mock the hooks
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
    useSharedValue: (val: number) => ({ value: val }),
    useAnimatedStyle: () => ({}),
    withRepeat: (val: any) => val,
    withSequence: (val: any) => val,
    withTiming: (val: any) => val,
  };
});

describe('InlineTypingInput', () => {
  const mockOnSubmit = jest.fn();

  beforeEach(() => {
    mockOnSubmit.mockClear();
  });

  it('renders correctly with placeholder', () => {
    const { getByPlaceholderText } = render(
      <InlineTypingInput onSubmit={mockOnSubmit} placeholder="Type here..." />
    );

    expect(getByPlaceholderText('Type here...')).toBeTruthy();
  });

  it('renders with default placeholder when none provided', () => {
    const { getByPlaceholderText } = render(
      <InlineTypingInput onSubmit={mockOnSubmit} />
    );

    expect(getByPlaceholderText('Type your thoughts...')).toBeTruthy();
  });

  it('allows text input', () => {
    const { getByPlaceholderText } = render(
      <InlineTypingInput onSubmit={mockOnSubmit} />
    );

    const input = getByPlaceholderText('Type your thoughts...');
    fireEvent.changeText(input, 'Hello world');

    expect(input.props.value).toBe('Hello world');
  });

  it('notifies parent when text changes', () => {
    const mockOnTextChange = jest.fn();
    const { getByPlaceholderText } = render(
      <InlineTypingInput onSubmit={mockOnSubmit} onTextChange={mockOnTextChange} />
    );

    const input = getByPlaceholderText('Type your thoughts...');
    fireEvent.changeText(input, 'Hello');

    expect(mockOnTextChange).toHaveBeenCalledWith('Hello');
  });

  it('calls onSubmit with trimmed text on submit', () => {
    const { getByPlaceholderText } = render(
      <InlineTypingInput onSubmit={mockOnSubmit} />
    );

    const input = getByPlaceholderText('Type your thoughts...');
    fireEvent.changeText(input, '  Hello world  ');
    fireEvent(input, 'submitEditing');

    expect(mockOnSubmit).toHaveBeenCalledWith('Hello world');
  });

  it('does not call onSubmit with empty text', () => {
    const { getByPlaceholderText } = render(
      <InlineTypingInput onSubmit={mockOnSubmit} />
    );

    const input = getByPlaceholderText('Type your thoughts...');
    fireEvent.changeText(input, '   ');
    fireEvent(input, 'submitEditing');

    expect(mockOnSubmit).not.toHaveBeenCalled();
  });

  it('clears input after successful submit', () => {
    const { getByPlaceholderText } = render(
      <InlineTypingInput onSubmit={mockOnSubmit} />
    );

    const input = getByPlaceholderText('Type your thoughts...');
    fireEvent.changeText(input, 'Hello world');
    fireEvent(input, 'submitEditing');

    expect(input.props.value).toBe('');
  });

  it('does not allow input when disabled', () => {
    const { getByPlaceholderText } = render(
      <InlineTypingInput onSubmit={mockOnSubmit} disabled />
    );

    const input = getByPlaceholderText('Type your thoughts...');
    expect(input.props.editable).toBe(false);
  });

  it('does not submit when disabled', () => {
    const { getByPlaceholderText } = render(
      <InlineTypingInput onSubmit={mockOnSubmit} disabled />
    );

    const input = getByPlaceholderText('Type your thoughts...');
    fireEvent.changeText(input, 'Hello');
    fireEvent(input, 'submitEditing');

    expect(mockOnSubmit).not.toHaveBeenCalled();
  });
});
