import { memoryCapturedAtMs } from './memoryFade';
import {
    deprecateRecord,
    getMemoryRecordsForHeaders,
    listAllMemoryHeaders,
    listMemoryHeadersForThread,
    TMP_PROJECT_ID,
} from './memoryFiles';
import type { MemoryFileHeader, MemoryFileRecord } from './memoryFiles';
import { tokenize } from './keywordRanking';

/**
 * R2 — supersession for file memories.
 *
 * The corpus only ever grows: every finish stages a file, Dream promotes it,
 * and nothing ever says "this newer memory already covers that older one". The
 * R1 measurement showed the consequence — recall quality is now a *selection*
 * problem over an accumulating formal corpus (precision 0.400, and 34 of 47
 * staged files still waiting).
 *
 * Doctrine is borrowed from the identity profile
 * (`identityProfile.ts`: "supersede by invalidating prior values, never silent
 * wipe"): the older file is marked `deprecated` with an audit pointer to the
 * newer one, so it stops being recalled but its bytes survive for audit.
 * `deprecated` is the frontmatter field the store already honours — every list
 * function, `listFormalProjectIds`, `getMemoryRecordsByIds` and `listTmpFiles`
 * already exclude deprecated records, so supersession needs no new storage.
 *
 * **The criterion is the body, not the header.** Headers are templated on the
 * finish path (`Thread hint <hint>. <excerpt>`), and the R0 ledger's own
 * near-topic distractors prove the trap: 15 distinct entries share only 5
 * distinct descriptions, so header similarity would supersede real memories.
 * Body similarity alone is not enough either — the ledger's filler clauses
 * push genuinely different entries to 0.62 Jaccard (measured). Supersession
 * therefore fires only on **restatement**: the older file's content is almost
 * entirely contained in the newer one's.
 *
 * Never supersedes a `user` or `note` file — both carry the writer's own words,
 * which are undeletable by doctrine — never across threads, never the last live
 * file of a group. Soft-fail: a throw here must not break Dream.
 */

/** Share of the older body's tokens the newer body must contain to supersede. */
export const SUPERSEDE_RESTATEMENT_RATIO = 0.9;
/** Bodies below this token count are too short to judge — never superseded. */
export const SUPERSEDE_MIN_BODY_TOKENS = 20;
/**
 * Per-thread scan window: how many of a thread's newest memories one pass
 * compares. Measured cost of the O(n^2) pair sweep, with realistic ~28-token
 * bodies: 50 files = 2ms, 200 = 17ms, 400 = 103ms, 3000 = 3.4s. 400 is the
 * largest window that stays comfortably inside an idle background pass.
 *
 * What the window *means*, because it is not obvious: a restatement is only
 * caught if the newer copy arrives while the older one is still inside the
 * window. In an incrementally written journal that is almost always true — a
 * re-capture happens soon after the original, and the pair collapses then. A
 * restatement arriving more than this many memories later is never caught, and
 * raising the number only moves that horizon.
 */
export const SUPERSEDE_SCAN_LIMIT = 400;

export interface SupersedeOutcome {
    superseded: number;
    /** Threads that lost at least one redundant memory. */
    threads: string[];
    /**
     * Threads whose file count exceeded the scan window, so the pass did not
     * see all of them. Reported rather than swallowed: a window that silently
     * stops checking is how a supersession blind spot goes unnoticed.
     */
    truncated: string[];
}

function bodyTokenSet(record: MemoryFileRecord): Set<string> {
    return new Set(tokenize(record.content));
}

/**
 * Share of `older`'s tokens present in `newer`. 1 means the newer memory
 * restates the older one completely.
 */
export function restatementRatio(older: ReadonlySet<string>, newer: ReadonlySet<string>): number {
    if (older.size === 0) return 0;
    let shared = 0;
    older.forEach((token) => {
        if (newer.has(token)) shared += 1;
    });
    return shared / older.size;
}

/** Newest first, then id — deterministic, so a rerun supersedes the same pair. */
function byNewestThenId(a: MemoryFileRecord, b: MemoryFileRecord): number {
    return memoryCapturedAtMs(b) - memoryCapturedAtMs(a) || a.id.localeCompare(b.id);
}

/**
 * Supersede restated memories inside one thread.
 *
 * Iterates newest-first and lets each survivor claim the older files it
 * restates, so a three-way restatement chain collapses to its newest member
 * rather than to whichever pair happened to be compared first.
 */
export async function supersedeRestatedMemoriesInThread(threadId: string): Promise<SupersedeOutcome> {
    // Not `listMemoryFiles`: it caps `limit` at 50 because it feeds prompts and
    // UI pages, so a request for SUPERSEDE_SCAN_LIMIT came back as 50 and this
    // entry point could not reach a thread's tail whatever the window said.
    return supersedeThreadHeaders(threadId, await listMemoryHeadersForThread(threadId));
}

