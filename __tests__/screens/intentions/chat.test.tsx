/* eslint-disable import/first */

import React from 'react';
import { render } from '@testing-library/react-native';

const mockUseChatOrchestration = jest.fn();
const mockReplace = jest.fn();

jest.mock('expo-router', () => ({
    useRouter: () => ({ replace: mockReplace }),
    useLocalSearchParams: () => ({ intentionId: 'int-1' }),
}));

jest.mock('react-native-safe-area-context', () => ({
    SafeAreaView: ({ children }: { children: React.ReactNode }) => {
        const { View } = jest.requireActual('react-native');
        return <View>{children}</View>;
    },
    useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

jest.mock('@/hooks/settings/useChatModelPicker', () => ({
    useChatModelPicker: () => ({
        visible: false,
        open: jest.fn(),
        close: jest.fn(),
        models: [],
        recentModels: [],
        selectedModelId: null,
        freeOnly: true,
        hostLabel: 'openrouter.ai',
        hasApiKey: true,
        isLoading: false,
        isFetching: false,
        error: null,
        selectModel: jest.fn(),
        refreshModels: jest.fn(),
        openSettings: jest.fn(),
    }),
}));

jest.mock('@/components/ai/ChatModelPickerSheet', () => ({
    ChatModelPickerSheet: () => null,
}));

jest.mock('@/components/intentions/IntentionChatHeader', () => ({
    IntentionChatHeader: () => null,
}));

jest.mock('@/components/intentions/IntentionChatBody', () => ({
    IntentionChatBody: () => null,
}));

jest.mock('@/components/intentions/IntentionChatFooter', () => ({
    IntentionChatFooter: () => null,
}));

jest.mock('@/components/intentions/IntentionChatOverlays', () => ({
    IntentionChatOverlays: () => null,
}));

jest.mock('@/features/chat', () => ({
    flowForCheckInType: () => ({ id: 'intention', buildSystemPrompt: () => 'system prompt' }),
    useChatOrchestration: (...args: unknown[]) => {
        mockUseChatOrchestration(...args);
        return {
            messages: [],
            streamingMessage: null,
            isLoading: false,
            errorMessage: null,
            canRetry: false,
            handleSendMessage: jest.fn(),
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

jest.mock('@/hooks/feedback/useAiFeedback', () => ({
    useAiFeedback: () => ({ guidance: 'feedback', feedbackByMessageId: {}, save: jest.fn(), isLoading: false }),
}));

jest.mock('@/hooks/feedback/useIntentionFeedbackModal', () => ({
    useIntentionFeedbackModal: () => ({ handleThumb: jest.fn(), feedbackModalProps: {} }),
}));

jest.mock('@/hooks/goals/useGoalsContext', () => ({
    useGoalsContext: ({ intentionId }: { intentionId?: string }) => ({
        goalsContext: `## User's Current Goals and Habits\n- Linked goal (intention ${intentionId})`,
    }),
}));

jest.mock('@/hooks/intentions/useIntentionChatFlowContext', () => ({
    useIntentionChatFlowContext: () => ({
        flow: { id: 'intention', buildSystemPrompt: () => 'system prompt' },
        flowContext: {
            goalsContext: "## User's Current Goals and Habits\n- Linked goal (intention int-1)",
        },
        goalsContext: "## User's Current Goals and Habits\n- Linked goal (intention int-1)",
        localMemoryContext: '## Memory',
        recentDaysContext: undefined,
    }),
}));

jest.mock('@/hooks/intentions/useIntentionCheckIns', () => ({
    useIntentionCheckIns: () => ({ completed: [] }),
}));

jest.mock('@/hooks/personas/usePersonas', () => ({
    usePersonas: () => ({ personas: [], activePersona: null, setActive: jest.fn(), remove: jest.fn(), isLoading: false }),
}));

jest.mock('@/hooks/personas/usePersonaSettingsActions', () => ({
    usePersonaSettingsActions: () => ({ openActiveSettings: jest.fn() }),
}));

jest.mock('@/services/ai', () => ({
    generateEntryTitle: jest.fn(),
}));

jest.mock('@/services/intentions/intentionsStorage', () => ({
    getCheckIn: jest.fn(() => Promise.resolve(null)),
    getIntention: jest.fn(() => Promise.resolve(null)),
}));

jest.mock('@/services/intentions/intentionChatCompletion', () => ({
    finishIntentionChat: jest.fn(),
    saveIntentionChatDraft: jest.fn(),
    withPendingInput: (messages: unknown[]) => messages,
}));

jest.mock('@/services/goals/goalsStorage', () => ({
    markIntentionGoalComplete: jest.fn(),
}));

jest.mock('@/services/ai/sessionStorage', () => ({
    removeSession: jest.fn(),
}));

jest.mock('@/utils/date', () => ({
    getLocalDateKey: () => '2026-06-13',
}));

import IntentionChatScreen from '../../../app/intentions/chat';

describe('IntentionChatScreen', () => {
    beforeEach(() => {
        mockUseChatOrchestration.mockClear();
    });

    it('passes goalsContext with intentionId to useChatOrchestration flowContext', () => {
        render(<IntentionChatScreen />);

        expect(mockUseChatOrchestration).toHaveBeenCalled();
        const call = mockUseChatOrchestration.mock.calls[0][0];
        expect(call.flowContext).toMatchObject({
            goalsContext: "## User's Current Goals and Habits\n- Linked goal (intention int-1)",
        });
    });
});
