import { getEntry, listEntries } from '@/services/journal/journalStorage';
import { getCheckIn, listCompletedCheckIns } from '@/services/intentions/intentionsStorage';
import { retrieveLocalMemories } from '@/services/memory/localMemory';
import {
    formatDayDigestForTool,
    getDayDigest,
    listDayDigests,
} from '@/services/memory/dayDigestStorage';
import {
    buildClockContext,
    getLocalDateKeyFromTimestamp,
    resolveRelativeDateKey,
} from '@/utils/date';
import type { ToolHandler } from './types';

const MAX_CONVERSATION_CHARS = 8000;
const MAX_SEARCH_HITS = 8;

function asString(value: unknown): string | undefined {
    return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function asNumber(value: unknown): number | undefined {
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (typeof value === 'string' && value.trim()) {
        const n = Number(value);
        return Number.isFinite(n) ? n : undefined;
    }
    return undefined;
}

function tokenize(text: string): string[] {
    return text
        .toLowerCase()
        .split(/\s+/)
        .map((t) => t.replace(/[^a-z0-9']/g, ''))
        .filter((t) => t.length > 2);
}

function formatMessages(
    messages: readonly { role?: string; content?: string }[] | undefined
): string {
    if (!messages?.length) return '(no messages)';
    const lines: string[] = [];
    let used = 0;
    for (const message of messages) {
        const role = message.role === 'assistant' ? 'assistant' : 'user';
        const content = typeof message.content === 'string' ? message.content.trim() : '';
        if (!content) continue;
        const line = `${role}: ${content}`;
        if (used + line.length > MAX_CONVERSATION_CHARS) {
            lines.push('…(truncated)');
            break;
        }
        lines.push(line);
        used += line.length;
    }
    return lines.join('\n') || '(no messages)';
}

export const getClockTool: ToolHandler = async () => buildClockContext(new Date());

export const listRecentDaysTool: ToolHandler = async (args) => {
    const days = Math.min(14, Math.max(1, Math.floor(asNumber(args.days) ?? 7)));
    const digests = await listDayDigests({ limit: days });
    if (digests.length === 0) {
        return 'No day digests on device yet. Completed journal entries and check-ins create digests when finished.';
    }
    return digests.map(formatDayDigestForTool).join('\n\n---\n\n');
};

export const getDayTool: ToolHandler = async (args) => {
    const dateInput = asString(args.date);
    if (!dateInput) return 'Error: date is required (YYYY-MM-DD, today, yesterday, or weekday).';
    const dateKey = resolveRelativeDateKey(dateInput) ?? ( /^\d{4}-\d{2}-\d{2}$/.test(dateInput) ? dateInput : null);
    if (!dateKey) return `Error: could not resolve date "${dateInput}".`;
    const digest = await getDayDigest(dateKey);
    if (!digest) {
        return `No digest for ${dateKey}. The user may not have finished any journal or check-in that day.`;
    }
    return formatDayDigestForTool(digest);
};

export const getConversationTool: ToolHandler = async (args) => {
    const kind = asString(args.kind);
    const id = asString(args.id);
    const dateInput = asString(args.date);
    const titleQuery = asString(args.titleQuery)?.toLowerCase();

    if (id && (kind === 'journal_entry' || kind === 'intention_checkin' || !kind)) {
        if (kind === 'intention_checkin') {
            const checkIn = await getCheckIn(id);
            if (!checkIn) return `No intention check-in with id ${id}.`;
            return [
                `kind: intention_checkin`,
                `id: ${checkIn.id}`,
                `title: ${checkIn.title}`,
                `type: ${checkIn.type}`,
                `date: ${getLocalDateKeyFromTimestamp(checkIn.createdAt)}`,
                'messages:',
                formatMessages(checkIn.messages),
            ].join('\n');
        }
        const entry = await getEntry(id);
        if (entry) {
            return [
                `kind: journal_entry`,
                `id: ${entry.id}`,
                `title: ${entry.title}`,
                `status: ${entry.status}`,
                `date: ${getLocalDateKeyFromTimestamp(entry.createdAt)}`,
                'messages:',
                formatMessages(entry.messages),
            ].join('\n');
        }
        const checkIn = await getCheckIn(id);
        if (checkIn) {
            return [
                `kind: intention_checkin`,
                `id: ${checkIn.id}`,
                `title: ${checkIn.title}`,
                `type: ${checkIn.type}`,
                `date: ${getLocalDateKeyFromTimestamp(checkIn.createdAt)}`,
                'messages:',
                formatMessages(checkIn.messages),
            ].join('\n');
        }
        return `No conversation found for id ${id}.`;
    }

    if (dateInput || titleQuery) {
        const dateKey = dateInput
            ? (resolveRelativeDateKey(dateInput) ?? (/^\d{4}-\d{2}-\d{2}$/.test(dateInput) ? dateInput : null))
            : null;
        if (dateInput && !dateKey) return `Error: could not resolve date "${dateInput}".`;

        const digest = dateKey ? await getDayDigest(dateKey) : null;
        if (digest) {
            const match = titleQuery
                ? digest.sources.find((s) => s.title.toLowerCase().includes(titleQuery))
                : digest.sources[0];
            if (match) {
                return getConversationTool({ kind: match.kind, id: match.id });
            }
        }

        // Fallback: scan completed entries/check-ins
        const entries = await listEntries('completed');
        for (const entry of entries) {
            if (dateKey && getLocalDateKeyFromTimestamp(entry.createdAt) !== dateKey) continue;
            if (titleQuery && !entry.title.toLowerCase().includes(titleQuery)) continue;
            return getConversationTool({ kind: 'journal_entry', id: entry.id });
        }
        const checkIns = await listCompletedCheckIns();
        for (const checkIn of checkIns) {
            if (dateKey && getLocalDateKeyFromTimestamp(checkIn.createdAt) !== dateKey) continue;
            if (titleQuery && !checkIn.title.toLowerCase().includes(titleQuery)) continue;
            return getConversationTool({ kind: 'intention_checkin', id: checkIn.id });
        }
        return 'No matching conversation found.';
    }

    return 'Error: provide kind+id, or date and/or titleQuery.';
};

export const searchHistoryTool: ToolHandler = async (args) => {
    const query = asString(args.query);
    if (!query) return 'Error: query is required.';
    const from = asString(args.from);
    const to = asString(args.to);
    const limit = Math.min(MAX_SEARCH_HITS, Math.max(1, Math.floor(asNumber(args.limit) ?? 6)));
    const tokens = tokenize(query);

    const digests = await listDayDigests({ from, to, limit: 60 });
    const scoredDigests = digests
        .map((digest) => {
            const hay = `${digest.summary} ${digest.topics.join(' ')} ${digest.sources.map((s) => s.title).join(' ')}`.toLowerCase();
            const score = tokens.reduce((acc, t) => acc + (hay.includes(t) ? 1 : 0), 0);
            return { digest, score };
        })
        .filter((row) => row.score > 0 || tokens.length === 0)
        .sort((a, b) => b.score - a.score || b.digest.dateKey.localeCompare(a.digest.dateKey))
        .slice(0, limit);

    const atoms = await retrieveLocalMemories({ query, limit });
    const atomLines = atoms
        .filter((atom) => {
            if (!from && !to) return true;
            const key = getLocalDateKeyFromTimestamp(atom.createdAt);
            if (from && key < from) return false;
            if (to && key > to) return false;
            return true;
        })
        .map((atom) => {
            const key = getLocalDateKeyFromTimestamp(atom.createdAt);
            return `- memory ${atom.layer} (${key}): ${atom.title} — ${atom.content.slice(0, 180)}`;
        });

    const digestLines = scoredDigests.map(
        ({ digest, score }) =>
            `- day ${digest.dateKey} (score ${score}): ${digest.summary.slice(0, 200)} | topics: ${digest.topics.join(', ') || 'none'}`
    );

    if (digestLines.length === 0 && atomLines.length === 0) {
        return `No history matches for "${query}".`;
    }

    return [
        `Search: ${query}`,
        digestLines.length ? `Day digests:\n${digestLines.join('\n')}` : undefined,
        atomLines.length ? `Memory atoms:\n${atomLines.join('\n')}` : undefined,
    ]
        .filter(Boolean)
        .join('\n\n');
};
