import { Text, View } from 'react-native';

import type { WeekLedger } from '@/utils/thisWeek';
import { BLACKROSE_PALETTE } from '@/constants/blackrose';
import { useColorScheme } from '@/hooks/use-color-scheme';

const SERIF = { fontFamily: 'PlayfairDisplayRegular' } as const;

interface ThisWeekProps {
    ledger: WeekLedger;
    /** Navigate to the entry list for this week. */
    onOpenWeek: () => void;
}

/**
 * "What kept coming back" — the last seven days, counted. Kaneo #10.
 *
 * This is the week the writer already wrote, read back to them without scoring
 * or advice: a few words that appeared on more than one day. It stays out of
 * the way when there is nothing honest to say — no themes yet, or fewer than
 * two days of writing. A recap of one day is just that day.
 */
export function ThisWeek({ ledger, onOpenWeek }: ThisWeekProps) {
    const isDark = useColorScheme() === 'dark';
    const hasThemes = ledger.themes.length > 0;
    // A recap of one day is just that day: say nothing rather than invent a
    // pattern. An empty week is still worth one gentle line, not silence, so the
    // screen does not look like the feature is missing.
    if (!hasThemes && ledger.daysWritten === 1) return null;

    return (
        <View
            className="rounded-card border border-border-light dark:border-border-dark bg-surface-light dark:bg-surface-dark p-5 gap-3"
            aria-label="What kept coming back this week"
        >
            <Text className="text-[11px] uppercase tracking-[1.6px] text-text-secondary-light dark:text-text-secondary-dark">
                This week
            </Text>
            <Text className="text-[22px] text-text-light dark:text-white" style={SERIF}>
                What kept coming back
            </Text>

            {hasThemes ? (
                <View className="gap-2">
                    {ledger.themes.map((theme) => (
                        <View key={theme.label} className="flex-row items-baseline gap-2">
                            <Text className="text-[15px] text-text-light dark:text-white capitalize">
                                {theme.label}
                            </Text>
                            <Text className="text-[12px] text-text-secondary-light dark:text-text-secondary-dark">
                                {theme.days === 2 ? 'on 2 days' : `on ${theme.days} days`}
                            </Text>
                        </View>
                    ))}
                </View>
            ) : (
                <Text className="text-[14px] text-text-secondary-light dark:text-text-secondary-dark">
                    {ledger.daysWritten === 0
                        ? 'Nothing written this week yet. Anything you write shows up here.'
                        : 'No word came up twice yet. A few more days and the pattern will show.'}
                </Text>
            )}

            <Text
                className="text-[13px] text-text-secondary-light dark:text-text-secondary-dark"
                onPress={onOpenWeek}
                accessibilityRole="button"
                accessibilityLabel='See this week’s entries'
                style={{ color: isDark ? BLACKROSE_PALETTE.dark.accentStrong : BLACKROSE_PALETTE.light.accentStrong }}
            >
                {ledger.daysWritten === 1 ? 'Written on 1 day' : `Written on ${ledger.daysWritten} days`}
            </Text>
        </View>
    );
}
