import type { JournalEntry } from '@/services/journal/journalStorage.types';
import type { IntentionCheckIn } from '@/services/intentions/intentionsStorage.types';
import type { Message } from '@/services/ai';
import { getLocalDateKeyFromTimestamp } from '@/utils/date';
import {
    hasStagedSession,
    stageTmpMemory,
} from './memoryFiles';
import type { MemoryFileRecord } from './memoryFiles';

/**
 * Finish-path `_tmp` staging (ClawX `_tmp` pattern).
 *
 * Deterministic and offline-safe: builds one project file per topic from
 * the entry's own analysis + user text. Dream (memoryDream.ts) promotes
 * staged files into formal threads. Never throws — finish paths must not
 * break on memory staging.
 */

const MAX_TOPICS = 3;

function userTextOf(messages: readonly Message[] | undefined): string {
    return (messages ?? [])
        .filter((m) => m.role === 'user')
        .map((m) => m.content)
        .join('\n\n')
        .trim();
}

function trimSection(value: string, max: number): string {
    const clean = value.trim().replace(/\s+/g, ' ');
    return clean.length > max ? `${clean.slice(0, max).trim()}…` : clean;
}

function slugTopic(topic: string): string {
    const slug = topic.toLowerCase().replace(/[^a-z0-9\u4e00-\u9fff]+/g, '-').replace(/^-+|-+$/g, '');
    return slug || 'general';
}

function titleCase(topic: string): string {
    return topic.trim().split(/[\s_-]+/).filter(Boolean)
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
        .join(' ');
}

/**
 * Stage a completed journal entry into `_tmp`. Idempotent per entry id:
 * re-running a finish never duplicates staged files.
 */
export async function stageJournalEntryMemoryFiles(entry: JournalEntry): Promise<MemoryFileRecord[]> {
    try {
        if (entry.status !== 'completed') return [];
        if (await hasStagedSession(entry.id)) return [];
        const userText = userTextOf(entry.messages);
        if (!userText) return [];
        const dayKey = getLocalDateKeyFromTimestamp(entry.createdAt);
        const insight = entry.analysis?.insight?.trim() || trimSection(userText, 180);
        const topics = (entry.analysis?.topics ?? []).slice(0, MAX_TOPICS);
        const staged: MemoryFileRecord[] = [];
        if (topics.length === 0) {
            staged.push(await stageTmpMemory({
                type: 'project',
                name: `General: ${trimSection(entry.title || 'Journal entry', 50)}`,
                description: `Thread hint general. ${trimSection(insight, 140)}`,
                body: [
                    '## Current Stage',
                    trimSection(insight, 300),
                    '',
                    '## Notes',
                    `- Written ${dayKey}: ${trimSection(entry.title || 'untitled entry', 80)}`,
                ].join('\n'),
                sourceSessionKey: entry.id,
            }));
            return staged;
        }
        for (const topic of topics) {
            const thread = slugTopic(topic);
            staged.push(await stageTmpMemory({
                type: 'project',
                name: `${titleCase(topic)}: ${trimSection(entry.title || 'Journal entry', 40)}`,
                description: `Thread hint ${thread}. ${trimSection(insight, 140)}`,
                body: [
                    '## Current Stage',
                    trimSection(insight, 300),
                    '',
                    '## Notes',
                    `- Thread: ${titleCase(topic)}`,
                    `- Written ${dayKey}: ${trimSection(entry.title || 'untitled entry', 80)}`,
                    `- Latest note: ${trimSection(userText, 200)}`,
                ].join('\n'),
                sourceSessionKey: entry.id,
            }));
        }
        return staged;
    } catch {
        return [];
    }
}

const CHECK_IN_LABELS: Record<IntentionCheckIn['type'], string> = {
    morning: 'Morning intention',
    evening: 'Evening reflection',
    intention: 'Intention',
};

/** Stage a completed check-in into `_tmp`. Idempotent per check-in id. */
export async function stageCheckInMemoryFiles(checkIn: IntentionCheckIn): Promise<MemoryFileRecord[]> {
    try {
        if (checkIn.status !== 'completed') return [];
        if (await hasStagedSession(checkIn.id)) return [];
        const userText = userTextOf(checkIn.messages) || (checkIn.summary ?? '').trim();
        if (!userText) return [];
        const dayKey = getLocalDateKeyFromTimestamp(checkIn.createdAt);
        const label = CHECK_IN_LABELS[checkIn.type];
        const staged = await stageTmpMemory({
            type: 'project',
            name: `${label}: ${trimSection(checkIn.title, 40)}`,
            description: `Thread hint ${checkIn.type}-intentions. ${trimSection(userText, 140)}`,
            body: [
                '## Current Stage',
                trimSection(userText, 300),
                '',
                '## Notes',
                `- Written ${dayKey}: ${trimSection(checkIn.title, 80)}`,
            ].join('\n'),
            sourceSessionKey: checkIn.id,
        });
        return [staged];
    } catch {
        return [];
    }
}
