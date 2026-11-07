import type { ChatSession } from '@/services/ai/sessionStorage';

/**
 * The line a person sees for an unfinished chat. Words still in the writing
 * slip are the freshest thing they wrote, so they win over the last transcript
 * message — an autosaved check-in otherwise shows the companion's opener
 * instead of the writer's own words. Pure formatter: no I/O, no hooks.
 */
export function sessionTitle(session: ChatSession, emptyLabel: string): string {
    const unsent = session.composerDraft?.trim() ?? '';
    const lastUser = [...session.messages].reverse().find((m) => m.role === 'user');
    const fallback = (lastUser ?? session.messages[session.messages.length - 1])?.content.trim() ?? '';
    const text = unsent || fallback;
    if (!text) return emptyLabel;
    return text.length > 80 ? `${text.slice(0, 80).trim()}...` : text;
}
