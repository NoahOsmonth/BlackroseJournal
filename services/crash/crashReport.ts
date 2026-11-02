/**
 * Pure crash-report shaping: the text the user copies or downloads, and the
 * prefilled GitHub issue they can open. No I/O lives here.
 */

import { APP_ISSUE_URL, APP_NAME, APP_VERSION } from '@/constants/appInfo';
import type { CrashLogRecord, CrashLogState } from './crashLogStorage';

/** Keeps the prefilled issue URL well inside browser and GitHub limits. */
export const MAX_ISSUE_BODY_LENGTH = 1800;

const DAY_MS = 86_400_000;

function startOfDay(value: Date): number {
    return new Date(value.getFullYear(), value.getMonth(), value.getDate()).getTime();
}

/** `Today, 4:12 pm` / `Yesterday, 9:03 am` / `Oct 3, 11:40 am`. */
export function formatCrashTime(timestamp: number, now: Date = new Date()): string {
    const date = new Date(timestamp);
    const time = date
        .toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
        .toLowerCase();
    const dayDelta = Math.round((startOfDay(now) - startOfDay(date)) / DAY_MS);

    if (dayDelta === 0) return `Today, ${time}`;
    if (dayDelta === 1) return `Yesterday, ${time}`;
    const day = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    return `${day}, ${time}`;
}

export function countUnseenCrashes(state: CrashLogState): number {
    return state.records.filter((record) => record.createdAt > state.lastSeenAt).length;
}

export function buildCrashIssueTitle(record: CrashLogRecord): string {
    const firstLine = record.message.split('\n')[0]?.trim() ?? 'Unknown error';
    const trimmed = firstLine.length > 90 ? `${firstLine.slice(0, 90)}…` : firstLine;
    return `Crash: ${trimmed}`;
}

function describeRecord(record: CrashLogRecord, index: number): string {
    const lines = [
        `### ${index + 1}. ${record.message}`,
        `- When: ${new Date(record.createdAt).toISOString()}`,
        `- Where: ${record.component}${record.isFatal ? ' (fatal)' : ''}`,
        `- Platform: ${record.platform} · app ${record.appVersion}`,
    ];
    if (record.stack) {
        lines.push('```', record.stack, '```');
    }
    return lines.join('\n');
}

/** The plain-text payload behind Copy and Download. */
export function buildCrashReportText(records: readonly CrashLogRecord[]): string {
    if (records.length === 0) {
        return `${APP_NAME} v${APP_VERSION} — no crash logs recorded.`;
    }

    const header = [
        `${APP_NAME} crash logs`,
        `App version: ${APP_VERSION}`,
        `Crashes stored: ${records.length}`,
        `Exported: ${new Date().toISOString()}`,
        'Stored on this device only — nothing here was uploaded.',
    ].join('\n');

    return [header, ...records.map((record, index) => describeRecord(record, index))].join('\n\n');
}

/**
 * A prefilled GitHub issue. The body is trimmed so the encoded URL stays short
 * enough for every browser; the full log stays available through Copy/Download.
 */
export function buildCrashIssueUrl(records: readonly CrashLogRecord[]): string {
    const latest = records[0];
    const title = latest ? buildCrashIssueTitle(latest) : `${APP_NAME} crash report`;

    const details = records.length > 0
        ? buildCrashReportText(records)
        : `No crash logs were stored on this device.\n\nApp version: ${APP_VERSION}`;
    const body = details.length > MAX_ISSUE_BODY_LENGTH
        ? `${details.slice(0, MAX_ISSUE_BODY_LENGTH)}\n\n…truncated — the full log is available in Settings → Crash logs.`
        : details;

    const separator = APP_ISSUE_URL.includes('?') ? '&' : '?';
    return `${APP_ISSUE_URL}${separator}title=${encodeURIComponent(title)}&body=${encodeURIComponent(body)}&labels=bug`;
}
