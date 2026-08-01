import type { Message } from './chatTypes';

export interface TemporalMessageMetadata {
    timestamp: number;
    authoredTimezone: string | null;
    localDate: string | null;
    temporalProvenance: 'captured' | 'legacy_unknown';
}

export interface CreateTemporalMessageInput {
    id: string;
    role: Message['role'];
    content: string;
    reasoning?: string;
}

function resolvedTimeZone(): string | null {
    try {
        const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
        return timeZone || null;
    } catch {
        return null;
    }
}

function isIanaTimeZone(value: string): boolean {
    try {
        new Intl.DateTimeFormat('en-US', { timeZone: value });
        return true;
    } catch {
        return false;
    }
}

function dateInTimeZone(timestamp: number, timeZone: string): string | null {
    try {
        const parts = new Intl.DateTimeFormat('en-US', {
            timeZone,
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
        }).formatToParts(new Date(timestamp));
        const part = (type: Intl.DateTimeFormatPartTypes): string | undefined => (
            parts.find((item) => item.type === type)?.value
        );
        const year = part('year');
        const month = part('month');
        const day = part('day');
        return year && month && day ? `${year}-${month}-${day}` : null;
    } catch {
        return null;
    }
}

export function captureTemporalMessageMetadata(
    timestamp = Date.now(),
    timeZone = resolvedTimeZone(),
): TemporalMessageMetadata {
    if (!Number.isFinite(timestamp) || !timeZone) {
        return {
            timestamp,
            authoredTimezone: null,
            localDate: null,
            temporalProvenance: 'legacy_unknown',
        };
    }
    const localDate = dateInTimeZone(timestamp, timeZone);
    if (!localDate) {
        return {
            timestamp,
            authoredTimezone: null,
            localDate: null,
            temporalProvenance: 'legacy_unknown',
        };
    }
    return {
        timestamp,
        authoredTimezone: timeZone,
        localDate,
        temporalProvenance: 'captured',
    };
}

export function createTemporalMessage(input: CreateTemporalMessageInput): Message {
    return {
        ...input,
        ...captureTemporalMessageMetadata(),
    };
}

export function normalizeTemporalMessageMetadata(value: Record<string, unknown>): TemporalMessageMetadata {
    if (
        value.temporalProvenance === 'captured'
        && typeof value.authoredTimezone === 'string'
        && value.authoredTimezone.length > 0
        && isIanaTimeZone(value.authoredTimezone)
        && typeof value.localDate === 'string'
        && /^\d{4}-\d{2}-\d{2}$/.test(value.localDate)
        && typeof value.timestamp === 'number'
        && Number.isFinite(value.timestamp)
    ) {
        return {
            timestamp: value.timestamp,
            authoredTimezone: value.authoredTimezone,
            localDate: value.localDate,
            temporalProvenance: 'captured',
        };
    }
    return {
        timestamp: typeof value.timestamp === 'number' && Number.isFinite(value.timestamp)
            ? Math.floor(value.timestamp)
            : Date.now(),
        authoredTimezone: null,
        localDate: null,
        temporalProvenance: 'legacy_unknown',
    };
}