/**
 * The comparison itself, over headers the caller already holds. Split out so a
 * whole-store pass can read the manifest once and hand each thread its slice,
 * instead of paying a full manifest read per thread.
 *
 * Headers must arrive newest-capture-first; `SUPERSEDE_SCAN_LIMIT` is applied
 * here so both entry points bound the scan identically.
 */
async function supersedeThreadHeaders(
    threadId: string,
    headers: readonly MemoryFileHeader[],
): Promise<SupersedeOutcome> {
    // `user` and `note` files carry the writer's own words, and supersession's
    // whole job is deciding that a newer memory *replaces* an older one — which
    // is not a judgement to make about something the user typed. Promotion owns
    // the `_tmp` backlog: a staged file deprecated here would vanish from
    // `listTmpFiles` before Dream ever got to promote it. Both entry points
    // filter here so the invariant lives in one place.
    const scoped = headers.filter(
        (header: MemoryFileHeader) => header.type !== 'user'
            && header.type !== 'note'
            && header.projectId !== TMP_PROJECT_ID,
    );
    const candidates = scoped.slice(0, SUPERSEDE_SCAN_LIMIT);
    const truncated = scoped.length > SUPERSEDE_SCAN_LIMIT ? [threadId] : [];
    if (candidates.length < 2) return { superseded: 0, threads: [], truncated };

    const records = (await getMemoryRecordsForHeaders(candidates)).sort(byNewestThenId);
    if (records.length < 2) return { superseded: 0, threads: [], truncated };

    const tokens = records.map((record) => ({ id: record.id, set: bodyTokenSet(record) }));
    const supersededIds = new Set<string>();
    let superseded = 0;

    for (let newer = 0; newer < records.length; newer += 1) {
        const newerTokens = tokens[newer]!.set;
        if (supersededIds.has(records[newer]!.id)) continue;
        for (let older = newer + 1; older < records.length; older += 1) {
            const olderRecord = records[older]!;
            if (supersededIds.has(olderRecord.id)) continue;
            const olderTokens = tokens[older]!.set;
            if (olderTokens.size < SUPERSEDE_MIN_BODY_TOKENS) continue;
            if (restatementRatio(olderTokens, newerTokens) < SUPERSEDE_RESTATEMENT_RATIO) continue;
            const done = await deprecateRecord(olderRecord.id, {
                supersededBy: records[newer]!.id,
                reason: 'restated by a newer memory in the same thread',
            });
            if (done) {
                supersededIds.add(olderRecord.id);
                superseded += 1;
            }
        }
    }

    return { superseded, threads: superseded > 0 ? [threadId] : [], truncated };
}

/**
 * Supersede restated memories across every formal thread. Runs after Dream
 * promotion, so it rides the same trigger and never touches the `_tmp`
 * backlog (promotion owns that).
 */
export async function supersedeRestatedMemories(): Promise<SupersedeOutcome> {
    const outcome: SupersedeOutcome = { superseded: 0, threads: [], truncated: [] };
    try {
        // One manifest read for the whole pass, grouped in memory. Paging per
        // thread made this O(threads x manifest): measured at 200 threads over
        // 5000 files it did 401 full manifest parses and took 4.1s, and it scaled
        // with thread count at constant file count — so a journal that split into
        // more topics got slower without storing any more memories. Body loads
        // were already optimal at one per file and still are.
        const byThread = new Map<string, MemoryFileHeader[]>();
        for (const header of await listAllMemoryHeaders()) {
            const projectId = header.projectId;
            if (!projectId || projectId === TMP_PROJECT_ID) continue;
            const list = byThread.get(projectId);
            if (list) list.push(header);
            else byThread.set(projectId, [header]);
        }
        const threadIds = Array.from(byThread.keys()).sort((a, b) => a.localeCompare(b));
        for (const threadId of threadIds) {
            const thread = await supersedeThreadHeaders(threadId, byThread.get(threadId) ?? []);
            outcome.superseded += thread.superseded;
            outcome.threads.push(...thread.threads);
            outcome.truncated.push(...thread.truncated);
        }
        if (outcome.truncated.length > 0) {
            console.warn(
                'Memory supersession: ' + String(outcome.truncated.length) + ' thread(s) exceed the '
                + String(SUPERSEDE_SCAN_LIMIT) + '-file scan window and were only partly compared: '
                + outcome.truncated.join(', '),
            );
        }
    } catch (error: unknown) {
        console.warn('Memory supersession pass failed:', error);
    }
    return outcome;
}
