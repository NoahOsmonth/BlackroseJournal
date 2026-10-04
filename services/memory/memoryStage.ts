import type { JournalEntry } from '@/services/journal/journalStorage.types';
import type { IntentionCheckIn } from '@/services/intentions/intentionsStorage.types';
import type { Message } from '@/services/ai';
import { getLocalDateKeyFromTimestamp } from '@/utils/date';
import {
    hasStagedSession,
    refreshMemoryFilesForSession,
    stageTmpMemory,
} from './memoryFiles';
import type { MemoryFileBodyUpdate, MemoryFileRecord, StageMemoryInput } from './memoryFiles';

/**
 * Finish-path `_tmp` staging (ClawX `_tmp` pattern).
 *
 * Deterministic and offline-safe: builds one project file per topic from
 * the entry's own analysis + user text. Dream (memoryDream.ts) promotes
 * staged files into formal threads. Never throws — finish paths must not
 * break on memory staging.
 */

const MAX_TOPICS = 3;

interface JournalEntryMemoryDraft {
    name: string;
    description: string;
    body: string;
}

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
 * The `_tmp` drafts a completed entry stages: one per topic, or a single
 * "General" file when no topic was recognised. Pure — no I/O. Shared by the
 * finish path and the edit-refresh path so an edited entry rebuilds the exact
 * same bodies it staged, and only the user text inside them changes.
 */
function buildJournalEntryMemoryDrafts(entry: JournalEntry): JournalEntryMemoryDraft[] {
    const userText = userTextOf(entry.messages);
    if (!userText) return [];
    const dayKey = getLocalDateKeyFromTimestamp(entry.createdAt);
    const insight = entry.analysis?.insight?.trim() || trimSection(userText, 180);
    const topics = (entry.analysis?.topics ?? []).slice(0, MAX_TOPICS);
    if (topics.length === 0) {
        return [{
            name: `General: ${trimSection(entry.title || 'Journal entry', 50)}`,
            description: `Thread hint general. ${trimSection(insight, 140)}`,
            body: [
                '## Current Stage',
                trimSection(insight, 300),
                '',
                '## Notes',
                `- Written ${dayKey}: ${trimSection(entry.title || 'untitled entry', 80)}`,
            ].join('\n'),
        }];
    }
    return topics.map((topic) => {
        const thread = slugTopic(topic);
        return {
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
        };
    });
}

/**
 * Collapse drafts that share a name, first one wins.
 *
 * `name` is the identity staging keys on, so two drafts with the same name are
 * indistinguishable to the file store: staging them collapses onto one file via
 * id reuse, and refreshing them would have the second find no file to claim and
 * stage a duplicate. An analysis can legitimately yield two topics that differ
 * only in case (`['Kiln', 'kiln']`), so dedupe before either path sees them.
 */
function dedupeDraftsByName(drafts: readonly JournalEntryMemoryDraft[]): JournalEntryMemoryDraft[] {
    const seen = new Set<string>();
    const unique: JournalEntryMemoryDraft[] = [];
    for (const draft of drafts) {
        if (seen.has(draft.name)) continue;
        seen.add(draft.name);
        unique.push(draft);
    }
    return unique;
}

/** A draft as the owning module's staging input, tagged with the entry id. */
function draftStageInput(entry: JournalEntry, draft: JournalEntryMemoryDraft): StageMemoryInput {
    return {
        type: 'project',
        name: draft.name,
        description: draft.description,
        body: draft.body,
        sourceSessionKey: entry.id,
    };
}

async function stageJournalEntryDrafts(
    entry: JournalEntry,
    drafts: readonly JournalEntryMemoryDraft[],
): Promise<MemoryFileRecord[]> {
    const staged: MemoryFileRecord[] = [];
    for (const draft of drafts) {
        staged.push(await stageTmpMemory(draftStageInput(entry, draft)));
    }
    return staged;
}

/**
 * Stage a completed journal entry into `_tmp`. Idempotent per entry id:
 * re-running a finish never duplicates staged files.
 */
export async function stageJournalEntryMemoryFiles(entry: JournalEntry): Promise<MemoryFileRecord[]> {
    try {
        if (entry.status !== 'completed') return [];
        if (await hasStagedSession(entry.id)) return [];
        return await stageJournalEntryDrafts(entry, buildJournalEntryMemoryDrafts(entry));
    } catch {
        return [];
    }
}

/**
 * Refresh the offline memory files a completed entry already owns after its
 * text was edited, so recall returns the new words instead of the original.
 *
 * Updates bodies in place — same id, same projectId/thread, same manifest slot
 * — and stages a fresh `_tmp` file only when the entry has no live file yet, or
 * when the edit introduced a topic the entry did not stage before. It never
 * deletes: see `updateMemoryFileBodiesInPlace` for why delete-and-restage here
 * would silently retire a Dream-promoted memory from its thread.
 *
 * The read-decide-write runs inside ONE lock owned by `memoryFiles`
 * (`refreshMemoryFilesForSession`). The old shape read the live headers and then
 * wrote in separate lock sections, so two concurrent refreshes could each see
 * zero files and each stage one — two divergent files for one entry.
 *
 * Never throws — an edit must not fail because memory refresh did.
 */
export async function refreshJournalEntryMemoryFiles(entry: JournalEntry): Promise<MemoryFileRecord[]> {
    try {
        if (entry.status !== 'completed') return [];
        const drafts = dedupeDraftsByName(buildJournalEntryMemoryDrafts(entry));
        if (drafts.length === 0) return [];

        return await refreshMemoryFilesForSession(entry.id, ({ live, staged }) => {
            if (live.length === 0) {
                // Nothing live to rewrite. If this entry ever staged a file, that
                // file was deliberately retired — supersession matched a
                // near-duplicate entry and deprecated this one. Editing the loser
                // must not resurrect it: the next Dream would promote it back and
                // retire the entry that won, inverting the consolidation. The
                // finish path is guarded the same way; `staged` counts deprecated
                // headers.
                if (staged) return null;
                return { updates: [], fresh: drafts.map((draft) => draftStageInput(entry, draft)) };
            }

            const available = [...live];
            const updates: MemoryFileBodyUpdate[] = [];
            const fresh: StageMemoryInput[] = [];
            for (const draft of drafts) {
                // Prefer the deterministic name (topic + title). `splice` consumes
                // each match so two drafts with the same name map to two distinct
                // files.
                let index = available.findIndex((header) => header.name === draft.name);
                if (index === -1 && available.length > 0) {
                    // The name embeds BOTH the topic and the title, and either can
                    // change between finish and edit. In production it always does:
                    // the finish path stages before analysis is backfilled (it runs
                    // concurrently), so it writes "General: <title>", while the edit
                    // builds "<Topic>: <title>" from the stored analysis. Names then
                    // never match. Drafts and live files are both derived from this
                    // one entry, so an unmatched draft claims a leftover file and
                    // rewrites it in place rather than orphaning it and staging a
                    // duplicate.
                    index = 0;
                }
                if (index === -1) {
                    fresh.push(draftStageInput(entry, draft));
                    continue;
                }
                const match = available.splice(index, 1)[0];
                updates.push({ id: match.id, body: draft.body, name: draft.name, description: draft.description });
            }

            // A topic the edit introduced has no file to rewrite, so stage it. A
            // topic the edit removed leaves its old file untouched rather than
            // deleted — recall may still legitimately cite that history.
            return { updates, fresh };
        });
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
