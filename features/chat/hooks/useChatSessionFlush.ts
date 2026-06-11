/**
 * useChatSessionFlush
 *
 * Belt-and-suspenders lifecycle persistence for a chat surface. On blur (tab
 * switch / back gesture) and on unmount, the current messages are flushed to the
 * session store — covering the cases a fast unmount might race past the debounced
 * autosave inside useChatOrchestration.
 *
 * Call `finalize()` when the conversation is finished or explicitly closed so a
 * completed/discarded session is never resurrected by a late flush.
 */

import { useCallback, useEffect, useRef } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import type { Message } from '../../../services/ai';
import {
    ChatSessionMode,
    saveSession,
} from '../../../services/ai/sessionStorage';

export interface ChatSessionFlushOptions {
    conversationId: string;
    mode: ChatSessionMode;
    messages: Message[];
    personaId?: string;
    routeParams?: Record<string, string>;
}

export interface ChatSessionFlushControls {
    /** Suppress future blur/unmount flushes (call on finish/close). */
    finalize: () => void;
}

export function useChatSessionFlush({
    conversationId,
    mode,
    messages,
    personaId,
    routeParams,
}: ChatSessionFlushOptions): ChatSessionFlushControls {
    const messagesRef = useRef<Message[]>(messages);
    messagesRef.current = messages;
    const finalizedRef = useRef(false);

    const flush = useCallback(() => {
        if (finalizedRef.current) return;
        const current = messagesRef.current;
        if (current.length === 0) return;
        void saveSession({
            conversationId,
            mode,
            messages: current,
            personaId,
            routeParams,
            updatedAt: Date.now(),
            createdAt: Date.now(),
        });
    }, [conversationId, mode, personaId, routeParams]);

    useFocusEffect(
        useCallback(() => () => flush(), [flush])
    );

    // Unmount backup in case a hard unmount races past the focus cleanup.
    useEffect(() => () => flush(), [flush]);

    const finalize = useCallback(() => {
        finalizedRef.current = true;
    }, []);

    return { finalize };
}
