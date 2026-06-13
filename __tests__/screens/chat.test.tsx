/* eslint-disable import/first */

import React from 'react';
import { render } from '@testing-library/react-native';

const mockUseChatOrchestration = jest.fn();
const mockReplace = jest.fn();

jest.mock('expo-router', () => ({
    useRouter: () => ({ replace: mockReplace }),
    useLocalSearchParams: () => ({}),
}));

jest.mock('react-native-safe-area-context', () => ({
    SafeAreaView: ({ children }: { children: React.ReactNode }) => {
        const { View } = jest.requireActual('react-native');
        return <View>{children}</View>;
    },
}));

jest.mock('../../components/ChatMessage', () => ({
    ChatMessage: () => null,
}));

jest.mock('../../components/FooterActions', () => ({
    FooterActions: () => null,
}));

jest.mock('../../components/Header', () => ({
    Header: () => null,
}));

jest.mock('../../components/InlineTypingInput', () => ({
    InlineTypingInput: jest.requireActual('react').forwardRef(function MockInlineTypingInput() {
        return null;
    }),
}));

jest.mock('../../components/personas/ChatPersonaSheet', () => ({
    ChatPersonaSheet: () => null,
}));

jest.mock('../../components/ui/TypingIndicator', () => ({
    TypingIndicator: () => null,
}));

jest.mock('../../features/chat', () => ({
    FLOWS: {
        freeform: { id: 'freeform' },
        continue: { id: 'continue' },
    },
    useChatOrchestration: (...args: unknown[]) => {
        mockUseChatOrchestration(...args);
        return {
            messages: [],
            streamingMessage: null,
            isLoading: false,
            errorMessage: null,
            canRetry: false,
            handleSendMessage: jest.fn(),
            retryLastMessage: jest.fn(),
            clearError: jest.fn(),
            handleNewChat: jest.fn(),
            initializeMessages: jest.fn(),
            clearPersistedSession: jest.fn(),
            scrollToBottom: jest.fn(),
            handleScroll: jest.fn(),
        };
    },
    useChatSessionFlush: () => ({ finalize: jest.fn() }),
    useResumeChatSession: () => {},
}));

jest.mock('../../hooks/feedback/useAiFeedback', () => ({
    useAiFeedback: () => ({ guidance: 'feedback' }),
}));

jest.mock('../../hooks/goals/useGoalsContext', () => ({
    useGoalsContext: () => ({ goalsContext: "## User's Current Goals and Habits\n- Test goal" }),
}));

jest.mock('../../hooks/memory/useLocalMemoryContext', () => ({
    useLocalMemoryContext: () => ({ context: '## Memory' }),
}));

jest.mock('../../hooks/personas/usePersonas', () => ({
    usePersonas: () => ({ personas: [], activePersona: null, setActive: jest.fn() }),
}));

jest.mock('../../hooks/useJournalEntries', () => ({
    useJournalEntries: () => ({ create: jest.fn(), update: jest.fn(), getById: jest.fn() }),
}));

jest.mock('../../services/ai', () => ({
    generateEntryTitle: jest.fn(),
    generateEntryAnalysis: jest.fn(),
}));

jest.mock('../../services/memory/localMemory', () => ({
    saveJournalEntryMemories: jest.fn(),
}));

import ChatScreen from '../../app/chat';

describe('ChatScreen', () => {
    beforeEach(() => {
        mockUseChatOrchestration.mockClear();
    });

    it('passes goalsContext to useChatOrchestration flowContext', () => {
        render(<ChatScreen />);

        expect(mockUseChatOrchestration).toHaveBeenCalled();
        const call = mockUseChatOrchestration.mock.calls[0][0];
        expect(call.flowContext).toMatchObject({
            goalsContext: "## User's Current Goals and Habits\n- Test goal",
        });
    });
});
