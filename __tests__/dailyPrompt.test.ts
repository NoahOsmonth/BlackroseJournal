import {
    DAILY_PROMPTS,
    getCurrentPromptPeriod,
    PromptPeriod,
    selectDailyPrompt
} from '@/constants/dailyPrompts';

describe('dailyPrompts', () => {
    describe('selectDailyPrompt', () => {
        it('returns morning prompt between 5am and 11am', () => {
            const morningDates = [
                new Date(2025, 0, 19, 5, 0),   // 5am
                new Date(2025, 0, 19, 8, 30),  // 8:30am
                new Date(2025, 0, 19, 11, 0),  // 11am
            ];

            morningDates.forEach(date => {
                const prompt = selectDailyPrompt(date);
                expect(prompt.period).toBe('morning');
                expect(prompt.title).toBe('Morning Reflection');
            });
        });

        it('returns afternoon prompt between 12pm and 4pm', () => {
            const afternoonDates = [
                new Date(2025, 0, 19, 12, 0),  // 12pm
                new Date(2025, 0, 19, 14, 30), // 2:30pm
                new Date(2025, 0, 19, 16, 0),  // 4pm
            ];

            afternoonDates.forEach(date => {
                const prompt = selectDailyPrompt(date);
                expect(prompt.period).toBe('afternoon');
                expect(prompt.title).toBe('Afternoon Check-in');
            });
        });

        it('returns evening prompt between 5pm and 9pm', () => {
            const eveningDates = [
                new Date(2025, 0, 19, 17, 0),  // 5pm
                new Date(2025, 0, 19, 19, 30), // 7:30pm
                new Date(2025, 0, 19, 21, 0),  // 9pm
            ];

            eveningDates.forEach(date => {
                const prompt = selectDailyPrompt(date);
                expect(prompt.period).toBe('evening');
                expect(prompt.title).toBe('Evening Reflection');
            });
        });

        it('returns night prompt between 10pm and 4am', () => {
            const nightDates = [
                new Date(2025, 0, 19, 22, 0),  // 10pm
                new Date(2025, 0, 19, 23, 30), // 11:30pm
                new Date(2025, 0, 19, 0, 0),   // 12am (midnight)
                new Date(2025, 0, 19, 2, 30),  // 2:30am
                new Date(2025, 0, 19, 4, 0),   // 4am
            ];

            nightDates.forEach(date => {
                const prompt = selectDailyPrompt(date);
                expect(prompt.period).toBe('night');
                expect(prompt.title).toBe('Night Wind-down');
            });
        });

        it('each prompt has required fields', () => {
            const periods: PromptPeriod[] = ['morning', 'afternoon', 'evening', 'night'];

            periods.forEach(period => {
                const prompt = DAILY_PROMPTS[period];
                expect(prompt.period).toBe(period);
                expect(prompt.title).toBeTruthy();
                expect(prompt.promptText).toBeTruthy();
                expect(prompt.aiFollowUp).toBeTruthy();
            });
        });
    });

    describe('getCurrentPromptPeriod', () => {
        it('returns the correct period', () => {
            const morningDate = new Date(2025, 0, 19, 8, 0);
            expect(getCurrentPromptPeriod(morningDate)).toBe('morning');

            const afternoonDate = new Date(2025, 0, 19, 14, 0);
            expect(getCurrentPromptPeriod(afternoonDate)).toBe('afternoon');

            const eveningDate = new Date(2025, 0, 19, 19, 0);
            expect(getCurrentPromptPeriod(eveningDate)).toBe('evening');

            const nightDate = new Date(2025, 0, 19, 23, 0);
            expect(getCurrentPromptPeriod(nightDate)).toBe('night');
        });
    });

    describe('boundary conditions', () => {
        it('handles 4:59am (end of night)', () => {
            const date = new Date(2025, 0, 19, 4, 59);
            const prompt = selectDailyPrompt(date);
            expect(prompt.period).toBe('night');
        });

        it('handles 5:00am (start of morning)', () => {
            const date = new Date(2025, 0, 19, 5, 0);
            const prompt = selectDailyPrompt(date);
            expect(prompt.period).toBe('morning');
        });

        it('handles 11:59am (end of morning)', () => {
            const date = new Date(2025, 0, 19, 11, 59);
            const prompt = selectDailyPrompt(date);
            expect(prompt.period).toBe('morning');
        });

        it('handles 12:00pm (start of afternoon)', () => {
            const date = new Date(2025, 0, 19, 12, 0);
            const prompt = selectDailyPrompt(date);
            expect(prompt.period).toBe('afternoon');
        });

        it('handles 16:59 (end of afternoon)', () => {
            const date = new Date(2025, 0, 19, 16, 59);
            const prompt = selectDailyPrompt(date);
            expect(prompt.period).toBe('afternoon');
        });

        it('handles 17:00 (start of evening)', () => {
            const date = new Date(2025, 0, 19, 17, 0);
            const prompt = selectDailyPrompt(date);
            expect(prompt.period).toBe('evening');
        });

        it('handles 21:59 (end of evening)', () => {
            const date = new Date(2025, 0, 19, 21, 59);
            const prompt = selectDailyPrompt(date);
            expect(prompt.period).toBe('evening');
        });

        it('handles 22:00 (start of night)', () => {
            const date = new Date(2025, 0, 19, 22, 0);
            const prompt = selectDailyPrompt(date);
            expect(prompt.period).toBe('night');
        });
    });
});
