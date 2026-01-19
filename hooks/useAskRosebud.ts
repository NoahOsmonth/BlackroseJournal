import { useCallback, useState } from 'react';
import { askRosebud } from '../services/askRosebud';
import { TimeRange } from '../services/supermemory';

export interface AskRosebudMessage {
    id: string;
    role: 'user' | 'assistant';
    content: string;
}

interface UseAskRosebudResult {
    messages: AskRosebudMessage[];
    isLoading: boolean;
    errorMessage: string | null;
    sendQuestion: (question: string, timeRange: TimeRange) => Promise<void>;
    clearMessages: () => void;
}

function buildMessage(role: 'user' | 'assistant', content: string): AskRosebudMessage {
    return {
        id: Date.now().toString(),
        role,
        content,
    };
}

export function useAskRosebud(): UseAskRosebudResult {
    const [messages, setMessages] = useState<AskRosebudMessage[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);

    const sendQuestion = useCallback(async (question: string, timeRange: TimeRange) => {
        const trimmed = question.trim();
        if (!trimmed || isLoading) {
            return;
        }

        setIsLoading(true);
        setErrorMessage(null);
        setMessages(prev => [...prev, buildMessage('user', trimmed)]);

        try {
            const response = await askRosebud(trimmed, timeRange);
            setMessages(prev => [...prev, buildMessage('assistant', response)]);
        } catch (error) {
            const fallback = 'I hit a snag while looking through your memories. Please try again.';
            setErrorMessage(fallback);
            setMessages(prev => [...prev, buildMessage('assistant', fallback)]);
        } finally {
            setIsLoading(false);
        }
    }, [isLoading]);

    const clearMessages = useCallback(() => {
        setMessages([]);
        setErrorMessage(null);
        setIsLoading(false);
    }, []);

    return {
        messages,
        isLoading,
        errorMessage,
        sendQuestion,
        clearMessages,
    };
}
