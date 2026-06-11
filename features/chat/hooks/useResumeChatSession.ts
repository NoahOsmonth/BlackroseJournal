/**
 * useResumeChatSession
 *
 * When a `resume` route param is present, loads the autosaved session and
 * restores its messages into the chat. The conversationId is already aligned via
 * the resume param, so backend long-term memory re-links automatically.
 *
 * `onPersona` lets a surface re-activate the session's persona before restoring
 * messages (used by the intentions chat).
 */

import { useEffect } from 'react';
import type { Message } from '../../../services/ai';
import { getSession } from '../../../services/ai/sessionStorage';

export interface ResumeChatSessionOptions {
    resumeId: string | undefined;
    initializeMessages: (messages: Message[]) => void;
    onPersona?: (personaId: string) => Promise<void> | void;
}

export function useResumeChatSession({
    resumeId,
    initializeMessages,
    onPersona,
}: ResumeChatSessionOptions): void {
    useEffect(() => {
        if (!resumeId) return;
        let isActive = true;
        const restore = async () => {
            const session = await getSession(resumeId);
            if (!isActive || !session || session.messages.length === 0) return;
            if (session.personaId && onPersona) {
                await onPersona(session.personaId);
            }
            initializeMessages(session.messages);
        };
        restore();
        return () => {
            isActive = false;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [resumeId, initializeMessages]);
}
