/* eslint-disable import/first */

/**
 * Regression guard: long-pressing the write control must open the radial menu
 * WITHOUT also firing the plain tap. Previously the Pressable under the
 * GestureDetector still received the release, so the menu appeared for a frame
 * and the app navigated straight to the journal chat.
 */

import { act, fireEvent, render, screen } from '@testing-library/react-native';
import React from 'react';

import { mockReanimated } from '../mocks/reanimatedMock';

jest.mock('react-native-reanimated', () => mockReanimated());

jest.mock('@expo/vector-icons', () => ({ MaterialIcons: () => null }));

jest.mock('react-native-safe-area-context', () => ({
    useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

jest.mock('expo-haptics', () => ({
    impactAsync: jest.fn(),
    notificationAsync: jest.fn(),
    ImpactFeedbackStyle: { Medium: 'medium', Heavy: 'heavy' },
}));

const mockPush = jest.fn();
jest.mock('expo-router', () => ({ useRouter: () => ({ push: mockPush }) }));

jest.mock('@/hooks/theme/use-color-scheme', () => ({ useColorScheme: () => 'light' }));
jest.mock('@/hooks/theme/useThemeSettings', () => ({
    useThemeSettings: () => ({
        colorTheme: { colors: { accentLight: '#000000', accentDark: '#FFFFFF' } },
    }),
}));

// Capture the long-press handler so the test can fire it directly, the way
// react-native-gesture-handler would after 400ms of held touch.
const mockGestureHandlers: { onStart?: () => void } = {};
jest.mock('react-native-gesture-handler', () => {
    const builder = {
        minDuration: () => builder,
        onStart: (fn: () => void) => {
            mockGestureHandlers.onStart = fn;
            return builder;
        },
    };
    return {
        GestureDetector: ({ children }: { children: React.ReactNode }) => children,
        Gesture: { LongPress: () => builder },
    };
});

import { BottomNav } from '../../components/journal/BottomNav';

describe('BottomNav write control gestures', () => {
    beforeEach(() => {
        mockPush.mockClear();
        mockGestureHandlers.onStart = undefined;
    });

    it('does not fire the plain tap when the long press opened the radial menu', () => {
        const onFabPress = jest.fn();
        render(<BottomNav activeTab="today" onTabPress={jest.fn()} onFabPress={onFabPress} />);

        expect(typeof mockGestureHandlers.onStart).toBe('function');
        mockGestureHandlers.onStart?.();

        // The release that ends the long press still reaches the Pressable.
        fireEvent.press(screen.getByLabelText('Write new entry'));

        expect(onFabPress).not.toHaveBeenCalled();
        expect(mockPush).not.toHaveBeenCalled();
    });

    it('still fires the plain tap for a normal press', () => {
        const onFabPress = jest.fn();
        render(<BottomNav activeTab="today" onTabPress={jest.fn()} onFabPress={onFabPress} />);

        fireEvent.press(screen.getByLabelText('Write new entry'));
        expect(onFabPress).toHaveBeenCalledTimes(1);
    });

    it('recovers after a long press so the next tap writes again', () => {
        const onFabPress = jest.fn();
        render(<BottomNav activeTab="today" onTabPress={jest.fn()} onFabPress={onFabPress} />);

        mockGestureHandlers.onStart?.();
        fireEvent.press(screen.getByLabelText('Write new entry'));
        expect(onFabPress).not.toHaveBeenCalled();

        fireEvent.press(screen.getByLabelText('Write new entry'));
        expect(onFabPress).toHaveBeenCalledTimes(1);
    });

    it('anchors the write stack above the measured dock, with a safe fallback', () => {
        render(<BottomNav activeTab="today" onTabPress={jest.fn()} onFabPress={jest.fn()} />);

        const anchorBottom = () => {
            const style = [screen.getByTestId('write-actions-anchor').props.style]
                .flat(3)
                .filter(Boolean);
            return (style.find((entry) => entry && 'bottom' in entry) as { bottom: number })
                .bottom;
        };

        // No layout pass yet: the fallback still clears the dock.
        act(() => {
            mockGestureHandlers.onStart?.();
        });
        expect(anchorBottom()).toBe(76);

        // Dock reports its height (60) -> the stack sits 12px above it.
        fireEvent(screen.getByTestId('bottom-nav-dock'), 'layout', {
            nativeEvent: { layout: { x: 0, y: 0, width: 390, height: 60 } },
        });
        expect(anchorBottom()).toBe(72);
    });

    it('routes to the memory graph from the radial menu', () => {
        render(<BottomNav activeTab="today" onTabPress={jest.fn()} onFabPress={jest.fn()} />);

        act(() => {
            mockGestureHandlers.onStart?.();
        });
        fireEvent.press(screen.getByLabelText('Memory'));

        expect(mockPush).toHaveBeenCalledWith('/memory-graph');
    });
});
