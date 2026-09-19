import { createEntry } from '@/services/journal/journalStorage';
import type { JournalEntry } from '@/services/journal/journalStorage.types';
import { upsertJournalDayDigest } from './dayDigestStorage';
import { extractTags } from './keywordRanking';
import { upsertMemoryAtom } from './localMemory';
import type { LocalMemoryAtom } from './localMemory.types';
import { stageUserNoteMemory } from './memoryFiles';
import type { MemoryFileRecord } from './memoryFiles';

/**
 * Explore write path — one note, four stores.
 *
 * Mirrors `journalFinishSideEffects.ts`: one entry point owns the fan-out, so
 * "did every store get written?" is a testable question rather than four
 * scattered calls. Deterministic and offline: no model is called here, because
 * the page promises no AI in the loop and must keep that promise literally.
 * Identity extraction and session digests are the two finish-path side effects
 * that do call a model, and both are deferred to Dream.
 *
 * Write order is entry → atom → file → digest, and the order is load-bearing:
 * the entry is the user's actual words, so writing it first turns a partial
 * failure from "the writing is lost" into "the derived memory is incomplete,
 * and the words are still in Archive". That is the only acceptable direction.
 */

/** Matches the atom's own 600-char trim, so every store holds the same text. */
export const MAX_EXPLORE_NOTE_CHARS = 600;

export type ExploreNoteStore = 'atom' | 'file' | 'digest';

export interface ExploreNoteFailure {
    store: ExploreNoteStore;
    message: string;
}

export interface ExploreNoteInput {
    text: string;
    /** Injected for tests; defaults to Date.now(). */
    now?: number;
}

export interface ExploreNoteResult {
    entry: JournalEntry;
    /** Null when the atom write failed — see `failures`. */
    atom: LocalMemoryAtom | null;
    /** Null when the file write failed — see `failures`. */
    file: MemoryFileRecord | null;
    /** Stores that failed *after* the entry was durably written. */
    failures: ExploreNoteFailure[];
    themes: string[];
}

/**
 * First sentence, clipped at a word boundary.
 *
 * No model runs at write time, so the title is derived locally. The regex is a
 * plain prefix match rather than a lookbehind split: Hermes' lookbehind support
 * varies by version, and a title is not worth a runtime-only failure.
 */
export function deriveNoteTitle(text: string): string {
    const clean = text.trim().replace(/\s+/g, ' ');
    const match = /^[^.!?]*[.!?]/.exec(clean);
    const sentence = (match ? match[0] : clean).trim();
    if (sentence.length <= 60) return sentence;
    const clipped = sentence.slice(0, 60);
    const lastSpace = clipped.lastIndexOf(' ');
    const cut = lastSpace > 20 ? clipped.slice(0, lastSpace) : clipped;
    return `${cut.trim()}…`;
}

function messageOf(error: unknown): string {
    return error instanceof Error && error.message ? error.message : 'Unknown error';
}

export async function saveExploreNote(input: ExploreNoteInput): Promise<ExploreNoteResult> {
    const collapsed = input.text.trim().replace(/\s+/g, ' ');
    if (!collapsed) throw new Error('Note text is required.');
    // One clipped value, used by every store. Clipping per store is how the
    // atom ends up holding 600 chars while the entry holds 1200 — and then
    // recall returns text the writer never saw in that shape.
    const text = collapsed.length > MAX_EXPLORE_NOTE_CHARS
        ? collapsed.slice(0, MAX_EXPLORE_NOTE_CHARS).trimEnd()
        : collapsed;
    const now = input.now ?? Date.now();
    const themes = extractTags(text);
    const title = deriveNoteTitle(text);

    // 1. The user's words, durably, before anything derives from them. A throw
    //    here aborts the whole write and surfaces — nothing else is attempted.
    const entry = await createEntry({
        title,
        messages: [{ id: `note_${now}`, role: 'user', content: text, timestamp: now }],
        status: 'completed',
        createdAt: now,
        updatedAt: now,
        origin: 'threads',
    });

    const failures: ExploreNoteFailure[] = [];

    // 2. Atom — feeds the always-on capsule and gives the row a route back to
    //    the entry, since the note now *is* an entry.
    let atom: LocalMemoryAtom | null = null;
    try {
        atom = await upsertMemoryAtom({
            layer: 'note',
            source: 'manual',
            sourceId: entry.id,
            rootSourceId: entry.id,
            rootSourceKind: 'journal_entry',
            title,
            content: text,
            tags: themes,
            salience: 0.9,
            confidence: 1,
            createdAt: now,
        });
    } catch (error: unknown) {
        failures.push({ store: 'atom', message: messageOf(error) });
    }

    // 3. File — the bridge. This is what makes `memory_search` able to see the note.
    let file: MemoryFileRecord | null = null;
    try {
        file = await stageUserNoteMemory({
            text,
            threadHint: themes[0],
            sourceEntryId: entry.id,
            capturedAt: new Date(now).toISOString(),
        });
    } catch (error: unknown) {
        failures.push({ store: 'file', message: messageOf(error) });
    }

    // 4. Day digest — built from the entry's own text, never a model summary.
    try {
        await upsertJournalDayDigest(entry);
    } catch (error: unknown) {
        failures.push({ store: 'digest', message: messageOf(error) });
    }

    return { entry, atom, file, failures, themes };
}
