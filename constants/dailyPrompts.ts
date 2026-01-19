/**
 * Daily Prompts Configuration
 * Time-based prompts for daily check-in flow
 */

export type PromptPeriod = 'morning' | 'afternoon' | 'evening' | 'night';

export interface DailyPrompt {
    period: PromptPeriod;
    title: string;
    promptText: string;
    aiFollowUp: string;
}

/**
 * Daily prompts mapped to time periods
 * Morning: 5am-11am
 * Afternoon: 12pm-4pm
 * Evening: 5pm-9pm
 * Night: 10pm-4am
 */
export const DAILY_PROMPTS: Record<PromptPeriod, DailyPrompt> = {
    morning: {
        period: 'morning',
        title: 'Morning Reflection',
        promptText: 'How are you feeling this morning? What are your intentions for today?',
        aiFollowUp: "Good morning! 🌅 I'd love to hear how you're starting your day. How are you feeling right now, and what's on your mind as you begin this day?",
    },
    afternoon: {
        period: 'afternoon',
        title: 'Afternoon Check-in',
        promptText: 'How is your day going? Take a moment to reflect.',
        aiFollowUp: "Good afternoon! ☀️ You're in the middle of your day now. How are things going so far? What's been on your mind?",
    },
    evening: {
        period: 'evening',
        title: 'Evening Reflection',
        promptText: 'How was your day? Take a moment to reflect.',
        aiFollowUp: "Good evening! 🌆 As your day winds down, I'd love to hear how it went. What stood out to you today?",
    },
    night: {
        period: 'night',
        title: 'Night Wind-down',
        promptText: 'What are you grateful for today? Prepare for restful sleep.',
        aiFollowUp: "It's late and time to wind down. 🌙 Before you rest, what are you grateful for today? What would you like to release before sleep?",
    },
};

/**
 * Time windows for each prompt period (in 24-hour format)
 * Morning: 5am-11am (hours 5-11)
 * Afternoon: 12pm-4pm (hours 12-16)
 * Evening: 5pm-9pm (hours 17-21)
 * Night: 10pm-4am (hours 22-23, 0-4)
 */
export const TIME_WINDOWS: Record<PromptPeriod, { start: number; end: number }[]> = {
    morning: [{ start: 5, end: 11 }],
    afternoon: [{ start: 12, end: 16 }],
    evening: [{ start: 17, end: 21 }],
    night: [{ start: 22, end: 23 }, { start: 0, end: 4 }],
};

/**
 * Select the appropriate daily prompt based on the current hour
 * @param date - Date object to determine the hour (defaults to now)
 * @returns The appropriate DailyPrompt for the time of day
 */
export function selectDailyPrompt(date: Date = new Date()): DailyPrompt {
    const hour = date.getHours();

    for (const [period, windows] of Object.entries(TIME_WINDOWS) as [PromptPeriod, { start: number; end: number }[]][]) {
        for (const window of windows) {
            if (hour >= window.start && hour <= window.end) {
                return DAILY_PROMPTS[period];
            }
        }
    }

    // Fallback to evening (should not reach here if windows are complete)
    return DAILY_PROMPTS.evening;
}

/**
 * Get current prompt period
 * @param date - Date object to determine the hour
 * @returns The PromptPeriod for the time of day
 */
export function getCurrentPromptPeriod(date: Date = new Date()): PromptPeriod {
    return selectDailyPrompt(date).period;
}
