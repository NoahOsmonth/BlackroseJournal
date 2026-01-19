/**
 * Achievements Definitions
 * Defines all achievements with their thresholds
 */

export interface Achievement {
    id: string;
    title: string;
    description: string;
    icon: string;
    category: 'streak' | 'entries' | 'words' | 'special';
    threshold: number;
}

export const ACHIEVEMENTS: Achievement[] = [
    // Streak achievements
    {
        id: 'streak-3',
        title: 'Getting Started',
        description: 'Journal for 3 days in a row',
        icon: '🌱',
        category: 'streak',
        threshold: 3,
    },
    {
        id: 'streak-7',
        title: 'Week Warrior',
        description: 'Journal for 7 days in a row',
        icon: '🔥',
        category: 'streak',
        threshold: 7,
    },
    {
        id: 'streak-30',
        title: 'Monthly Master',
        description: 'Journal for 30 days in a row',
        icon: '⭐',
        category: 'streak',
        threshold: 30,
    },
    {
        id: 'streak-100',
        title: 'Century Club',
        description: 'Journal for 100 days in a row',
        icon: '💎',
        category: 'streak',
        threshold: 100,
    },
    // Entry achievements
    {
        id: 'entries-5',
        title: 'First Steps',
        description: 'Write 5 journal entries',
        icon: '📝',
        category: 'entries',
        threshold: 5,
    },
    {
        id: 'entries-25',
        title: 'Reflector',
        description: 'Write 25 journal entries',
        icon: '📚',
        category: 'entries',
        threshold: 25,
    },
    {
        id: 'entries-100',
        title: 'Chronicler',
        description: 'Write 100 journal entries',
        icon: '🏆',
        category: 'entries',
        threshold: 100,
    },
    // Word achievements
    {
        id: 'words-1000',
        title: 'Wordsmith',
        description: 'Write 1,000 words total',
        icon: '✍️',
        category: 'words',
        threshold: 1000,
    },
    {
        id: 'words-10000',
        title: 'Author',
        description: 'Write 10,000 words total',
        icon: '📖',
        category: 'words',
        threshold: 10000,
    },
    {
        id: 'words-50000',
        title: 'Novelist',
        description: 'Write 50,000 words total',
        icon: '📕',
        category: 'words',
        threshold: 50000,
    },
];
