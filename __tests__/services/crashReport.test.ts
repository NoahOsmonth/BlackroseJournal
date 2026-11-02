import {
    MAX_ISSUE_BODY_LENGTH,
    buildCrashIssueTitle,
    buildCrashIssueUrl,
    buildCrashReportText,
    countUnseenCrashes,
    formatCrashTime,
} from '../../services/crash/crashReport';
import type { CrashLogRecord } from '../../services/crash/crashLogStorage';

function makeRecord(overrides: Partial<CrashLogRecord> = {}): CrashLogRecord {
    return {
        id: 'crash_1',
        message: 'Cannot read property of undefined',
        stack: 'Error: Cannot read property of undefined\n    at TodayScreen',
        component: 'globalHandler',
        isFatal: true,
        createdAt: new Date(2026, 5, 7, 10, 0).getTime(),
        appVersion: '0.1.0',
        platform: 'ios',
        ...overrides,
    };
}

describe('crashReport', () => {
    it('labels crash times relative to today', () => {
        const now = new Date(2026, 5, 7, 12, 0);

        expect(formatCrashTime(new Date(2026, 5, 7, 10, 0).getTime(), now))
            .toBe('Today, 10:00 am');
        expect(formatCrashTime(new Date(2026, 5, 6, 21, 5).getTime(), now))
            .toBe('Yesterday, 9:05 pm');
        expect(formatCrashTime(new Date(2026, 4, 3, 9, 5).getTime(), now))
            .toBe('May 3, 9:05 am');
    });

    it('counts only crashes the user has not opened yet', () => {
        const records = [
            makeRecord({ id: 'a', createdAt: 100 }),
            makeRecord({ id: 'b', createdAt: 300 }),
        ];

        expect(countUnseenCrashes({ records, lastSeenAt: 0 })).toBe(2);
        expect(countUnseenCrashes({ records, lastSeenAt: 200 })).toBe(1);
        expect(countUnseenCrashes({ records, lastSeenAt: 400 })).toBe(0);
    });

    it('builds a plain-text report with the stack and the on-device note', () => {
        const text = buildCrashReportText([makeRecord()]);

        expect(text).toContain('BlackroseJournal crash logs');
        expect(text).toContain('Stored on this device only');
        expect(text).toContain('Cannot read property of undefined');
        expect(text).toContain('at TodayScreen');
        expect(text).toContain('Platform: ios · app 0.1.0');
    });

    it('says so when there is nothing to report', () => {
        expect(buildCrashReportText([])).toContain('no crash logs recorded');
    });

    it('builds a prefilled GitHub issue URL', () => {
        const url = buildCrashIssueUrl([makeRecord()]);

        expect(url.startsWith('https://github.com/NoahOsmonth/BlackroseJournal/issues/new?')).toBe(true);
        expect(url).toContain('labels=bug');
        expect(decodeURIComponent(url)).toContain('Crash: Cannot read property of undefined');
        expect(decodeURIComponent(url)).toContain('at TodayScreen');
    });

    it('trims the issue body so the URL stays short enough to open', () => {
        const longStack = 'x'.repeat(MAX_ISSUE_BODY_LENGTH * 2);
        const url = buildCrashIssueUrl([makeRecord({ stack: longStack })]);
        const body = new URL(url).searchParams.get('body') ?? '';

        expect(body.length).toBeLessThanOrEqual(MAX_ISSUE_BODY_LENGTH + 120);
        expect(body).toContain('truncated');
    });

    it('keeps the issue title on one line and short', () => {
        const title = buildCrashIssueTitle(makeRecord({
            message: `First line\n${'z'.repeat(200)}`,
        }));

        expect(title.startsWith('Crash: First line')).toBe(true);
        expect(title).not.toContain('\n');
        expect(title.length).toBeLessThanOrEqual(100);
    });
});
