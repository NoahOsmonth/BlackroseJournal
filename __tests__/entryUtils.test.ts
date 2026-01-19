/**
 * Entry Utils Tests
 */

import { generateTitle, hasContent, inferMoodEmoji } from '../hooks/useEntryUtils';
import { Message } from '../services/ai';

const createMessage = (role: 'user' | 'assistant', content: string): Message => ({
    id: Date.now().toString(),
    role,
    content,
    timestamp: Date.now(),
});

describe('generateTitle', () => {
    it('returns Untitled for empty messages', () => {
        expect(generateTitle([])).toBe('Untitled');
    });

    it('returns Untitled when no user messages', () => {
        const messages = [createMessage('assistant', 'Hello!')];
        expect(generateTitle(messages)).toBe('Untitled');
    });

    it('returns short user message as-is', () => {
        const messages = [createMessage('user', 'I feel great today')];
        expect(generateTitle(messages)).toBe('I feel great today');
    });

    it('truncates long messages at word boundary', () => {
        const longText = 'This is a very long message that exceeds the fifty character limit we have set';
        const messages = [createMessage('user', longText)];
        const title = generateTitle(messages);
        expect(title.length).toBeLessThanOrEqual(53); // 50 + '...'
        expect(title.endsWith('...')).toBe(true);
    });

    it('uses first user message', () => {
        const messages = [
            createMessage('assistant', 'Welcome!'),
            createMessage('user', 'First message'),
            createMessage('user', 'Second message'),
        ];
        expect(generateTitle(messages)).toBe('First message');
    });
});

describe('inferMoodEmoji', () => {
    it('returns default emoji for neutral content', () => {
        const messages = [createMessage('user', 'Just checking in')];
        expect(inferMoodEmoji(messages)).toBe('📝');
    });

    it('detects happy mood', () => {
        const messages = [createMessage('user', 'I am so happy today!')];
        expect(inferMoodEmoji(messages)).toBe('🥳');
    });

    it('detects stressed mood', () => {
        const messages = [createMessage('user', 'Feeling overwhelmed with work')];
        expect(inferMoodEmoji(messages)).toBe('😰');
    });

    it('detects sad mood', () => {
        const messages = [createMessage('user', 'I miss my friend')];
        expect(inferMoodEmoji(messages)).toBe('😢');
    });

    it('checks all messages', () => {
        const messages = [
            createMessage('user', 'Hello'),
            createMessage('assistant', 'How are you?'),
            createMessage('user', 'I am excited about tomorrow!'),
        ];
        expect(inferMoodEmoji(messages)).toBe('🥳');
    });
});

describe('hasContent', () => {
    it('returns false for empty messages', () => {
        expect(hasContent([])).toBe(false);
    });

    it('returns false when only assistant messages', () => {
        const messages = [createMessage('assistant', 'Welcome!')];
        expect(hasContent(messages)).toBe(false);
    });

    it('returns false when user message is empty', () => {
        const messages = [createMessage('user', '   ')];
        expect(hasContent(messages)).toBe(false);
    });

    it('returns true when user has content', () => {
        const messages = [createMessage('user', 'Hello there')];
        expect(hasContent(messages)).toBe(true);
    });
});
