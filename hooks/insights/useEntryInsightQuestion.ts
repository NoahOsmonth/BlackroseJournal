import { useCallback, useEffect, useMemo, useState } from 'react';
import { JournalEntry } from '@/services/journal/journalStorage.types';
import { getLocalDateKey } from '@/utils/date';

const PROMPTS = [
    'What activities could help you recharge and regain energy?',
    'What small win from today deserves more credit?',
    'Where did you feel most grounded this week?',
    'What would make tomorrow feel 10% lighter?',
    'Which moment deserves a gentle reframe?',
];

function countWords(entries: JournalEntry[]): number {
    return entries.reduce((total, entry) => {
        const count = entry.messages
            .filter((m) => m.role === 'user')
            .reduce((sum, m) => sum + m.content.split(/\s+/).filter(Boolean).length, 0);
        return total + count;
    }, 0);
}

export interface EntryInsightQuestion {
    question: string;
    sourceDate: string;
}

export function useEntryInsightQuestion(entries: JournalEntry[]) {
    const wordCount = useMemo(() => countWords(entries), [entries]);
    const baseIndex = useMemo(
        () => (entries.length + wordCount) % PROMPTS.length,
        [entries.length, wordCount]
    );

    const [index, setIndex] = useState(baseIndex);

    useEffect(() => {
        setIndex(baseIndex);
    }, [baseIndex]);

    const refresh = useCallback(() => {
        setIndex((prev) => (prev + 1) % PROMPTS.length);
    }, []);

    const question = PROMPTS[index] ?? PROMPTS[0];
    const sourceDate = getLocalDateKey(new Date());

    return {
        question,
        sourceDate,
        refresh,
    };
}
