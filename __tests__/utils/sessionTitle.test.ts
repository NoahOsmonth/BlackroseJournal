import { sessionTitle } from '@/utils/sessionTitle';
import type { ChatSession } from '@/services/ai/sessionStorage';

function session(overrides: Partial<ChatSession> = {}): ChatSession {
    return {
        conversationId: 'chat_1',
        mode: 'intention',
        messages: [{ id: 'a1', role: 'assistant', content: 'Good morning. How are you arriving?' }],
        updatedAt: 1,
        createdAt: 1,
        ...overrides,
    } as ChatSession;
}

describe('sessionTitle', () => {
    it('prefers words still in the writing slip over the companion opener', () => {
        expect(sessionTitle(session({ composerDraft: '  My own quiet note.  ' }), 'Untitled chat'))
            .toBe('My own quiet note.');
    });

    it('falls back to the last transcript message when the slip is empty', () => {
        expect(sessionTitle(session({ composerDraft: '   ' }), 'Untitled chat'))
            .toBe('Good morning. How are you arriving?');
    });

    it('prefers the last writer message over an assistant reply', () => {
        const s = session({
            messages: [
                { id: 'u1', role: 'user', content: 'A hard day at work.', timestamp: 1 },
                { id: 'a1', role: 'assistant', content: 'Tell me more.', timestamp: 2 },
            ],
        });
        expect(sessionTitle(s, 'Untitled chat')).toBe('A hard day at work.');
    });

    it('uses the caller empty label when there is nothing written yet', () => {
        expect(sessionTitle(session({ messages: [] }), 'Tap to continue')).toBe('Tap to continue');
    });

    it('truncates a long slip at 80 characters', () => {
        const long = 'x'.repeat(95);
        expect(sessionTitle(session({ composerDraft: long }), 'Untitled chat'))
            .toBe(`${'x'.repeat(80)}...`);
    });
});
