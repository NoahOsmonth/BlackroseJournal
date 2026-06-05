export interface EntryReflectionSuggestion {
    type: 'HABIT';
    text: string;
}

export interface EntryReflectionResult {
    reflection: string;
    keyInsight: string;
    suggestions: EntryReflectionSuggestion[];
}

export interface WeeklyInsightsEntry {
    messages: { content: string }[];
}

export interface WeeklyInsightsEmotion {
    emotion: string;
    score: number;
    emoji: string;
}

export interface WeeklyInsightsResult {
    emotionalLandscape: WeeklyInsightsEmotion[];
    keyThemes: string[];
    castOfCharacters: string[];
    weeklySummary: string;
}

export type StreakHaiku = [string, string, string];
