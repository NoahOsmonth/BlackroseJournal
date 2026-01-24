import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import IntentionChatScreen from '../../app/intentions/chat';

const mockSpeak = jest.fn();
const mockStop = jest.fn();

jest.mock('expo-speech', () => ({
    speak: (...args: any[]) => mockSpeak(...args),
    stop: () => mockStop(),
}));

jest.mock('expo-router', () => ({
    useRouter: () => ({
        push: jest.fn(),
        replace: jest.fn(),
        back: jest.fn(),
    }),
    useLocalSearchParams: () => ({}),
}));

jest.mock('@expo/vector-icons', () => ({
    MaterialIcons: 'MaterialIcons',
}));

jest.mock('@/hooks/personas/usePersonas', () => ({
    usePersonas: () => ({
        personas: [],
        activePersona: { id: 'persona-1', name: 'Rosebud', prompt: '' },
        setActive: jest.fn(),
    }),
}));

jest.mock('@/hooks/intentions/useIntentionCheckIns', () => ({
    useIntentionCheckIns: () => ({
        completed: [],
    }),
}));

jest.mock('@/hooks/intentions/useIntentions', () => ({
    useIntentions: () => ({
        create: jest.fn(),
    }),
}));

jest.mock('@/services/intentions/intentionPrompts', () => ({
    buildIntentionSystemPrompt: () => 'prompt',
}));

jest.mock('@/services/intentions/intentionsStorage', () => ({
    getIntention: jest.fn(),
    getCheckIn: jest.fn(),
    createCheckIn: jest.fn(),
    updateCheckIn: jest.fn(),
}));

jest.mock('@/hooks/journal/useEntryUtils', () => ({
    hasContent: () => true,
}));

jest.mock('@/services/goals/goalsStorage', () => ({
    markIntentionGoalComplete: jest.fn(),
}));

jest.mock('@/features/chat', () => ({
    useChatOrchestration: () => ({
        messages: [
            {
                id: 'msg-1',
                role: 'assistant',
                content: 'Hello there',
                timestamp: Date.now(),
            },
        ],
        streamingMessage: null,
        isLoading: false,
        handleSendMessage: jest.fn(),
        clearError: jest.fn(),
        handleNewChat: jest.fn(),
        initializeMessages: jest.fn(),
        scrollToBottom: jest.fn(),
    }),
}));

jest.mock('react-native-safe-area-context', () => ({
    SafeAreaView: ({ children }: { children: React.ReactNode }) => children,
}));

describe('IntentionChatScreen', () => {
    beforeEach(() => {
        mockSpeak.mockClear();
        mockStop.mockClear();
    });

    it('mutes playback when toggled', () => {
        render(<IntentionChatScreen />);

        fireEvent.press(screen.getByLabelText('Play message'));
        expect(mockSpeak).toHaveBeenCalledTimes(1);

        fireEvent.press(screen.getByLabelText('Toggle volume'));
        expect(mockStop).toHaveBeenCalledTimes(1);

        fireEvent.press(screen.getByLabelText('Play message'));
        expect(mockSpeak).toHaveBeenCalledTimes(1);
    });
});
