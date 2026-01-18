/**
 * Entry Utils
 * Utility functions for generating entry titles and emoji
 */

import { Message } from '../services/ai';

/**
 * Generate a title from the first user message
 */
export function generateTitle(messages: Message[]): string {
    const firstUserMessage = messages.find(m => m.role === 'user');
    if (!firstUserMessage) return 'Untitled';

    const text = firstUserMessage.content.trim();
    if (text.length <= 50) return text;

    // Truncate at word boundary
    const truncated = text.substring(0, 50);
    const lastSpace = truncated.lastIndexOf(' ');
    if (lastSpace > 25) {
        return truncated.substring(0, lastSpace) + '...';
    }
    return truncated + '...';
}

/**
 * Mood keyword to emoji mapping
 */
const moodPatterns: Array<{ pattern: RegExp; emoji: string }> = [
    { pattern: /\b(happy|joy|excited|great|amazing|wonderful|fantastic|blessed)\b/i, emoji: '🥳' },
    { pattern: /\b(sad|down|depressed|crying|tears|miss)\b/i, emoji: '😢' },
    { pattern: /\b(stressed|overwhelmed|anxious|anxiety|worried|nervous)\b/i, emoji: '😰' },
    { pattern: /\b(angry|frustrated|mad|annoyed|furious)\b/i, emoji: '😤' },
    { pattern: /\b(tired|exhausted|sleepy|drained|fatigue)\b/i, emoji: '😴' },
    { pattern: /\b(peaceful|calm|relaxed|content|serene)\b/i, emoji: '😌' },
    { pattern: /\b(confused|lost|uncertain|stuck|unsure)\b/i, emoji: '🤔' },
    { pattern: /\b(love|loved|loving|romantic|heart)\b/i, emoji: '❤️' },
    { pattern: /\b(work|project|job|career|office)\b/i, emoji: '💼' },
    { pattern: /\b(school|study|exam|finals|class|learn)\b/i, emoji: '📚' },
    { pattern: /\b(code|coding|program|developer|app)\b/i, emoji: '💻' },
    { pattern: /\b(hot|heat|summer|warm|sweating)\b/i, emoji: '🔥' },
    { pattern: /\b(sick|ill|health|doctor|pain)\b/i, emoji: '🤕' },
    { pattern: /\b(scared|fear|afraid|terrified)\b/i, emoji: '😨' },
    { pattern: /\b(grateful|thankful|appreciation)\b/i, emoji: '🙏' },
    { pattern: /\b(celebrate|celebration|party|birthday)\b/i, emoji: '🎉' },
    { pattern: /\b(game|gaming|play|fun)\b/i, emoji: '🎮' },
];

/**
 * Infer mood emoji from message content
 */
export function inferMoodEmoji(messages: Message[]): string {
    // Combine all message content
    const allContent = messages
        .map(m => m.content)
        .join(' ')
        .toLowerCase();

    // Check each pattern
    for (const { pattern, emoji } of moodPatterns) {
        if (pattern.test(allContent)) {
            return emoji;
        }
    }

    // Default emoji
    return '📝';
}

/**
 * Check if there's content worth saving
 */
export function hasContent(messages: Message[]): boolean {
    return messages.some(m => m.role === 'user' && m.content.trim().length > 0);
}
