import { useMemo } from 'react';
import { useThisWeek } from '@/hooks/journal/useThisWeek';
import { personaliseShelf, promptsForDay, moodForHour, type GuidedPrompt } from '@/utils/guidedPrompts';

export interface UseGuidedPromptsReturn {
    readonly prompts: GuidedPrompt[];
    /** True when at least one prompt came from the writer's own week. */
    readonly isPersonalised: boolean;
}

/**
 * The shelf of starting points for Today (Kaneo #13, #52).
 *
 * Three prompts: mostly generic, chosen by day and hour, but the last one is
 * replaced by a prompt built from the theme the writer kept returning to this
 * week. Both halves are pure; this hook only supplies the theme.
 */
export function useGuidedPrompts(todayKey: string, hour: number): UseGuidedPromptsReturn {
    const { ledger } = useThisWeek();

    return useMemo(() => {
        const shelf = promptsForDay(todayKey, moodForHour(hour), 3);
        // Themes arrive already ranked by how many days mentioned them.
        const theme = ledger.themes[0]?.label;
        const prompts = personaliseShelf(shelf, theme);
        return {
            prompts,
            isPersonalised: prompts.some((prompt) => prompt.id.startsWith('theme-')),
        };
    }, [todayKey, hour, ledger.themes]);
}
