import fs from 'fs';
import path from 'path';

import { relPosix } from '../mocks/repoPath';

/**
 * Wiring guard for the gentle writing goal. The screen needs many mocks to
 * render in Jest, so scan the real source instead.
 */
const root = path.resolve(__dirname, '..', '..');
const read = (file: string): string => fs.readFileSync(path.join(root, relPosix(root, path.join(root, file))), 'utf8');

describe('gentle writing goal wiring', () => {
    const screen = read('app/writing-goal.tsx');
    const layout = read('app/_layout.tsx');
    const insights = read('app/(tabs)/insights.tsx');
    const streakView = read('app/streak-view.tsx');
    const hook = read('hooks/insights/useWritingGoal.ts');
    const util = read('utils/writingGoal.ts');
    const service = read('services/goals/writingGoalSettings.ts');
    const backup = read('services/backup/localBackup.ts');
    const ownership = read('services/account/legacyDataOwnership.ts');
    const clear = read('hooks/journal/useClearJournalHistory.ts');
    const agents = read('AGENTS.md');

    it('registers the route in the root stack', () => {
        expect(layout).toContain('name="writing-goal"');
    });

    it('links from BOTH Insights and the streak screen with plain language', () => {
        for (const source of [insights, streakView]) {
            expect(source).toContain("router.push('/writing-goal')");
            expect(source).toContain('Set a gentle writing goal');
            expect(source).toContain('see-writing-goal');
        }
    });

    it('the screen reads progress through the hook, not a service directly', () => {
        expect(screen).toContain('useWritingGoal()');
        expect(screen).not.toContain('buildWritingGoalProgress(');
        expect(screen).not.toContain('getWritingGoalSettings(');
    });

    it('the hook uses already-loaded collections and one settings read', () => {
        expect(hook).toContain('useJournalEntries()');
        expect(hook).toContain('useIntentionCheckIns()');
        expect(hook).toContain('getWritingGoalSettings()');
        expect(hook).toContain('subscribeWritingGoal(');
        expect(hook).toContain('buildWritingGoalProgress(records, settings, new Date())');
        expect(hook).not.toContain('listEntries(');
    });

    it('the util is pure: no I/O, no hooks, no clock read', () => {
        expect(util).not.toContain('AsyncStorage');
        expect(util).not.toContain('useState');
        expect(util).not.toContain('Date.now()');
        expect(util).toContain('today: Date');
    });

    it('the service owns its key with an envelope and a serialized queue', () => {
        expect(service).toContain("WRITING_GOAL_KEY = '@blackrose_writing_goal'");
        expect(service).toContain('schemaVersion');
        expect(service).toContain('mutationQueue');
        expect(service).toContain('subscribeWritingGoal');
        expect(service).toContain('clearWritingGoalSettings');
    });

    it('keeps strip cells readable and on the same coordinate system', () => {
        // Rounds 36/37: 4x4 px squares and a flex-1 header shipped broken.
        expect(screen).toContain('const CELL = 36;');
        expect(screen).toContain('style={{ width: CELL, height: CELL }}');
        const header = screen.slice(screen.indexOf("['S', 'M', 'T', 'W', 'T', 'F', 'S'].map"), screen.indexOf('progress.days.map'));
        expect(header).toContain('style={{ width: CELL }}');
        expect(header).not.toContain('flex-1');
        expect(screen).toContain('goal-strip');
    });

    it('couples the new key into backup, ownership, clear history, and AGENTS', () => {
        expect(backup.split('@blackrose_writing_goal').length - 1).toBe(2);
        expect(ownership).toContain('@blackrose_writing_goal');
        expect(clear).toContain('clearWritingGoalSettings');
        expect(clear).toContain("['writing goal', clearWritingGoalSettings]");
        expect(agents).toContain('| `@blackrose_writing_goal` | `services/goals/writingGoalSettings.ts` |');
    });

    it('offers plain-language presets and a rest-day explainer', () => {
        expect(screen).toContain('goal-words-');
        expect(screen).toContain('goal-rest-');
        expect(screen).toContain('How rest days work');
        expect(screen).not.toContain('space-y-');
        expect(screen).not.toContain('space-x-');
    });

    it('uses singular copy when one rest day is left', () => {
        // Live QA caught "1 rest days left" on the streak screen.
        expect(screen).toContain("progress.restDaysLeftThisWeek === 1 ? 'rest day left' : 'rest days left'");
    });

    it('resolves source paths on any OS', () => {
        expect(relPosix(root, path.join(root, 'app/writing-goal.tsx'))).toBe('app/writing-goal.tsx');
        expect(relPosix(root, path.join(root, 'app/(tabs)/insights.tsx'))).toBe('app/(tabs)/insights.tsx');
    });
});
